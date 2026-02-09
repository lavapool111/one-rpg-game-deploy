'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Trumpet } from './Trumpet';
import { Trombone } from './Trombone';
import { Tuba } from './Tuba';
import { FrenchHorn } from './FrenchHorn';
import { usePlayerStore } from '@/lib/store';
import { Pillar } from '@/lib/game/pillars';

/**
 * BackstageSpawner Component
 * 
 * Spawns enemies in the 3 corridors of the Backstage Halls:
 * - Center (North): Trumpets/Trombones Lvl 3-8
 * - Right (East): Trumpets Lvl 3-5 (easier)
 * - Left (West): Trumpets/Trombones Lvl 6-8 (harder)
 * - Left Room: Tuba Guardian Lvl 10 (respawns)
 * 
 * Config:
 * - Max 5 enemies per corridor
 * - Spawns once per run (reset on death)
 * - Proximity trigger: < 25 feet
 */

type EnemyType = 'trumpet' | 'trombone' | 'tuba' | 'french_horn';
type CorridorName = 'center' | 'left' | 'right' | 'center_room' | 'underground' | 'left_extension';

interface Enemy {
    id: string;
    type: EnemyType;
    position: [number, number, number];
    level: number;
    corridor?: CorridorName;
}

interface BackstageSpawnerProps {
    enabled?: boolean;
    pillars?: Pillar[];
}

// Corridor trigger points (approximate start of corridor)
// Center starts at Z=25. Left at X=-25. Right at X=25.
const SPAWN_CONFIG = {
    center: { x: 0, z: 25, label: 'Center Path' },
    left: { x: -25, z: 0, label: 'Left Path' },
    right: { x: 25, z: 0, label: 'Right Path' },
    center_room: { x: 0, z: 155, label: 'Center Vault Room' },
    underground: { x: 0, z: 235, label: 'Underground Room' },
    left_extension: { x: -148.5, z: 40, label: 'Left South Extension' },
};

const SPAWN_TRIGGER_DISTANCE = 35; // Trigger when approaching entrance
const DESPAWN_DISTANCE = 150; // Despawn if far (e.g. valid while in hub or corridor)
const MAX_ENEMIES = 5;

let enemyIdCounter = 0;
function generateEnemyId(corridor: string): string {
    return `backstage-${corridor}-enemy-${Date.now()}-${++enemyIdCounter}`;
}

export function BackstageSpawner({
    enabled = true,
    pillars = [],
}: BackstageSpawnerProps) {
    const [enemies, setEnemies] = useState<Enemy[]>([]);

    // DEBUG: Verify enabled state
    useEffect(() => {
        console.log(`[BackstageSpawner] Mounted. Enabled: ${enabled}`);
    }, [enabled]);
    const [activeCorridor, setActiveCorridor] = useState<CorridorName | null>(null);
    const hasSpawnedRef = useRef<Record<CorridorName, boolean>>({
        center: false,
        left: false,
        right: false,
        center_room: false,
        underground: false,
        left_extension: false,
    });
    const respawnTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    // Generate random level in range [min, max]
    const randomLevel = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

    const generateEnemies = useCallback((corridor: CorridorName, currentEnemies: Enemy[], count: number = MAX_ENEMIES): Enemy[] => {
        const newEnemies: Enemy[] = [];

        for (let i = 0; i < count; i++) {
            let type: EnemyType = 'trumpet';
            let level = 1;
            let pos: [number, number, number] = [0, 1.5, 0];

            // Distance along corridor (10 to 80 units from start)
            const dist = 10 + Math.random() * 70;
            // Width offset (-4 to 4)
            const lateral = (Math.random() - 0.5) * 8;

            // Determine Enemy Type
            // Check for French Horn spawn (7.5% chance if level > 10)
            const roll = Math.random();

            // Check current active count + pending new spawns
            const currentFrenchHorns = currentEnemies.filter(e => e.type === 'french_horn').length;
            const pendingFrenchHorns = newEnemies.filter(e => e.type === 'french_horn').length;
            const canSpawnFrenchHorn = (currentFrenchHorns + pendingFrenchHorns) < 3;

            // 7.5% chance to spawn a French Horn (limit 3)
            if (roll < 0.075 && canSpawnFrenchHorn) {
                type = 'french_horn';
                if (corridor === 'left') {
                    level = randomLevel(4, 6);
                } else if (corridor === 'right') {
                    level = randomLevel(6, 12);
                } else { // center
                    level = randomLevel(10, 14);
                }
            } else {
                if (corridor === 'center') {
                    // Center (+Z): Trumpet/Trombone Lvl 3-5
                    type = Math.random() < 0.5 ? 'trumpet' : 'trombone';
                    level = randomLevel(3, 5);
                } else if (corridor === 'right') {
                    // Right (+X): Trumpet Lvl 8-12
                    type = 'trumpet';
                    level = randomLevel(8, 12);
                } else if (corridor === 'left') {
                    // Left (-X): Trumpet/Trombone Lvl 6-8
                    type = Math.random() < 0.5 ? 'trumpet' : 'trombone';
                    level = randomLevel(6, 8);
                } else if (corridor === 'center_room') {
                    // Center Vault Room: Trumpet/Trombone Lvl 12-20
                    type = Math.random() < 0.5 ? 'trumpet' : 'trombone';
                    level = randomLevel(12, 20);
                } else if (corridor === 'underground') {
                    // Underground Room: Trumpet/Trombone Lvl 12-20
                    type = Math.random() < 0.5 ? 'trumpet' : 'trombone';
                    level = randomLevel(12, 20);
                } else if (corridor === 'left_extension') {
                    // Left Extension: High level Trumpets/Trombones
                    type = Math.random() < 0.5 ? 'trumpet' : 'trombone';
                    level = randomLevel(16, 20);
                }
            }

            // Position assignment based on corridor
            if (corridor === 'center') {
                pos = [lateral, 1.5, 25 + dist];
            } else if (corridor === 'right') {
                pos = [25 + dist, 1.5, lateral];
            } else if (corridor === 'left') {
                pos = [-25 - dist, 1.5, lateral];
            } else if (corridor === 'center_room') {
                // Center Vault Room: spread across the room (X: -10 to 10, Z: 130 to 175)
                const roomX = (Math.random() - 0.5) * 20; // -10 to 10
                const roomZ = 130 + Math.random() * 45; // 130 to 175
                pos = [roomX, 1.5, roomZ];
            } else if (corridor === 'underground') {
                // Underground Room: spread across the room (X: -8 to 8, Z: 225 to 240)
                const roomX = (Math.random() - 0.5) * 16; // -8 to 8
                const roomZ = 225 + Math.random() * 15; // 225 to 240
                pos = [roomX, -18.5, roomZ]; // Y=-18.5 for underground room floor level
            } else if (corridor === 'left_extension') {
                // Left Extension Corridor: spread along Z (30 to 130), fixed X (~ -148.5)
                // World X is -148.5. Width is 14 (+/- 7).
                const widthOffset = (Math.random() - 0.5) * 10; // +/- 5
                const lengthOffset = 30 + Math.random() * 100; // Z=30 to 130
                pos = [-148.5 + widthOffset, 16.5, lengthOffset]; // Y=16.5 (Floor 15 + 1.5)
            }

            newEnemies.push({
                id: generateEnemyId(corridor),
                type,
                level,
                position: pos,
                corridor,
            });
        }
        return newEnemies;
    }, []);

    // Handle Enemy Death
    const handleEnemyDeath = useCallback((id: string) => {
        if (id.startsWith('guardian')) {
            // ... Guardian respawn logic same as before ...
            if (id === 'guardian-tuba') {
                setTimeout(() => setEnemies((prev) => [...prev, { id: 'guardian-tuba', type: 'tuba', level: 10, position: [-135, 1.5, 0] }]), 5000);
            } else if (id === 'guardian-tuba-right') {
                setTimeout(() => setEnemies((prev) => [...prev, { id: 'guardian-tuba-right', type: 'tuba', level: 25, position: [135, 1.5, 0] }]), 5000);
            } else if (id === 'guardian-tuba-underground') {
                setTimeout(() => setEnemies((prev) => [...prev, { id: 'guardian-tuba-underground', type: 'tuba', level: 30, position: [0, -18.5, 235] }]), 5000);
            }
            setEnemies((prev) => prev.filter((e) => e.id !== id));
            return;
        }

        // Standard Enemy Respawn Logic
        setEnemies((prev) => {
            const enemy = prev.find((e) => e.id === id);
            const newEnemies = prev.filter((e) => e.id !== id);

            if (enemy && enemy.corridor) {
                const corridor = enemy.corridor;
                const remainingInCorridor = newEnemies.filter((e) => e.corridor === corridor).length;

                // If less than 2 enemies remaining and no respawn pending
                if (remainingInCorridor < 2 && !respawnTimers.current[corridor]) {
                    console.log(`Respawing enemies for ${corridor} in 10s...`);
                    respawnTimers.current[corridor] = setTimeout(() => {
                        setEnemies((current) => {
                            const currentCount = current.filter((e) => e.corridor === corridor).length;
                            if (currentCount < MAX_ENEMIES) {
                                const needed = MAX_ENEMIES - currentCount;
                                console.log(`Spawning ${needed} enemies for ${corridor}`);
                                const added = generateEnemies(corridor, current, needed);
                                return [...current, ...added];
                            }
                            return current;
                        });
                        delete respawnTimers.current[corridor];
                    }, 10000); // 10 seconds delay
                }
            }
            return newEnemies;
        });
    }, [generateEnemies]);

    // Check proximity - Refactored to useFrame to avoid re-renders
    const lastCheckTime = useRef(0);

    useFrame((state) => {
        if (!enabled) return;

        // Throttle checks to once every 200ms
        const now = state.clock.elapsedTime;
        if (now - lastCheckTime.current < 0.2) return;
        lastCheckTime.current = now;

        const [px, , pz] = usePlayerStore.getState().position;
        let nearestCorridor: CorridorName | null = null;
        let nearestDistance = Infinity;

        for (const [name, config] of Object.entries(SPAWN_CONFIG)) {
            const dx = px - config.x;
            const dz = pz - config.z;
            const d = Math.sqrt(dx * dx + dz * dz);
            if (d < nearestDistance) {
                nearestDistance = d;
                nearestCorridor = name as CorridorName;
            }
        }

        // Spawn logic - STAGGERED to avoid shader compilation stall
        if (nearestCorridor && nearestDistance < SPAWN_TRIGGER_DISTANCE) {
            if (!hasSpawnedRef.current[nearestCorridor]) {
                hasSpawnedRef.current[nearestCorridor] = true;
                setActiveCorridor(nearestCorridor);

                // Generate enemies but spawn them one at a time to avoid GPU stall
                const spawns = generateEnemies(nearestCorridor, enemies);
                spawns.forEach((spawn, index) => {
                    setTimeout(() => {
                        setEnemies((prev) => [...prev, spawn]);
                    }, index * 100); // 100ms delay between each spawn
                });
            }
        }
    });

    // Reset on Player Death / Dungeon Reset
    useEffect(() => {
        const unsubscribe = usePlayerStore.subscribe((state, prevState) => {
            if (prevState.health <= 0 && state.health > 0) {
                hasSpawnedRef.current = { center: false, left: false, right: false, center_room: false, underground: false, left_extension: false };
                setEnemies([]);
                setActiveCorridor(null);
                // Clear timers
                Object.values(respawnTimers.current).forEach(clearTimeout);
                respawnTimers.current = {};
            }
        });
        return unsubscribe;
    }, []);

    if (!enabled) return null;

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
                            arenaRadius={1000}
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
                            arenaRadius={1000} // Large radius so they don't despawn
                        />
                    );
                }
                if (enemy.type === 'french_horn') {
                    return (
                        <FrenchHorn
                            key={enemy.id}
                            id={enemy.id}
                            initialPosition={enemy.position}
                            level={enemy.level}
                            onDeath={handleEnemyDeath}
                            pillars={pillars}
                            arenaRadius={1000}
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
                        arenaRadius={1000}
                    />
                );
            })}
        </group>
    );
}

export default BackstageSpawner;
