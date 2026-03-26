/**
 * Zone Culling System for Backstage Halls
 *
 * Defines zone boundaries (matching collision.ts) and a visibility adjacency map.
 * Zones that are not adjacent to the player's current zone are culled (hidden)
 * to improve rendering performance.
 *
 * IMPORTANT: adjacency must be generous — a zone must never visibly disappear.
 * If any sightline exists between two zones, they must be listed as adjacent.
 */

// Zone IDs — matches the zones in collision.ts
export type DungeonZone =
    | 'hub'
    | 'center_corridor'
    | 'left_corridor'
    | 'right_corridor'
    | 'left_room'
    | 'right_room'
    | 'right_stairwell'
    | 'right_underground'
    | 'center_room'
    | 'stairwell'
    | 'underground_room'
    | 'left_extension'       // Left Room South Extension + Prison Cells
    | 'hallway_extension'
    | 'left_branch'          // Left Branch Corridor + Shaft
    | 'left_room_upper'      // Third/Fourth platforms, Upper Corridor, Upper Vault
    | 'circular_room'
    | 'west_corridor'
    | 'west_vault'
    | 'metal_door_vault'
    | 'deep_vault_prison'
    | 'deep_vault_lower'
    | 'hub_descent';

// Zone boundary definition for player zone detection
interface ZoneBounds {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    minY?: number;  // Optional Y filter
    maxY?: number;
    /** If true, use circular check from centerX/centerZ with radius */
    circular?: boolean;
    centerX?: number;
    centerZ?: number;
    radius?: number;
}

// Zone definitions — simplified AABB bounds to determine which zone the player is in.
// These are intentionally generous (overlapping at transitions) so the player
// is always detected as being in a zone. Checked in order — first match wins.
const ZONE_BOUNDS: [DungeonZone, ZoneBounds][] = [
    // Check Y-gated zones first (more specific)
    ['left_room_upper', { minX: -252, maxX: -139, minZ: -28, maxZ: 28, minY: 40 }],
    ['left_extension', { minX: -165, maxX: -133, minZ: 10, maxZ: 251, minY: 13 }],
    ['left_branch', { minX: -150, maxX: 7, minZ: 237, maxZ: 251, minY: 13 }],

    // Underground areas (Y <= -15)
    ['west_vault', { minX: -123, maxX: -96, minZ: 349, maxZ: 371, maxY: -15 }],
    ['west_corridor', { minX: -98, maxX: -23, minZ: 354, maxZ: 366, maxY: -15 }],
    ['deep_vault_prison', { minX: -15, maxX: 15, minZ: 432, maxZ: 675, maxY: -15 }],

    // Hub Descent — passages + antechamber behind hub north wall
    ['hub_descent', { minX: -15, maxX: 15, minZ: -86, maxZ: -24 }],
    ['metal_door_vault', { minX: -16, maxX: 16, minZ: 383, maxZ: 432, maxY: -15 }],
    ['circular_room', { minX: -26, maxX: 26, minZ: 334, maxZ: 386, maxY: -15 }],
    ['hallway_extension', { minX: -7, maxX: 7, minZ: 252, maxZ: 370, maxY: -15 }],
    ['underground_room', { minX: -16, maxX: 16, minZ: 220, maxZ: 257, maxY: -15 }],

    // Stairwell (any Y — players fall through)
    ['stairwell', { minX: -16, maxX: 16, minZ: 183, maxZ: 226 }],

    // Right side underground
    ['right_underground', { minX: 190, maxX: 211, minZ: -10, maxZ: 10, maxY: -10 }],
    ['right_stairwell', { minX: 148, maxX: 191, minZ: -4, maxZ: 4 }],

    // Standard ground-level zones
    ['center_room', { minX: -13, maxX: 13, minZ: 125, maxZ: 185 }],
    ['center_corridor', { minX: -7, maxX: 7, minZ: 15, maxZ: 126 }],
    ['left_room', { minX: -160, maxX: -125, minZ: -18, maxZ: 18 }],
    ['left_corridor', { minX: -135, maxX: -10, minZ: -7, maxZ: 7 }],
    ['right_room', { minX: 120, maxX: 151, minZ: -8, maxZ: 40 }],
    ['right_corridor', { minX: 10, maxX: 126, minZ: -7, maxZ: 7 }],
    ['hub', { minX: -16, maxX: 16, minZ: -26, maxZ: 26 }],
];

/**
 * Visibility adjacency map.
 * For each zone, lists all zones that should be rendered when the player is in that zone.
 * The current zone is always included.
 *
 * Rule: if ANY sightline exists between two zones, they must be adjacent.
 */
const ZONE_VISIBILITY: Record<DungeonZone, DungeonZone[]> = {
    hub: ['hub', 'left_corridor', 'right_corridor', 'center_corridor', 'hub_descent'],
    center_corridor: ['hub', 'center_corridor', 'center_room', 'stairwell'],
    left_corridor: ['hub', 'left_corridor', 'left_room'],
    right_corridor: ['hub', 'right_corridor', 'right_room'],
    left_room: ['left_corridor', 'left_room', 'left_extension', 'left_room_upper'],
    right_room: ['right_corridor', 'right_room', 'right_stairwell', 'right_underground'],
    right_stairwell: ['right_room', 'right_stairwell', 'right_underground'],
    right_underground: ['right_stairwell', 'right_underground'],
    center_room: ['center_corridor', 'center_room', 'stairwell', 'underground_room'],
    stairwell: ['center_room', 'stairwell', 'underground_room'],
    // NOTE: Zones below have parent wrapper zones added for nesting correctness.
    // When ZoneCulled wrappers are nested (e.g., circular_room inside hallway_extension
    // inside underground_room), ALL parent wrappers must be visible for the child to render.
    underground_room: ['stairwell', 'underground_room', 'hallway_extension', 'left_branch'],
    left_extension: ['left_room', 'left_extension', 'left_branch'],
    // hallway_extension is nested inside underground_room wrapper
    hallway_extension: ['underground_room', 'hallway_extension', 'circular_room'],
    // left_branch is nested inside left_extension wrapper
    left_branch: ['left_extension', 'left_branch', 'underground_room'],
    left_room_upper: ['left_room', 'left_room_upper'],
    // circular_room is nested inside hallway_extension → underground_room
    circular_room: ['underground_room', 'hallway_extension', 'circular_room', 'west_corridor', 'metal_door_vault'],
    // west_corridor is nested inside circular_room → hallway_extension → underground_room
    west_corridor: ['underground_room', 'hallway_extension', 'circular_room', 'west_corridor', 'west_vault'],
    // west_vault is nested inside west_corridor → circular_room → ...
    west_vault: ['underground_room', 'hallway_extension', 'circular_room', 'west_corridor', 'west_vault'],
    // metal_door_vault is nested inside circular_room → hallway_extension → underground_room
    metal_door_vault: ['underground_room', 'hallway_extension', 'circular_room', 'metal_door_vault', 'deep_vault_prison'],
    deep_vault_prison: ['underground_room', 'hallway_extension', 'circular_room', 'metal_door_vault', 'deep_vault_prison', 'deep_vault_lower'],
    deep_vault_lower: ['underground_room', 'hallway_extension', 'circular_room', 'deep_vault_prison', 'deep_vault_lower'],
    hub_descent: ['hub', 'hub_descent'],
};

// Pre-compute visibility sets for O(1) lookup
const VISIBILITY_SETS: Record<DungeonZone, Set<DungeonZone>> = {} as any;
for (const zone of Object.keys(ZONE_VISIBILITY) as DungeonZone[]) {
    VISIBILITY_SETS[zone] = new Set(ZONE_VISIBILITY[zone]);
}

/**
 * Determine which zone the player is currently in.
 * Returns null if the player is not in any defined zone.
 */
export function getPlayerZone(x: number, y: number, z: number): DungeonZone | null {
    for (const [zone, bounds] of ZONE_BOUNDS) {
        // Y range check
        if (bounds.minY !== undefined && y < bounds.minY) continue;
        if (bounds.maxY !== undefined && y > bounds.maxY) continue;

        // XZ bounds check
        if (x >= bounds.minX && x <= bounds.maxX && z >= bounds.minZ && z <= bounds.maxZ) {
            return zone;
        }
    }
    return null;
}

/**
 * Get the set of zones that should be visible when the player is in the given zone.
 * Returns a set containing ALL zone IDs if the player zone is unknown (safe fallback).
 */
export function getVisibleZones(playerZone: DungeonZone | null): Set<DungeonZone> {
    if (playerZone === null) {
        // Fallback: render everything if we can't determine the zone
        return new Set(Object.keys(ZONE_VISIBILITY) as DungeonZone[]);
    }
    return VISIBILITY_SETS[playerZone];
}

/**
 * Check if a specific zone should be visible given the player's current zone.
 */
export function isZoneVisible(playerZone: DungeonZone | null, targetZone: DungeonZone): boolean {
    if (playerZone === null) return true; // Fallback: always visible
    return VISIBILITY_SETS[playerZone].has(targetZone);
}
