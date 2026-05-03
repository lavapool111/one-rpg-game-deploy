'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Tuba } from './Tuba';
import { Trumpet } from './Trumpet';
import { Trombone } from './Trombone';
import { usePlayerStore, useGameStore } from '@/lib/store';
import { Pillar } from '@/lib/game/pillars';
import { RectangleBoundary } from '@/lib/enemies/enemyMovement';

/**
 * CorridorSpawner Component
 * 
 * Spawns enemies in the 4 corridors extending from the Band Room:
 * - North (Forward): Trumpets/Trombones at player level ±3
 * - South (Back): Backstage Halls, no enemies.
 * - East (Right): Tubas at Level 15 and 30
 * - West (Left): Tubas at Level 15 and 30
 * 
 * Performance optimizations:
 * - Only spawns when player is within 20 feet of corridor
 * - Only one corridor active at a time
 * - Max 12 enemies per corridor
 */

type EnemyType = 'trumpet' | 'trombone' | 'tuba';
type CorridorName = 'north' | 'south' | 'east' | 'west';

interface Enemy {
    id: string;
    type: EnemyType;
    position: [number, number, number];
    level: number;
    maxRangeFromSpawn?: number;
    rectangleBoundary?: RectangleBoundary;
}

interface CorridorSpawnerProps {
    arenaRadius?: number;
    enabled?: boolean;
    pillars?: Pillar[];
}

// Corridor definitions
const CORRIDORS = {
    north: { angle: 0, label: 'Forward Path' },        // +Z
    south: { angle: Math.PI, label: 'Back Path' },     // -Z (dungeon entrance - empty)
    east: { angle: Math.PI / 2, label: 'Right Path' }, // +X
    west: { angle: -Math.PI / 2, label: 'Left Path' }, // -X
};

const CORRIDOR_WIDTH = 10;
const CORRIDOR_LENGTH = 200;
const CORRIDOR_SPAWN_DISTANCE = 50; // How close player must be to corridor entrance to spawn
const CORRIDOR_DESPAWN_DISTANCE = 100; // How far player must be from corridor to despawn enemies
let MAX_ENEMIES_PER_CORRIDOR = 5;

// Generate enemy ID
let corridorEnemyIdCounter = 0;
function generateCorridorEnemyId(): string {
    return `corridor-enemy-${++corridorEnemyIdCounter}`;
}

export function CorridorSpawner({
    arenaRadius = 375,
    enabled = true,
    pillars = [],
}: CorridorSpawnerProps) {
    const [enemies, setEnemies] = useState<Enemy[]>([]);
    const [activeCorridor, setActiveCorridor] = useState<CorridorName | null>(null);
    const hasSpawnedRef = useRef<Record<CorridorName, boolean>>({
        north: false,
        south: false,
        east: false,
        west: false,
    });

    const playerLevel = usePlayerStore((state) => state.level);
    // REMOVED: const playerPosition = usePlayerStore((state) => state.position);
    // This hook caused re-renders every frame. We now use getState() in a throttled effect.

    // Get the entrance position for each corridor
    const corridorEntrances = useMemo(() => {
        return {
            north: { x: 0, z: arenaRadius },
            south: { x: 0, z: -arenaRadius },
            east: { x: arenaRadius, z: 0 },
            west: { x: -arenaRadius, z: 0 },
        };
    }, [arenaRadius]);

    // Check which corridor the player is near
    const getCorridorProximity = useCallback((pos: [number, number, number]): { corridor: CorridorName | null; distance: number } => {
        const [px, , pz] = pos;

        let nearestCorridor: CorridorName | null = null;
        let nearestDistance = Infinity;

        for (const [name, entrance] of Object.entries(corridorEntrances)) {
            const dx = px - entrance.x;
            const dz = pz - entrance.z;
            const distance = Math.sqrt(dx * dx + dz * dz);

            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestCorridor = name as CorridorName;
            }
        }

        return { corridor: nearestCorridor, distance: nearestDistance };
    }, [corridorEntrances]);

    // Generate spawn position within a corridor
    const getCorridorSpawnPosition = useCallback((corridor: CorridorName): [number, number, number] => {
        const config = CORRIDORS[corridor];
        const angle = config.angle;

        // Spawn along the corridor length (from entrance + 30m to near the end)
        const distanceAlongCorridor = 30 + Math.random() * (CORRIDOR_LENGTH - 60);

        // Random position within corridor width
        const lateralOffset = (Math.random() - 0.5) * (CORRIDOR_WIDTH - 2);

        // Calculate world position based on corridor direction
        const corridorCenterX = Math.sin(angle) * (arenaRadius + distanceAlongCorridor);
        const corridorCenterZ = Math.cos(angle) * (arenaRadius + distanceAlongCorridor);

        // Apply lateral offset perpendicular to corridor direction
        const perpAngle = angle + Math.PI / 2;
        const x = corridorCenterX + Math.sin(perpAngle) * lateralOffset;
        const z = corridorCenterZ + Math.cos(perpAngle) * lateralOffset;

        return [x, 1.5, z];
    }, [arenaRadius]);

    // Get rectangle boundary for a corridor
    const getRectangleBoundary = useCallback((corridor: CorridorName) => {
        const config = CORRIDORS[corridor];
        const angle = config.angle;
        const centerDist = arenaRadius + CORRIDOR_LENGTH / 2;
        const centerX = Math.sin(angle) * centerDist;
        const centerZ = Math.cos(angle) * centerDist;

        return {
            centerX,
            centerZ,
            width: CORRIDOR_WIDTH,
            length: CORRIDOR_LENGTH,
            angle
        };
    }, [arenaRadius]);

    // Generate enemies for a specific corridor
    const generateCorridorEnemies = useCallback((corridor: CorridorName): Enemy[] => {
        const newEnemies: Enemy[] = [];

        // South corridor is empty (future dungeon)
        // -z
        if (corridor === 'south') {
            return [];
        }

        // East and West: Level 15 and Level 30 Tubas
        // +x
        if (corridor === 'east') {
            const boundary = getRectangleBoundary(corridor);
            for (let i = 0; i < MAX_ENEMIES_PER_CORRIDOR; i++) {
                let level = 0
                const e = Math.random()
                level = Math.ceil(e * (playerLevel / 15)) * 15
                if (level < 10) level = 15
                newEnemies.push({
                    id: generateCorridorEnemyId(),
                    type: 'tuba',
                    position: getCorridorSpawnPosition(corridor),
                    level,
                    rectangleBoundary: boundary
                });
            }
            return newEnemies;
        }

        // -x

        if (corridor === 'west') {
            const boundary = getRectangleBoundary(corridor);
            for (let i = 0; i < 10; i++) {
                let level = 0
                const e = Math.random()
                level = Math.ceil(e * (playerLevel / 15)) * 15
                if (level < 10) level = 15
                let typeroll = Math.random()
                let lissy: EnemyType = "tuba"
                if (typeroll > 0.5) {
                    lissy = "tuba"
                } else {
                    lissy = "trombone"
                }
                newEnemies.push({
                    id: generateCorridorEnemyId(),
                    type: lissy,
                    position: getCorridorSpawnPosition(corridor),
                    level,
                    rectangleBoundary: boundary
                });
            }
            return newEnemies;
        }

        // North (Forward): Trumpets and Trombones at player level ±3 
        // +z
        if (corridor === 'north') {
            const boundary = getRectangleBoundary(corridor);
            for (let i = 0; i < MAX_ENEMIES_PER_CORRIDOR; i++) {
                const levelOffset = Math.floor(Math.random() * 7) - 3; // -3 to +3
                const level = Math.max(1, playerLevel + levelOffset);
                const type: EnemyType = Math.random() < 0.5 ? 'trumpet' : 'trombone';

                newEnemies.push({
                    id: generateCorridorEnemyId(),
                    type,
                    position: getCorridorSpawnPosition(corridor),
                    level,
                    rectangleBoundary: boundary
                });
            }
            return newEnemies;
        }

        return [];
    }, [playerLevel, getCorridorSpawnPosition]);

    // Handle enemy death
    const handleEnemyDeath = useCallback((id: string) => {
        setEnemies((prev) => prev.filter((e) => e.id !== id));
    }, []);

    // Helper for staggered spawning
    const staggeredSetEnemies = useCallback((newEnemies: Enemy[]) => {
        let currentIndex = 0;
        const batchSize = 2;

        const addBatch = () => {
            if (currentIndex >= newEnemies.length) return;

            const nextIndex = Math.min(currentIndex + batchSize, newEnemies.length);
            const batch = newEnemies.slice(currentIndex, nextIndex);

            setEnemies(prev => [...prev, ...batch]);
            currentIndex = nextIndex;

            if (currentIndex < newEnemies.length) {
                requestAnimationFrame(addBatch);
            }
        };

        requestAnimationFrame(addBatch);
    }, []);

    // Check player proximity and spawn/despawn enemies
    // Throttled to avoid performance impact of every-frame checks
    useEffect(() => {
        if (!enabled) return;

        const checkProximity = () => {
            const gameStore = useGameStore.getState();
            if (!gameStore.simulationActive) return;
            if (gameStore.isInAltarRoom) {
                if (enemies.length > 0) {
                    setEnemies([]);
                    setActiveCorridor(null);
                }
                return;
            }
            const currentPos = usePlayerStore.getState().position;
            const { corridor: nearestCorridor, distance } = getCorridorProximity(currentPos);

            // Use refs or local variables to avoid closure over stale state
            // But activeCorridor is state, so we use the functional update pattern if needed
            // Actually, we can just read the current state from the effect if we include dependencies

            // Handle despawn
            if (activeCorridor && nearestCorridor !== activeCorridor && distance > CORRIDOR_DESPAWN_DISTANCE) {
                setEnemies([]);
                setActiveCorridor(null);
                return;
            }

            // Handle spawn
            if (nearestCorridor && distance < CORRIDOR_SPAWN_DISTANCE && nearestCorridor !== activeCorridor) {
                if (!hasSpawnedRef.current[nearestCorridor]) {
                    const newEnemies = generateCorridorEnemies(nearestCorridor);
                    staggeredSetEnemies(newEnemies);
                    hasSpawnedRef.current[nearestCorridor] = true;

                    if (newEnemies.length > 0) {
                        import('@/lib/audio/AudioManager').then((m) => {
                            const AudioManager = m.default;
                            AudioManager.load('trumpet-fanfare', '/audio/trumpet-fanfare-announcement-zeroframe-audio-2-1-00-03.mp3');
                            AudioManager.play('trumpet-fanfare', 'sfx', { volume: 0.5 });
                        });
                    }
                }
                setActiveCorridor(nearestCorridor);
            }
        };

        const interval = setInterval(checkProximity, 500); // Check every 500ms
        return () => clearInterval(interval);
    }, [enabled, activeCorridor, getCorridorProximity, generateCorridorEnemies]);

    // Respawn enemies after 10 seconds if all are dead and player is still in the corridor
    useEffect(() => {
        if (!enabled || !activeCorridor || activeCorridor === 'south') return;

        let one = 10000

        if (activeCorridor === 'east') {
            one = 5000
        }

        if (enemies.length === 0 && hasSpawnedRef.current[activeCorridor] && !useGameStore.getState().isInAltarRoom) {
            const respawnTimer = setTimeout(() => {
                staggeredSetEnemies(generateCorridorEnemies(activeCorridor));
            }, one);

            return () => clearTimeout(respawnTimer);
        }
    }, [enabled, activeCorridor, enemies.length, generateCorridorEnemies]);



    if (!enabled) return null;

    // Extended arena radius for corridor enemies (they move within corridors)
    const corridorArenaRadius = arenaRadius + CORRIDOR_LENGTH;

    return (
        <group>
            {enemies.map((enemy) => {
                if (enemy.type === 'tuba') {
                    return (
                        <Tuba
                            key={enemy.id}
                            id={enemy.id}
                            initialPosition={enemy.position}
                            level={enemy.level}
                            onDeath={handleEnemyDeath}
                            pillars={pillars}
                            arenaRadius={corridorArenaRadius}
                            rectangleBoundary={enemy.rectangleBoundary}
                        />
                    );
                }
                if (enemy.type === 'trombone') {
                    return (
                        <Trombone
                            key={enemy.id}
                            id={enemy.id}
                            initialPosition={enemy.position}
                            level={enemy.level}
                            onDeath={handleEnemyDeath}
                            pillars={pillars}
                            arenaRadius={corridorArenaRadius}
                            rectangleBoundary={enemy.rectangleBoundary}
                        />
                    );
                }
                return (
                    <Trumpet
                        key={enemy.id}
                        id={enemy.id}
                        initialPosition={enemy.position}
                        level={enemy.level}
                        onDeath={handleEnemyDeath}
                        pillars={pillars}
                        arenaRadius={corridorArenaRadius}
                        rectangleBoundary={enemy.rectangleBoundary}
                    />
                );
            })}
        </group>
    );
}

export default CorridorSpawner;
