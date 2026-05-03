/**
 * Spawn Zone Registry
 *
 * Components (Hallway, Room, CircularRoom) register their world-space bounds
 * along with enemy configuration. BackstageSpawner queries this registry
 * instead of hardcoding coordinates and enemy logic.
 */

export type EnemyType = 'trumpet' | 'trombone' | 'tuba' | 'french_horn' | 'euphonium';

export interface EnemyWeight {
    type: EnemyType;
    weight: number;           // relative probability (weights are normalized)
    levelRange: [number, number]; // [min, max]
}

export interface SpawnZoneConfig {
    id: string;
    label: string;

    // Geometry (world space) — set by the registering component
    shape: 'aabb' | 'circle';
    minX: number; maxX: number;
    minZ: number; maxZ: number;
    floorY: number;
    // Circle-specific (for CircularRoom)
    centerX?: number;
    centerZ?: number;
    radius?: number;

    // Trigger point — player proximity activates spawning
    triggerPoint: { x: number; y?: number; z: number };
    triggerDistance?: number;    // default 35

    // Enemy configuration
    enemies: EnemyWeight[];
    frenchHornChance?: number;          // separate roll chance (0-1), default 0
    frenchHornLevelRange?: [number, number];
    maxEnemies?: number;                // default 5
    respawnThreshold?: number;          // respawn when count < this, default 2
    respawnDelay?: number;              // ms, default 10000
}

/** Props passed to Room/Hallway/CircularRoom — geometry fields are filled by the component */
export type SpawnZoneProps = Omit<SpawnZoneConfig, 'shape' | 'minX' | 'maxX' | 'minZ' | 'maxZ' | 'floorY' | 'centerX' | 'centerZ' | 'radius'>;

// ── Registry ──────────────────────────────────────────────────────────

const registry = new Map<string, SpawnZoneConfig>();

export function registerSpawnZone(zone: SpawnZoneConfig): void {
    registry.set(zone.id, zone);
}

export function unregisterSpawnZone(id: string): void {
    registry.delete(id);
}

export function getSpawnZone(id: string): SpawnZoneConfig | undefined {
    return registry.get(id);
}

export function getAllSpawnZones(): SpawnZoneConfig[] {
    return Array.from(registry.values());
}

// ── Position Generation ───────────────────────────────────────────────

/** Generate a random [x, y, z] inside the registered zone */
export function getRandomPositionInZone(id: string): [number, number, number] | null {
    const zone = registry.get(id);
    if (!zone) return null;

    if (zone.shape === 'circle' && zone.centerX !== undefined && zone.centerZ !== undefined && zone.radius !== undefined) {
        // Uniform random point inside a circle (sqrt for uniform distribution)
        const angle = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * (zone.radius * 0.85); // 85% of radius to stay away from walls
        const x = zone.centerX + Math.cos(angle) * r;
        const z = zone.centerZ + Math.sin(angle) * r;
        return [x, zone.floorY + 1.5, z];
    }

    // AABB: random point with 1-unit margin from walls
    const margin = 1;
    const x = (zone.minX + margin) + Math.random() * (zone.maxX - zone.minX - margin * 2);
    const z = (zone.minZ + margin) + Math.random() * (zone.maxZ - zone.minZ - margin * 2);
    return [x, zone.floorY + 1.5, z];
}

// ── Enemy Type Generation ─────────────────────────────────────────────

const randomLevel = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

/** Roll an enemy type + level from the zone's config */
export function rollEnemyForZone(id: string): { type: EnemyType; level: number } | null {
    const zone = registry.get(id);
    if (!zone || zone.enemies.length === 0) return null;

    // French horn special roll (global cap handled by spawner)
    if (zone.frenchHornChance && zone.frenchHornLevelRange && Math.random() < zone.frenchHornChance) {
        return {
            type: 'french_horn',
            level: randomLevel(zone.frenchHornLevelRange[0], zone.frenchHornLevelRange[1]),
        };
    }

    // Weighted random selection
    const totalWeight = zone.enemies.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const entry of zone.enemies) {
        roll -= entry.weight;
        if (roll <= 0) {
            return {
                type: entry.type,
                level: randomLevel(entry.levelRange[0], entry.levelRange[1]),
            };
        }
    }

    // Fallback: last entry
    const last = zone.enemies[zone.enemies.length - 1];
    return { type: last.type, level: randomLevel(last.levelRange[0], last.levelRange[1]) };
}

/**
 * Returns collision boundary data for a zone to pass to enemies.
 */
export function getZoneBoundary(id: string): any | null {
    const zone = registry.get(id);
    if (!zone) return null;

    if (zone.shape === 'circle') {
        return {
            arenaCenter: [zone.centerX || 0, zone.floorY || 0, zone.centerZ || 0],
            radius: zone.radius || 10
        };
    }

    // AABB rooms treated as non-rotated RectangleBoundaries
    return {
        centerX: (zone.minX + zone.maxX) / 2,
        centerZ: (zone.minZ + zone.maxZ) / 2,
        width: zone.maxX - zone.minX,
        length: zone.maxZ - zone.minZ,
        angle: 0
    };
}
