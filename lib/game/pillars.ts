/**
 * Pillar configuration for the Band Room
 * Defines positions, dimensions, and collision data for pillars
 */

export interface Pillar {
    id: string;
    x: number;
    z: number;
    radius: number;
    height: number;
}

export interface PillarConfig {
    pillars: Pillar[];
    /** Collision padding added to pillar radius */
    collisionPadding: number;
}

/**
 * Generate pillar positions for the Band Room
 * Creates 3 rings of pillars at zone boundaries:
 * - Ring 1 (54%): Between inner and mid zones
 * - Ring 2 (72%): Between mid and outer zones
 * - Ring 3 (88%): Between outer and extreme zones
 */
export function generatePillars(arenaRadius: number): PillarConfig {
    const pillars: Pillar[] = [];

    // Ring 1 - Between inner and mid zones (at 48% radius)
    const ring1Radius = arenaRadius * 0.48;
    const ring1Count = 10;
    const ring1PillarRadius = 3;

    for (let i = 0; i < ring1Count; i++) {
        const angle = (i / ring1Count) * Math.PI * 2;
        pillars.push({
            id: `ring1-${i}`,
            x: Math.cos(angle) * ring1Radius,
            z: Math.sin(angle) * ring1Radius,
            radius: ring1PillarRadius,
            height: 40,
        });
    }

    // Ring 2 - Between mid and outer zones (at 64% radius)
    const ring2Radius = arenaRadius * 0.64;
    const ring2Count = 14;
    const ring2PillarRadius = 3.5;

    for (let i = 0; i < ring2Count; i++) {
        // Offset by half a step for staggered pattern
        const angle = ((i + 0.5) / ring2Count) * Math.PI * 2;
        pillars.push({
            id: `ring2-${i}`,
            x: Math.cos(angle) * ring2Radius,
            z: Math.sin(angle) * ring2Radius,
            radius: ring2PillarRadius,
            height: 60,
        });
    }

    // Ring 3 - Between outer and extreme zones (at 80% radius)
    const ring3Radius = arenaRadius * 0.80;
    const ring3Count = 18;
    const ring3PillarRadius = 4;

    for (let i = 0; i < ring3Count; i++) {
        const angle = (i / ring3Count) * Math.PI * 2;
        pillars.push({
            id: `ring3-${i}`,
            x: Math.cos(angle) * ring3Radius,
            z: Math.sin(angle) * ring3Radius,
            radius: ring3PillarRadius,
            height: 80,
        });
    }

    return {
        pillars,
        collisionPadding: 0.5, // Half meter padding
    };
}

/**
 * Get pillars within a certain radius of a position (for optimized collision checks)
 * Uses squared distance to avoid expensive sqrt calculations
 */
export function getNearbyPillars(
    position: { x: number; z: number },
    pillars: Pillar[],
    radius: number = 20
): Pillar[] {
    const radiusSq = radius * radius;
    return pillars.filter(pillar => {
        const dx = position.x - pillar.x;
        const dz = position.z - pillar.z;
        return (dx * dx + dz * dz) < radiusSq;
    });
}

/**
 * Check if a position collides with any pillar
 * Returns the pillar if collision detected, null otherwise
 */
export function checkPillarCollision(
    position: { x: number; z: number },
    pillars: Pillar[],
    playerRadius: number = 0.5,
    collisionPadding: number = 0.5
): Pillar | null {
    for (const pillar of pillars) {
        const dx = position.x - pillar.x;
        const dz = position.z - pillar.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        const minDistance = pillar.radius + playerRadius + collisionPadding;

        if (distance < minDistance) {
            return pillar;
        }
    }
    return null;
}

/**
 * Resolve collision by pushing the player out of the pillar
 * Returns the corrected position
 */
export function resolvePillarCollision(
    position: { x: number; z: number },
    pillar: Pillar,
    playerRadius: number = 0.5,
    collisionPadding: number = 0.5
): { x: number; z: number } {
    const dx = position.x - pillar.x;
    const dz = position.z - pillar.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    const minDistance = pillar.radius + playerRadius + collisionPadding;

    if (distance < 0.001) {
        // Player is at exact center of pillar, push in arbitrary direction
        return {
            x: pillar.x + minDistance,
            z: pillar.z,
        };
    }

    // Push player out along the collision normal
    const nx = dx / distance;
    const nz = dz / distance;

    return {
        x: pillar.x + nx * minDistance,
        z: pillar.z + nz * minDistance,
    };
}

/**
 * Check if player can climb a pillar (for future climbing mechanic)
 * Currently returns true if player is touching the pillar
 */
export function canClimbPillar(
    position: { x: number; z: number },
    pillars: Pillar[],
    climbRange: number = 1.0
): Pillar | null {
    for (const pillar of pillars) {
        const dx = position.x - pillar.x;
        const dz = position.z - pillar.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        // Can climb if within range of pillar edge
        if (distance < pillar.radius + climbRange && distance > pillar.radius - 0.5) {
            return pillar;
        }
    }
    return null;
}

/**
 * Check if there is a clear line of sight between two positions
 * Returns true if there is NO pillar blocking the view
 * Uses ray-circle intersection test on the XZ plane
 */
export function checkLineOfSight(
    from: { x: number; z: number },
    to: { x: number; z: number },
    pillars: Pillar[],
    collisionPadding: number = 0.5
): boolean {
    // Direction vector from source to target
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const rayLength = Math.sqrt(dx * dx + dz * dz);
    
    if (rayLength < 0.001) return true; // Same position
    
    // Normalized direction
    const dirX = dx / rayLength;
    const dirZ = dz / rayLength;
    
    // Check intersection with each pillar
    for (const pillar of pillars) {
        const effectiveRadius = pillar.radius + collisionPadding;
        
        // Vector from ray origin to pillar center
        const toCircleX = pillar.x - from.x;
        const toCircleZ = pillar.z - from.z;
        
        // Project onto ray direction (dot product)
        const projLength = toCircleX * dirX + toCircleZ * dirZ;
        
        // If projection is behind us or past the target, skip
        if (projLength < 0 || projLength > rayLength) {
            continue;
        }
        
        // Find closest point on ray to pillar center
        const closestX = from.x + dirX * projLength;
        const closestZ = from.z + dirZ * projLength;
        
        // Distance from closest point to pillar center
        const distX = pillar.x - closestX;
        const distZ = pillar.z - closestZ;
        const distToCenter = Math.sqrt(distX * distX + distZ * distZ);
        
        // If distance is less than pillar radius, ray intersects
        if (distToCenter < effectiveRadius) {
            return false; // Blocked by this pillar
        }
    }
    
    return true; // Clear line of sight
}
