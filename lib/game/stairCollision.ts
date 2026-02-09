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
}

// Registry of all walkable surfaces
const surfaceRegistry: Map<string, WalkableSurface[]> = new Map();

/**
 * Register a set of walkable surfaces (e.g., stair steps)
 * @param groupId Unique identifier for this group (e.g., "left-room-stairs")
 * @param surfaces Array of surfaces to register
 */
export function registerSurfaces(groupId: string, surfaces: WalkableSurface[]): void {
    surfaceRegistry.set(groupId, surfaces);
}

/**
 * Unregister surfaces when component unmounts
 * @param groupId The group to remove
 */
export function unregisterSurfaces(groupId: string): void {
    surfaceRegistry.delete(groupId);
}

/**
 * Get the highest floor height at a given XZ position
 * Returns 0 if no registered surface at that position (ground level)
 * 
 * @param x World X position
 * @param z World Z position
 * @param currentY Current player Y position (for jump detection)
 * @param margin Horizontal margin for edge detection
 * @returns The floor Y height at this position
 */
export function getFloorHeightAt(x: number, z: number, currentY: number = 0, margin: number = 0.3, location?: string): number {
    let maxFloorY = -Infinity; // Initialize to -Infinity to support negative floors

    // Check all registered surface groups
    for (const surfaces of surfaceRegistry.values()) {
        for (const surface of surfaces) {
            // Check if position is within surface bounds (with margin)
            if (
                x >= surface.minX - margin &&
                x <= surface.maxX + margin &&
                z >= surface.minZ - margin &&
                z <= surface.maxZ + margin
            ) {
                // Only consider surfaces that are below or at current Y (can land on)
                // Player must be above the surface to land on it (with overlap tolerance)
                if (currentY >= surface.floorY - 2.0) { // Increased tolerance (2.0) to catch steps when falling
                    maxFloorY = Math.max(maxFloorY, surface.floorY);
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
            // Underground room area: Z=220 to Z=255, X=-15 to X=15 (30ft room)
            // Return -20 (underground floor level)
            if (z >= 220 && z <= 255 && x >= -15 && x <= 15) {
                return -20;
            }
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
    maxStepUp: number = 1.2
): number {
    let targetFloorY = currentFloorY;

    for (const surfaces of surfaceRegistry.values()) {
        for (const surface of surfaces) {
            if (
                x >= surface.minX &&
                x <= surface.maxX &&
                z >= surface.minZ &&
                z <= surface.maxZ
            ) {
                // Can step up if surface is within maxStepUp of current floor
                const heightDiff = surface.floorY - currentFloorY;
                if (heightDiff > 0 && heightDiff <= maxStepUp) {
                    targetFloorY = Math.max(targetFloorY, surface.floorY);
                }
            }
        }
    }

    return targetFloorY;
}

/**
 * Debug: Get all registered surface counts
 */
export function getRegistryStats(): { groups: number; surfaces: number } {
    let totalSurfaces = 0;
    for (const surfaces of surfaceRegistry.values()) {
        totalSurfaces += surfaces.length;
    }
    return { groups: surfaceRegistry.size, surfaces: totalSurfaces };
}
