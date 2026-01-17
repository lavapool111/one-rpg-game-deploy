'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Trumpet } from './Trumpet';
import { Trombone } from './Trombone';
import { Tuba } from './Tuba';
import { usePlayerStore } from '@/lib/store';
import { Pillar } from '@/lib/game/pillars';

/**
 * CorridorSpawner Component
 * 
 * Spawns enemies in the 4 corridors extending from the Band Room:
 * - North (Forward): Trumpets/Trombones at player level ±3
 * - South (Back): Empty (future dungeon)
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
const MAX_ENEMIES_PER_CORRIDOR = 5;

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
    const playerPosition = usePlayerStore((state) => state.position);

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
    const getCorridorProximity = useCallback((): { corridor: CorridorName | null; distance: number } => {
        const [px, , pz] = playerPosition;

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
    }, [playerPosition, corridorEntrances]);

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

    // Generate enemies for a specific corridor
    const generateCorridorEnemies = useCallback((corridor: CorridorName): Enemy[] => {
        const newEnemies: Enemy[] = [];

        // South corridor is empty (future dungeon)
        if (corridor === 'south') {
            return [];
        }

        // East and West: Level 15 and Level 30 Tubas
        if (corridor === 'east' || corridor === 'west') {
            for (let i = 0; i < MAX_ENEMIES_PER_CORRIDOR; i++) {
                const level = Math.random() < 0.5 ? 15 : 30;
                newEnemies.push({
                    id: generateCorridorEnemyId(),
                    type: 'tuba',
                    position: getCorridorSpawnPosition(corridor),
                    level,
                });
            }
            return newEnemies;
        }

        // North (Forward): Trumpets and Trombones at player level ±3
        if (corridor === 'north') {
            for (let i = 0; i < MAX_ENEMIES_PER_CORRIDOR; i++) {
                const levelOffset = Math.floor(Math.random() * 7) - 3; // -3 to +3
                const level = Math.max(1, playerLevel + levelOffset);
                const type: EnemyType = Math.random() < 0.5 ? 'trumpet' : 'trombone';

                newEnemies.push({
                    id: generateCorridorEnemyId(),
                    type,
                    position: getCorridorSpawnPosition(corridor),
                    level,
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

    // Check player proximity and spawn/despawn enemies
    useEffect(() => {
        if (!enabled) return;

        const { corridor: nearestCorridor, distance } = getCorridorProximity();

        // Only despawn if player is far from the active corridor
        if (activeCorridor && nearestCorridor !== activeCorridor && distance > CORRIDOR_DESPAWN_DISTANCE) {
            setEnemies([]);
            setActiveCorridor(null);
            return;
        }

        // Spawn enemies if player enters a corridor zone (and it hasn't been cleared)
        if (nearestCorridor && distance < CORRIDOR_SPAWN_DISTANCE && nearestCorridor !== activeCorridor) {
            // Spawn corridor enemies (if not already spawned this session)
            if (!hasSpawnedRef.current[nearestCorridor]) {
                const newEnemies = generateCorridorEnemies(nearestCorridor);
                setEnemies(newEnemies);
                hasSpawnedRef.current[nearestCorridor] = true;
            }
            setActiveCorridor(nearestCorridor);
        }
    }, [enabled, getCorridorProximity, activeCorridor, generateCorridorEnemies]);

    // Reset spawned flags when player dies or resets
    useEffect(() => {
        const unsubscribe = usePlayerStore.subscribe((state, prevState) => {
            // Reset when health goes from 0 to full (respawn)
            if (prevState.health <= 0 && state.health > 0) {
                hasSpawnedRef.current = {
                    north: false,
                    south: false,
                    east: false,
                    west: false,
                };
                setEnemies([]);
                setActiveCorridor(null);
            }
        });
        return unsubscribe;
    }, []);

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
                    />
                );
            })}
        </group>
    );
}

export default CorridorSpawner;
