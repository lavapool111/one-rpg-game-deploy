import { Vector3 } from 'three';
import { isValidDungeonPosition } from './collision';
import { getFloorHeightAt } from './stairCollision';
import { Pillar } from './pillars';

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

    // 3. Apply Gravity (Floor Height)
    const floorY = getFloorHeightAt(currentPos.x, currentPos.z, currentPos.y, 0.3, currentLocation);
    currentPos.y = floorY + (bodyHeight / 2); // Center of body

    // 4. Pillar collision resolution
    const collisionPadding = 0.5;
    const searchRadiusSq = 15 * 15; // 225

    for (const pillar of pillars) {
        const pdx = currentPos.x - pillar.x;
        const pdz = currentPos.z - pillar.z;

        // Fast distance check squared
        const distSq = pdx * pdx + pdz * pdz;
        if (distSq > searchRadiusSq) continue;

        const baseRadius = pillar.radius * 1.5;
        const minDist = baseRadius + bodyRadius + collisionPadding;

        if (distSq < minDist * minDist) {
            const distToPillar = Math.sqrt(distSq);
            const pushDir = distToPillar > 0.001
                ? { x: pdx / distToPillar, z: pdz / distToPillar }
                : { x: 1, z: 0 };

            currentPos.x = pillar.x + pushDir.x * minDist;
            currentPos.z = pillar.z + pushDir.z * minDist;
            didCollide = true;
        }
    }

    // 5. Arena boundary collision
    const cx = arenaCenter[0];
    const cz = arenaCenter[2];
    const distFromCenter = Math.sqrt((currentPos.x - cx) ** 2 + (currentPos.z - cz) ** 2);
    if (distFromCenter > arenaRadius) {
        didCollide = true;
        if (teleportToCenterOnOOB) {
            currentPos.x = cx;
            currentPos.z = cz;
        } else {
            const angle = Math.atan2(currentPos.z - cz, currentPos.x - cx);
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
