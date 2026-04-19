import { Vector3 } from 'three';
import { isValidDungeonPosition } from '@/lib/game/collision';
import { getFloorHeightAt } from '@/lib/game/stairCollision';
import { Pillar } from '@/lib/game/pillars';

// --- Enemy Position Registry (Spatial Hash) ---
// Registry structure: Map<gridKey, Set<enemyId>>
const SPATIAL_GRID_SIZE = 10;
const spatialRegistry = new Map<number, Set<string>>();

// Flat data for quick attribute access
const ENEMY_DATA = new Map<string, {
    x: number;
    z: number;
    type: string;
    lastUpdate: number;
    gridKey: number;
    onDamage?: (amount: number, type?: any) => void;
}>();

// --- Pillar Spatial Registry ---
// Pillars are static, so we can pre-compute their grid locations
const PILLAR_GRID_SIZE = 15; // Larger grid for pillars
const pillarSpatialRegistry = new Map<number, Pillar[]>();
let lastPillarsRef: Pillar[] | null = null;
let lastCleanupTime = 0;

function getGridKey(x: number, z: number, gridSize: number = SPATIAL_GRID_SIZE): number {
    // Bitwise shift automatically floors and converts to 32-bit int
    const gx = (x / gridSize) | 0;
    const gz = (z / gridSize) | 0;
    return (gx << 16) | (gz & 0xFFFF);
}

function updatePillarRegistry(pillars: Pillar[]) {
    // Fast reference check
    if (pillars === lastPillarsRef) return;
    lastPillarsRef = pillars;

    pillarSpatialRegistry.clear();
    for (let i = 0; i < pillars.length; i++) {
        const pillar = pillars[i];
        // Pillars can overlap multiple cells if large
        const minGx = ((pillar.x - pillar.radius) / PILLAR_GRID_SIZE) | 0;
        const maxGx = ((pillar.x + pillar.radius) / PILLAR_GRID_SIZE) | 0;
        const minGz = ((pillar.z - pillar.radius) / PILLAR_GRID_SIZE) | 0;
        const maxGz = ((pillar.z + pillar.radius) / PILLAR_GRID_SIZE) | 0;

        for (let gx = minGx; gx <= maxGx; gx++) {
            for (let gz = minGz; gz <= maxGz; gz++) {
                const key = (gx << 16) | (gz & 0xFFFF);
                let cell = pillarSpatialRegistry.get(key);
                if (!cell) {
                    cell = [];
                    pillarSpatialRegistry.set(key, cell);
                }
                cell.push(pillar);
            }
        }
    }
}

export function registerEnemyPosition(
    id: string,
    x: number,
    z: number,
    type: string,
    onDamage?: (amount: number, type?: any) => void
): void {
    const now = Date.now();
    const newGridKey = getGridKey(x, z);
    const existing = ENEMY_DATA.get(id);

    if (existing) {
        // Only update grid if key changed
        if (existing.gridKey !== newGridKey) {
            spatialRegistry.get(existing.gridKey)?.delete(id);
            let newCell = spatialRegistry.get(newGridKey);
            if (!newCell) {
                newCell = new Set();
                spatialRegistry.set(newGridKey, newCell);
            }
            newCell.add(id);
        }
        existing.x = x;
        existing.z = z;
        existing.type = type;
        existing.lastUpdate = now;
        existing.gridKey = newGridKey;
        existing.onDamage = onDamage;
    } else {
        // New registration
        ENEMY_DATA.set(id, { x, z, type, lastUpdate: now, gridKey: newGridKey, onDamage });
        let cell = spatialRegistry.get(newGridKey);
        if (!cell) {
            cell = new Set();
            spatialRegistry.set(newGridKey, cell);
        }
        cell.add(id);
    }

    // No internal cleanup anymore - handled by external manager for consistency
}

/**
 * Managed cleanup for the spatial registry.
 * Should be called periodically (e.g., every 2s) by a single component.
 */
export function cleanupSpatialRegistry(): void {
    const now = Date.now();
    const staleThreshold = now - 2000;

    // Use a single cleanup pass
    for (const [id, data] of ENEMY_DATA.entries()) {
        if (data.lastUpdate < staleThreshold) {
            unregisterEnemyPosition(id);
        }
    }
}

export function unregisterEnemyPosition(id: string): void {
    const data = ENEMY_DATA.get(id);
    if (data) {
        spatialRegistry.get(data.gridKey)?.delete(id);
        // Clean up empty cells to avoid memory growth
        if (spatialRegistry.get(data.gridKey)?.size === 0) {
            spatialRegistry.delete(data.gridKey);
        }
        ENEMY_DATA.delete(id);
    }
}

// Reusable temp vector to avoid per-frame allocation
const _sepVec = new Vector3();

/**
 * Apply separation force using spatial hash.
 * Checks only the current and 8 neighboring cells.
 * O(1) local check instead of O(N) global check.
 */
export function applySeparation(
    id: string,
    currentPos: Vector3,
    enemyType: string,
    minDist: number = 3,
    strength: number = 0.3
): void {
    const minDistSq = minDist * minDist;
    const gx = Math.floor(currentPos.x / SPATIAL_GRID_SIZE);
    const gz = Math.floor(currentPos.z / SPATIAL_GRID_SIZE);

    // Check 3x3 grid around the enemy
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            const key = ((gx + dx) << 16) | ((gz + dz) & 0xFFFF);
            const cell = spatialRegistry.get(key);
            if (!cell) continue;

            for (const otherId of cell) {
                if (otherId === id) continue;
                const other = ENEMY_DATA.get(otherId);
                if (!other || other.type !== enemyType) continue;

                const diffX = currentPos.x - other.x;
                const diffZ = currentPos.z - other.z;
                const distSq = diffX * diffX + diffZ * diffZ;

                if (distSq < minDistSq && distSq > 0.001) {
                    const dist = Math.sqrt(distSq);
                    const overlap = minDist - dist;
                    const pushX = (diffX / dist) * overlap * strength;
                    const pushZ = (diffZ / dist) * overlap * strength;
                    currentPos.x += pushX;
                    currentPos.z += pushZ;
                } else if (distSq <= 0.001) {
                    // Exactly overlapping — push in a random direction
                    const angle = Math.random() * Math.PI * 2;
                    currentPos.x += Math.cos(angle) * minDist * 0.5;
                    currentPos.z += Math.sin(angle) * minDist * 0.5;
                }
            }
        }
    }
}

export interface EnemyMovementParams {
    currentPos: Vector3;
    moveDirection: Vector3; // normalized
    moveDistance: number;
    currentLocation: string;
    bodyHeight: number;
    bodyRadius: number;
    pillars: Pillar[];
    arenaCenter: [number, number, number];
    arenaRadius: number;
    teleportToCenterOnOOB?: boolean;
}

/**
 * Mutates `currentPos` inline by applying physics, sliding, and collision detection.
 * Returns true if a collision was encountered (useful for changing wander direction).
 */
export function applyEnemyMovement({
    currentPos,
    moveDirection,
    moveDistance,
    currentLocation,
    bodyHeight,
    bodyRadius,
    pillars,
    arenaCenter,
    arenaRadius,
    teleportToCenterOnOOB = false
}: EnemyMovementParams): { didCollide: boolean } {
    let didCollide = false;

    // 1. Proposed new position
    const newX = currentPos.x + moveDirection.x * moveDistance;
    const newZ = currentPos.z + moveDirection.z * moveDistance;

    // 2. Dungeon Collision Check (sliding)
    if (currentLocation === 'backstage_halls') {
        const oldX = currentPos.x;
        const oldZ = currentPos.z;
        const isValidMove = isValidDungeonPosition(newX, newZ, 1.0); // 1.0 is enemy radius standard

        if (isValidMove) {
            currentPos.x = newX;
            currentPos.z = newZ;
        } else {
            // Try sliding
            if (isValidDungeonPosition(newX, oldZ, 1.0)) {
                currentPos.x = newX;
            }
            if (isValidDungeonPosition(oldX, newZ, 1.0)) {
                currentPos.z = newZ;
            }
            if (!isValidMove && !isValidDungeonPosition(newX, oldZ, 1.0) && !isValidDungeonPosition(oldX, newZ, 1.0)) {
                didCollide = true;
            }
        }
    } else {
        // Normal Movement (Band Room)
        currentPos.x = newX;
        currentPos.z = newZ;
    }

    // 3. Apply Gravity (Floor Height) - Optimized: only check if we actually moved or if in a vertical zone
    const hasMoved = Math.abs(currentPos.x - newX) > 0.001 || Math.abs(currentPos.z - newZ) > 0.001;

    // Always check floor if in backstage_halls stairwells/vaults (dynamic terrain)
    // or if we have significant horizontal movement
    if (hasMoved || currentLocation === 'backstage_halls') {
        const floorY = getFloorHeightAt(currentPos.x, currentPos.z, currentPos.y, 0.3, currentLocation);
        currentPos.y = floorY + (bodyHeight / 2); // Center of body
    }

    // 4. Pillar collision resolution
    const collisionPadding = 0.5;
    const searchRadiusSq = 15 * 15; // 225

    // --- Pillar Collision with Spatial Hash ---
    if (pillars.length > 0) {
        updatePillarRegistry(pillars);
        const pgx = Math.floor(currentPos.x / PILLAR_GRID_SIZE);
        const pgz = Math.floor(currentPos.z / PILLAR_GRID_SIZE);

        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                const key = ((pgx + dx) << 16) | ((pgz + dz) & 0xFFFF);
                const cellPillars = pillarSpatialRegistry.get(key);
                if (!cellPillars) continue;

                for (let i = 0; i < cellPillars.length; i++) {
                    const pillar = cellPillars[i];
                    const pdx = currentPos.x - pillar.x;
                    const pdz = currentPos.z - pillar.z;

                    // Fast distance check squared
                    const distSq = pdx * pdx + pdz * pdz;
                    const baseRadius = pillar.radius * 1.5;
                    const minDist = baseRadius + bodyRadius + collisionPadding;

                    if (distSq < minDist * minDist) {
                        const distToPillar = Math.sqrt(distSq);
                        let nx = 1;
                        let nz = 0;
                        if (distToPillar > 0.001) {
                            nx = pdx / distToPillar;
                            nz = pdz / distToPillar;
                        }

                        currentPos.x = pillar.x + nx * minDist;
                        currentPos.z = pillar.z + nz * minDist;
                        didCollide = true;
                    }
                }
            }
        }
    }

    // 5. Arena boundary collision
    const cx = arenaCenter[0];
    const cz = arenaCenter[2];
    const dx = currentPos.x - cx;
    const dz = currentPos.z - cz;
    const distFromCenterSq = dx * dx + dz * dz;
    const arenaRadiusSq = arenaRadius * arenaRadius;

    if (distFromCenterSq > arenaRadiusSq) {
        didCollide = true;
        if (teleportToCenterOnOOB) {
            currentPos.x = cx;
            currentPos.z = cz;
        } else {
            const angle = Math.atan2(dz, dx);
            const resetDist = arenaRadius * 0.9;
            currentPos.x = cx + Math.cos(angle) * resetDist;
            currentPos.z = cz + Math.sin(angle) * resetDist;
        }
    }

    return { didCollide };
}

/**
 * For the Backstage Halls dungeon, checks if two positions are in the same general zone
 * or have line of sight to each other across the central hub.
 */
export function checkZoneLineOfSight(pos1: Vector3 | { x: number, z: number }, pos2: Vector3 | { x: number, z: number }): boolean {
    const getZone = (pos: { x: number, z: number }) => {
        const { x, z } = pos;
        if (z >= 25 && x >= -6 && x <= 6) return 'center'; // Center Corridor
        if (x >= 25 && z >= -6 && z <= 6) return 'right'; // Right Corridor
        if (x <= -25 && z >= -6 && z <= 6) return 'left'; // Left Corridor
        if (x >= -15 && x <= 15 && z >= -25 && z <= 25) return 'hub'; // Hub

        // Backstage Expansion Zones
        if (z >= 125 && z <= 185 && x >= -15 && x <= 15) return 'center_vault';
        if (z >= 220 && z <= 260 && x >= -15 && x <= 15) return 'underground_room';
        if (x <= -130 && x >= -170 && z >= 10 && z <= 80) return 'prison_block';
        if (x <= -190 && x >= -260 && z >= -30 && z <= 30) return 'upper_vault';
        if (x <= -140 && x >= -200 && z >= -10 && z <= 10) return 'upper_corridor';

        return 'other';
    };

    const zone1 = getZone(pos1);
    const zone2 = getZone(pos2);

    return (
        (zone1 === zone2) ||
        (zone1 === 'hub' && ['center', 'left', 'right'].includes(zone2)) ||
        (zone2 === 'hub' && ['center', 'left', 'right'].includes(zone1)) ||
        (zone1 === 'center_vault' && zone2 === 'center') ||
        (zone2 === 'center_vault' && zone1 === 'center') ||
        (zone1 === 'upper_vault' && zone2 === 'upper_corridor') ||
        (zone2 === 'upper_vault' && zone1 === 'upper_corridor')
    );
}

/**
 * Utility to determine if an enemy's AI frame should execute based on distance.
 * This introduces tiered frame-skipping for distant enemies to save CPU.
 */
export function shouldUpdateEnemyFrame(distanceToPlayer: number, currentFrame: number): boolean {
    if (distanceToPlayer > 250) {
        return (currentFrame % 16) === 0; // Very distant: every 16 frames
    } else if (distanceToPlayer > 120) {
        return (currentFrame % 8) === 0;  // Distant: every 8 frames
    } else if (distanceToPlayer > 60) {
        return (currentFrame % 4) === 0;  // Mid-range: every 4 frames
    } else if (distanceToPlayer > 30) {
        return (currentFrame % 2) === 0;  // Close: every 2 frames
    }
    return true; // Very close: update every frame
}

/**
 * Triggers damage on all enemies within a specified radius of a center point.
 * Uses the ENEMY_POSITIONS registry to find targets and calls their registered onDamage callbacks.
 */
export function triggerAreaDamage(
    centerX: number,
    centerZ: number,
    radius: number,
    amount: number,
    type?: any
): void {
    const radiusSq = radius * radius;
    // console.log(`[AreaDamage] Triggering at (${centerX.toFixed(1)}, ${centerZ.toFixed(1)}) with radius ${radius}, amount ${amount}`);

    // Optimization: Use spatial grid to only check nearby cells
    const minGx = Math.floor((centerX - radius) / SPATIAL_GRID_SIZE);
    const maxGx = Math.floor((centerX + radius) / SPATIAL_GRID_SIZE);
    const minGz = Math.floor((centerZ - radius) / SPATIAL_GRID_SIZE);
    const maxGz = Math.floor((centerZ + radius) / SPATIAL_GRID_SIZE);

    let hitCount = 0;
    for (let gx = minGx; gx <= maxGx; gx++) {
        for (let gz = minGz; gz <= maxGz; gz++) {
            const key = (gx << 16) | (gz & 0xFFFF);
            const cell = spatialRegistry.get(key);
            if (!cell) continue;

            for (const id of cell) {
                const data = ENEMY_DATA.get(id);
                if (!data) continue;

                const dx = data.x - centerX;
                const dz = data.z - centerZ;
                const distSq = dx * dx + dz * dz;

                if (distSq <= radiusSq) {
                    if (data.onDamage) {
                        data.onDamage(amount, type);
                        hitCount++;
                    }
                }
            }
        }
    }
    // console.log(`[AreaDamage] Hit ${hitCount} enemies.`);
}
