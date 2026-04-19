import { Vector3 } from 'three';
import { useGameStore } from '@/lib/store';

/**
 * Stair/Platform Collision Registry
 * 
 * Central system for registering walkable surfaces (stairs, platforms, ledges)
 * and querying the floor height at any given position.
 * 
 * Usage:
 * 1. Stairs component registers its steps on mount via registerSurface()
 * 2. FirstPersonController queries getFloorHeightAt() each frame
 * 3. Player lands on the highest registered surface at their position
 */

export interface WalkableSurface {
    id: string;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    floorY: number; // The Y position player stands on (top of surface)
    // Optional detailed shape for narrow-phase
    shape?: 'cylinder';
    radius?: number; // max radius (to vertices)
    sides?: number;  // number of radial segments
    centerX?: number;
    centerZ?: number;
}

export interface Obstacle {
    id: string;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    minY: number;
    maxY: number;
    // Optional detailed shape for narrow-phase
    shape?: 'cylinder';
    radius?: number; // max radius (to vertices)
    sides?: number;  // number of radial segments
    centerX?: number;
    centerZ?: number;
}

// Spatial Grid Size
const GRID_SIZE = 50;

function getGridKey(x: number, z: number): string {
    const gx = Math.floor(x / GRID_SIZE);
    const gz = Math.floor(z / GRID_SIZE);
    return `${gx},${gz}`;
}

// Get all grid keys that a bounding box overlaps
function getOverlappingGridKeys(minX: number, maxX: number, minZ: number, maxZ: number): string[] {
    const keys = [];
    const minGx = Math.floor(minX / GRID_SIZE);
    const maxGx = Math.floor(maxX / GRID_SIZE);
    const minGz = Math.floor(minZ / GRID_SIZE);
    const maxGz = Math.floor(maxZ / GRID_SIZE);

    for (let x = minGx; x <= maxGx; x++) {
        for (let z = minGz; z <= maxGz; z++) {
            keys.push(`${x},${z}`);
        }
    }
    return keys;
}

// Registry of all walkable surfaces (original format for unregistration)
const surfaceRegistry: Map<string, WalkableSurface[]> = new Map();
// Registry of all obstacles
const obstacleRegistry: Map<string, Obstacle[]> = new Map();

// Spatial hash maps for fast O(1) lookups
const spatialSurfaces: Map<string, WalkableSurface[]> = new Map();
const spatialObstacles: Map<string, Obstacle[]> = new Map();

let rebuildTimeout: NodeJS.Timeout | null = null;

/**
 * Schedule a spatial cache rebuild to happen after a short delay.
 * This batches multiple register/unregister calls that happen in the same frame
 * or in quick succession (like during room transitions).
 */
export function scheduleRebuild() {
    if (rebuildTimeout) return;
    rebuildTimeout = setTimeout(() => {
        rebuildSpatialCaches();
        rebuildTimeout = null;
    }, 0);
}

function rebuildSpatialCaches() {
    // console.log('[DungeonCollision] Rebuilding spatial caches...');
    spatialSurfaces.clear();
    for (const surfaces of surfaceRegistry.values()) {
        for (let i = 0; i < surfaces.length; i++) {
            const surface = surfaces[i];
            const keys = getOverlappingGridKeys(surface.minX, surface.maxX, surface.minZ, surface.maxZ);
            for (let j = 0; j < keys.length; j++) {
                const key = keys[j];
                let cell = spatialSurfaces.get(key);
                if (!cell) {
                    cell = [];
                    spatialSurfaces.set(key, cell);
                }
                cell.push(surface);
            }
        }
    }

    spatialObstacles.clear();
    for (const obstacles of obstacleRegistry.values()) {
        for (let i = 0; i < obstacles.length; i++) {
            const obstacle = obstacles[i];
            const keys = getOverlappingGridKeys(obstacle.minX, obstacle.maxX, obstacle.minZ, obstacle.maxZ);
            for (let j = 0; j < keys.length; j++) {
                const key = keys[j];
                let cell = spatialObstacles.get(key);
                if (!cell) {
                    cell = [];
                    spatialObstacles.set(key, cell);
                }
                cell.push(obstacle);
            }
        }
    }
}

/**
 * Register a set of walkable surfaces (e.g., stair steps)
 * @param groupId Unique identifier for this group (e.g., "left-room-stairs")
 * @param surfaces Array of surfaces to register
 */
export function registerSurfaces(groupId: string, surfaces: WalkableSurface[]): void {
    surfaceRegistry.set(groupId, surfaces);
    scheduleRebuild();
}

/**
 * Unregister surfaces when component unmounts
 * @param groupId The group to remove
 */
export function unregisterSurfaces(groupId: string): void {
    surfaceRegistry.delete(groupId);
    scheduleRebuild();
}

/**
 * Register a set of obstacles (e.g., closed vaults)
 * @param groupId Unique identifier for this group
 * @param obstacles Array of obstacles to register
 */
export function registerObstacles(groupId: string, obstacles: Obstacle[]): void {
    obstacleRegistry.set(groupId, obstacles);
    scheduleRebuild();
}

/**
 * Unregister obstacles when component unmounts or opens
 * @param groupId The group to remove
 */
export function unregisterObstacles(groupId: string): void {
    obstacleRegistry.delete(groupId);
    scheduleRebuild();
}

/**
 * Check if a position collides with any registered obstacle
 * @param x World X position
 * @param y World Y position
 * @param z World Z position
 * @param radius Player collision radius
 * @param height Player collision height
 * @returns boolean true if colliding
 */
export function isCollidingWithObstacle(x: number, y: number, z: number, radius: number = 0.5, height: number = 2.0): boolean {
    const key = getGridKey(x, z);
    const cellObstacles = spatialObstacles.get(key);

    if (!cellObstacles) return false;

    for (let i = 0; i < cellObstacles.length; i++) {
        const obs = cellObstacles[i];
        if (
            x >= obs.minX - radius &&
            x <= obs.maxX + radius &&
            z >= obs.minZ - radius &&
            z <= obs.maxZ + radius &&
            y + height >= obs.minY &&
            y <= obs.maxY
        ) {
            // Narrow-phase check for cylinder shape
            // THREE.CylinderGeometry aligns its first vertex at theta = 0 (X=0, Z=R by default orientation in our usage)
            // The faces are formed by lines connecting these vertices.
            const px = x - (obs.centerX || 0);
            const pz = z - (obs.centerZ || 0);
            if (obs.radius !== undefined && obs.sides !== undefined) {
                const R = obs.radius;
                const N = obs.sides;
                const A = R * Math.cos(Math.PI / N);

                let inside = true;
                for (let j = 0; j < N; j++) {
                    // THREE.CylinderGeometry (with default orientation) generates vertices along:
                    // x = R * sin(theta), z = R * cos(theta)
                    // The flat face between vertex J and J+1 has a normal at angle:
                    const theta_normal = (j + 0.5) * (2 * Math.PI / N);
                    const nx = Math.sin(theta_normal);
                    const nz = Math.cos(theta_normal);

                    if (px * nx + pz * nz > A + radius) { // player collision radius acts as margin
                        inside = false;
                        break;
                    }
                }
                if (!inside) continue;
            }

            return true;
        }
    }
    return false;
}

/**
 * Get the highest floor height at a given XZ position
 * Returns 0 if no registered surface at that position (ground level)
 * 
 * @param x World X position
 * @param z World Z position
 * @param currentY Current player Y position (for jump detection)
 * @param margin Horizontal margin for edge detection
 * @param location Current location string (e.g., 'backstage_halls')
 * @returns The floor Y height at this position
 */
export function getFloorHeightAt(x: number, z: number, currentY: number = 0, margin: number = 0.3, location?: string): number {
    let maxFloorY = -Infinity; // Initialize to -Infinity to support negative floors

    const key = getGridKey(x, z);
    const cellSurfaces = spatialSurfaces.get(key);

    if (cellSurfaces) {
        for (let i = 0; i < cellSurfaces.length; i++) {
            const surface = cellSurfaces[i];
            // Check if position is within surface bounds (with margin)
            if (
                x >= surface.minX - margin &&
                x <= surface.maxX + margin &&
                z >= surface.minZ - margin &&
                z <= surface.maxZ + margin
            ) {
                // Narrow-phase check for cylinder shape
                // THREE.CylinderGeometry aligns its first vertex at theta = 0 (X=0, Z=R by default orientation in our usage)
                // The faces are formed by lines connecting these vertices.
                if (surface.shape === 'cylinder' && surface.sides !== undefined && surface.radius !== undefined) {
                    const px = x - (surface.centerX || 0);
                    const pz = z - (surface.centerZ || 0);
                    const R = surface.radius;
                    const N = surface.sides;
                    const A = R * Math.cos(Math.PI / N);

                    let inside = true;
                    for (let j = 0; j < N; j++) {
                        // THREE.CylinderGeometry face normal angle:
                        const theta_normal = (j + 0.5) * (2 * Math.PI / N);
                        const nx = Math.sin(theta_normal);
                        const nz = Math.cos(theta_normal);

                        // Margin expands the apothem (use player radius ~0.5 + small buffer)
                        if (px * nx + pz * nz > A + Math.max(margin, 0.6)) {
                            inside = false;
                            break;
                        }
                    }
                    if (!inside) continue;
                }

                // Only consider surfaces that are below or at current Y (can land on)
                if (currentY >= surface.floorY - 2.5) {
                    if (surface.floorY > maxFloorY) maxFloorY = surface.floorY;
                }
            }
        }
    }
    // If no surface found, check for Backstage Halls special areas
    // This only applies when in the Backstage Halls location
    if (maxFloorY === -Infinity) {
        if (location === 'backstage_halls') {
            // Stairwell area: Z=184 to Z=219, X=-16 to X=16
            // Return -100 to trigger parkour fall respawn logic
            if (z >= 184 && z < 220 && x >= -16 && x <= 16) {
                return -100;
            }
            // Underground room area: Z=220 to Z=260, X=-15 to X=15 (30ft room + transition)
            // Return -20 (underground floor level)
            if (z >= 220 && z <= 260 && x >= -15 && x <= 15) {
                return -20;
            }
            // Hallway extension past underground room: Z=255 to Z=336, X=-6 to X=6
            // Return -20 (same floor level as underground room)
            if (z >= 255 && z <= 336 && x >= -6 && x <= 6) {
                return -20;
            }
            // Circular room area: Z=335 to Z=386, X=-26 to X=26
            // Return -20 (underground floor level)
            if (z >= 335 && z <= 386 && x >= -26 && x <= 26) {
                return -20;
            }
            // West corridor: Z=354 to Z=366, X=-98 to X=-23
            if (z >= 354 && z <= 366 && x >= -98 && x <= -23) {
                return -20;
            }
            // West vault room: Z=347 to Z=373, X=-123 to X=-96
            if (z >= 347 && z <= 373 && x >= -123 && x <= -96) {
                return -20;
            }
            // Metal door vault corridor + room: Z=370 to Z=430, X=-15 to X=15
            // Deep Vault Prison Hallway: Z=430 to Z=670, X=-18 to X=18
            if ((z >= 370 && z <= 430 && x >= -15 && x <= 15) ||
                (z > 430 && z <= 675 && x >= -20 && x <= 20)) {
                return -20;
            }
            // Deep Vault Trial Room (Lower Deep Vault): Z=670 to Z=785, X=-30 to X=30
            // Has stairwell (Y=-20 to -40) and lower floor (Y=-40). Returning -40 acts as a reliable catch-floor for the entire area.
            if (z > 670 && z <= 785 && x >= -30 && x <= 30) {
                return -40;
            }
            // Hub Descent stairwell (rectangular, Z=-55 to -85, X=-6 to 6)
            // Stairs descend 30ft from Y=0 to Y=-30
            if (z >= -86 && z <= -54 && x >= -7 && x <= 7) {
                return -30; // Catch floor at bottom of stairwell
            }
            // Left Room South Extension Corridor: X=-160 to X=-141, Z=10 to Z=250
            // Return 15 (elevated corridor floor)
            if (x >= -160 && x <= -141 && z >= 10 && z <= 250) {
                return 15;
            }
            // Prison cells (west side): X=-164 to X=-154, Z=43-55 and Z=63-75
            if (x >= -164 && x <= -154 && ((z >= 43 && z <= 55) || (z >= 63 && z <= 75))) {
                return 15;
            }
            // Prison cells (east side): X=-143 to X=-133, Z=43-55 and Z=63-75
            if (x >= -143 && x <= -133 && ((z >= 43 && z <= 55) || (z >= 63 && z <= 75))) {
                return 15;
            }
            // Left Branch Corridor: X=-141 to X=-15, Z=237 to Z=251 (corridor part only)
            // Shaft area (X=-15 to X=7) has NO floor — players fall to underground room at Y=-20
            if (x >= -141 && x <= -15 && z >= 237 && z <= 251) {
                return 15;
            }
            // Upper areas (Y=60) are now handled exclusively by the surface registry in BackstageHalls.tsx
        }
        // Default to ground level (0) for all other cases
        return 0;
    }
    return maxFloorY;
}

/**
 * Check if player can step up to a surface (for smooth stair climbing)
 * @param x Current X
 * @param z Current Z
 * @param currentFloorY Current floor height
 * @param maxStepUp Maximum step up height (default 1.2 for climbing steps)
 * @returns Target floor height if can step up, otherwise current floor
 */
export function getStepUpHeight(
    x: number,
    z: number,
    currentFloorY: number,
    maxStepUp: number = 1.6 // Increased from 1.2 to 1.6 to allow 1.5ft spiral steps
): number {
    let targetFloorY = currentFloorY;

    const key = getGridKey(x, z);
    const cellSurfaces = spatialSurfaces.get(key);

    if (cellSurfaces) {
        for (let i = 0; i < cellSurfaces.length; i++) {
            const surface = cellSurfaces[i];
            if (
                x >= surface.minX &&
                x <= surface.maxX &&
                z >= surface.minZ &&
                z <= surface.maxZ
            ) {
                const heightDiff = surface.floorY - currentFloorY;
                if (heightDiff > 0 && heightDiff <= maxStepUp) {
                    if (surface.floorY > targetFloorY) targetFloorY = surface.floorY;
                }
            }
        }
    }

    return targetFloorY;
}

/**
 * Debug: Get all registered surface counts
 */
export function getRegistryStats(): { groups: number; surfaces: number; obstacles: number } {
    let totalSurfaces = 0;
    for (const surfaces of surfaceRegistry.values()) {
        totalSurfaces += surfaces.length;
    }
    let totalObstacles = 0;
    for (const obstacles of obstacleRegistry.values()) {
        totalObstacles += obstacles.length;
    }
    return { groups: surfaceRegistry.size, surfaces: totalSurfaces, obstacles: totalObstacles };
}
