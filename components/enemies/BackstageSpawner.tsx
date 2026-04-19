'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Trumpet } from './Trumpet';
import { Trombone } from './Trombone';
import { Tuba } from './Tuba';
import { FrenchHorn } from './FrenchHorn';
import { Euphonium } from './Euphonium';
import { UpperVaultEuphonium } from './UpperVaultEuphonium';
import { usePlayerStore, useGameStore } from '@/lib/store';
import { Pillar } from '@/lib/game/pillars';
import {
    getAllSpawnZones,
    getRandomPositionInZone,
    rollEnemyForZone,
    EnemyType
} from '@/lib/game/spawnZoneRegistry';

/**
 * BackstageSpawner Component
 *  
 * Dynamically spawns enemies based on registered components (Rooms, Hallways).
 * fixed spawns (Guardians, specific Tubas) remain hardcoded here.
 * 
 * Fixed Tuba spawns (respawn after 5 seconds):
 * - Left Corridor: Level 20 Tuba at [-135, 1.5, 0]
 * - Right Corridor: Level 10 Tuba at [135, 1.5, 0]
 * - Underground Room: Level 30 Tuba at [0, -18.5, 235]
 * - Prison Cell tubas (handled separately)
 * 
 * Config:
 * - Max 5 enemies per corridor
 * - Spawns once per run (reset on death)
 * - Proximity trigger: configurable per zone (default 35 ft)
 */

interface Enemy {
    id: string;
    type: EnemyType;
    position: [number, number, number];
    level: number;
    zoneId?: string; // which spawn zone it belongs to (for respawns)
    maxRangeFromSpawn?: number;
}

interface BackstageSpawnerProps {
    enabled?: boolean;
    pillars?: Pillar[];
}



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
    const [_activeZone, setActiveZone] = useState<string | null>(null);
    const hasSpawnedRef = useRef<Set<string>>(new Set());
    const respawnTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const fixedRespawnTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

    const generateEnemies = useCallback((zoneId: string, currentEnemies: Enemy[], count: number): Enemy[] => {
        const newEnemies: Enemy[] = [];

        // Track local counts to apply French Horn global caps correctly
        let currentFrenchHorns = currentEnemies.filter(e => e.type === 'french_horn').length;

        for (let i = 0; i < count; i++) {
            let roll = rollEnemyForZone(zoneId);
            if (!roll) continue;

            const pos = getRandomPositionInZone(zoneId);
            if (!pos) continue;

            // Global French horn cap
            if (roll.type === 'french_horn') {
                if (currentFrenchHorns >= 5) {
                    // Fallback to tuba
                    roll.type = 'tuba';
                } else {
                    currentFrenchHorns++;
                }
            }

            newEnemies.push({
                id: generateEnemyId(zoneId),
                type: roll.type,
                level: roll.level,
                position: pos,
                zoneId,
            });
        }
        return newEnemies;
    }, []);

    // Handle Enemy Death
    // Handle Enemy Death
    const handleEnemyDeath = useCallback((id: string) => {
        // Defer removal from the React tree by a few frames
        // This distributes the unmounting overhead across multiple frames.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    // Handle fixed Tuba respawns (5 seconds)
                    if (id === 'fixed-tuba-left') {
                        const timer = setTimeout(() => setEnemies((prev) => {
                            if (prev.some(e => e.id === 'fixed-tuba-left')) return prev;
                            return [...prev, { id: 'fixed-tuba-left', type: 'tuba', level: 20, position: [-135, 1.5, 0] }];
                        }), 5000);
                        fixedRespawnTimers.current.push(timer);
                        setEnemies((prev) => prev.filter((e) => e.id !== id));
                        return;
                    } else if (id === 'fixed-tuba-right') {
                        const timer = setTimeout(() => setEnemies((prev) => {
                            if (prev.some(e => e.id === 'fixed-tuba-right')) return prev;
                            return [...prev, { id: 'fixed-tuba-right', type: 'tuba', level: 10, position: [135, 1.5, 0] }];
                        }), 5000);
                        fixedRespawnTimers.current.push(timer);
                        setEnemies((prev) => prev.filter((e) => e.id !== id));
                        return;
                    } else if (id === 'fixed-tuba-underground') {
                        const timer = setTimeout(() => setEnemies((prev) => {
                            if (prev.some(e => e.id === 'fixed-tuba-underground')) return prev;
                            return [...prev, { id: 'fixed-tuba-underground', type: 'tuba', level: 30, position: [0, -18.5, 235] }];
                        }), 5000);
                        fixedRespawnTimers.current.push(timer);
                        setEnemies((prev) => prev.filter((e) => e.id !== id));
                        return;
                    }

                    if (id.startsWith('guardian')) {
                        // ... Guardian respawn logic same as before ...
                        if (id === 'guardian-tuba') {
                            setTimeout(() => setEnemies((prev) => [...prev, { id: 'guardian-tuba', type: 'tuba', level: 10, position: [-135, 1.5, 0] }]), 5000);
                        } else if (id === 'guardian-tuba-right') {
                            setTimeout(() => setEnemies((prev) => [...prev, { id: 'guardian-tuba-right', type: 'tuba', level: 25, position: [135, 1.5, 0] }]), 5000);
                        } else if (id === 'guardian-tuba-underground') {
                            setTimeout(() => setEnemies((prev) => [...prev, { id: 'guardian-tuba-underground', type: 'tuba', level: 30, position: [0, -18.5, 235] }]), 5000);
                        } else if (id.startsWith('guardian-euphonium-')) {
                            // Respawn euphonium guardians
                            const spawnPositions: Record<string, [number, number, number]> = {
                                'guardian-euphonium-1': [-244, 61.5, -24],
                                'guardian-euphonium-2': [-200, 61.5, -24],
                                'guardian-euphonium-3': [-244, 61.5, 24],
                                'guardian-euphonium-4': [-200, 61.5, 24]
                            };
                            setTimeout(() => setEnemies((prev) => [...prev, { id, type: 'euphonium', level: 30, position: spawnPositions[id], maxRangeFromSpawn: 10 }]), 5000);
                        }
                        setEnemies((prev) => prev.filter((e) => e.id !== id));
                        return;
                    }

                    // Standard Enemy Respawn Logic
                    setEnemies((prev) => {
                        const enemy = prev.find((e) => e.id === id);
                        const newEnemies = prev.filter((e) => e.id !== id);

                        if (enemy && enemy.zoneId) {
                            const zoneId = enemy.zoneId;
                            const remainingInZone = newEnemies.filter((e) => e.zoneId === zoneId).length;

                            // Track Trial Room kills
                            if (zoneId === 'deep_vault_lower') {
                                useGameStore.getState().incrementTrialRoomKills();
                            }

                            // Get registry config directly using dynamic import instead of full scope dependency hack
                            import('@/lib/game/spawnZoneRegistry').then(({ getSpawnZone }) => {
                                const config = getSpawnZone(zoneId);
                                if (!config) return;

                                const maxEnemies = config.maxEnemies ?? 5;
                                const respawnThreshold = config.respawnThreshold ?? 2;
                                const respawnDelay = config.respawnDelay ?? 10000;

                                // If less than threshold remaining and no respawn pending
                                if (remainingInZone < respawnThreshold && !respawnTimers.current[zoneId]) {
                                    console.log(`Respawing enemies for ${zoneId} in ${respawnDelay / 1000}s...`);
                                    respawnTimers.current[zoneId] = setTimeout(() => {
                                        setEnemies((current) => {
                                            const currentCount = current.filter((e) => e.zoneId === zoneId).length;
                                            if (currentCount < maxEnemies) {
                                                const needed = maxEnemies - currentCount;
                                                console.log(`Spawning ${needed} enemies for ${zoneId}`);
                                                const added = generateEnemies(zoneId, current, needed);
                                                return [...current, ...added];
                                            }
                                            return current;
                                        });
                                        delete respawnTimers.current[zoneId];
                                    }, respawnDelay);
                                }
                            });
                        }
                        return newEnemies;
                    });
                });
            });
        });
    }, [generateEnemies]);

    // Check proximity - Refactored to useFrame to avoid re-renders
    const lastCheckTime = useRef(0);

    useFrame((state) => {
        if (!enabled) return;
        const isInAltarRoom = useGameStore.getState().isInAltarRoom;
        if (isInAltarRoom) {
            if (enemies.length > 0) {
                setEnemies([]);
                hasSpawnedRef.current.clear();
            }
            return;
        }

        // Throttle checks to once every 200ms
        const now = state.clock.elapsedTime;
        if (now - lastCheckTime.current < 0.2) return;
        lastCheckTime.current = now;

        const [px, py, pz] = usePlayerStore.getState().position;
        let nearestZone: string | null = null;
        let nearestDistance = Infinity;

        // Iterate dynamic spawn zones
        for (const zone of getAllSpawnZones()) {
            const config = zone.triggerPoint;
            const dx = px - config.x;
            const dz = pz - config.z;
            const dy = config.y !== undefined ? py - config.y : 0;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (d < nearestDistance) {
                nearestDistance = d;
                nearestZone = zone.id;
            }
        }

        // Spawn logic - STAGGERED to avoid shader compilation stall
        if (nearestZone) {
            const zone = getAllSpawnZones().find(z => z.id === nearestZone);
            const triggerDist = zone?.triggerDistance ?? 35;

            if (nearestDistance < triggerDist) {
                if (!hasSpawnedRef.current.has(nearestZone)) {
                    hasSpawnedRef.current.add(nearestZone);
                    setActiveZone(nearestZone);

                    const maxEnemies = zone?.maxEnemies ?? 5;
                    // Generate enemies but spawn them one at a time to avoid GPU stall
                    const spawns = generateEnemies(nearestZone, enemies, maxEnemies);
                    spawns.forEach((spawn, index) => {
                        setTimeout(() => {
                            setEnemies((prev) => [...prev, spawn]);
                        }, index * 800); // 800ms delay between each spawn for better FPS
                    });
                }
            }
        }
    });

    // Initialize fixed Tuba spawns for Backstage Halls
    useEffect(() => {
        if (!enabled) return;

        // Fixed Tuba spawns: Left (level 20), Right (level 10), Underground (level 30)
        // Upper Vault Room Guardians: 4x Euphonium (level 30)
        const fixedTubas: Enemy[] = [
            { id: 'fixed-tuba-left', type: 'tuba', level: 20, position: [-135, 1.5, 0] },
            { id: 'fixed-tuba-right', type: 'tuba', level: 10, position: [135, 1.5, 0] },
            { id: 'fixed-tuba-underground', type: 'tuba', level: 30, position: [0, -18.5, 240] },
            { id: 'guardian-euphonium-1', type: 'euphonium', level: 30, position: [-244, 61.5, -24], maxRangeFromSpawn: 10 },
            { id: 'guardian-euphonium-2', type: 'euphonium', level: 30, position: [-200, 61.5, -24], maxRangeFromSpawn: 10 },
            { id: 'guardian-euphonium-3', type: 'euphonium', level: 30, position: [-244, 61.5, 24], maxRangeFromSpawn: 10 },
            { id: 'guardian-euphonium-4', type: 'euphonium', level: 30, position: [-200, 61.5, 24], maxRangeFromSpawn: 10 }
        ];

        // Only add fixed tubas if they don't already exist
        setEnemies(prev => {
            const existingIds = prev.map(e => e.id);
            const newTubas = fixedTubas.filter(tuba => !existingIds.includes(tuba.id));
            return [...prev, ...newTubas];
        });
    }, [enabled]);



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
                if (enemy.type === 'euphonium') {
                    if (enemy.id.startsWith('guardian-euphonium-')) {
                        return (
                            <UpperVaultEuphonium
                                key={enemy.id}
                                id={enemy.id}
                                position={enemy.position}
                                level={enemy.level}
                            />
                        );
                    }
                    return (
                        <Euphonium
                            key={enemy.id}
                            id={enemy.id}
                            initialPosition={enemy.position}
                            level={enemy.level}
                            onDeath={handleEnemyDeath}
                            pillars={pillars}
                            arenaRadius={1000}
                            maxRangeFromSpawn={50}
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
