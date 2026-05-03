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
import { getPlayerZone, isZoneVisible, DungeonZone } from '@/lib/game/zoneCulling';
import {
    getAllSpawnZones,
    getSpawnZone,
    getRandomPositionInZone,
    rollEnemyForZone,
    getZoneBoundary,
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
    boundary?: any;
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
    
    // Frame-delta based queues to replace setTimeouts
    const pendingSpawns = useRef<{ enemy: Enemy, targetTime: number }[]>([]);
    const pendingRespawns = useRef<{ zoneId: string, targetTime: number }[]>([]);

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

            const boundary = getZoneBoundary(zoneId);

            newEnemies.push({
                id: generateEnemyId(zoneId),
                type: roll.type,
                level: roll.level,
                position: pos,
                zoneId,
                boundary
            });
        }
        return newEnemies;
    }, []);

    // Handle Enemy Death
    // Handle Enemy Death
    const handleEnemyDeath = useCallback((id: string) => {
        // Defer removal from the React tree by a few frames
        requestAnimationFrame(() => {
            // Handle fixed Tuba respawns (5 seconds)
            const nowMs = Date.now();
            if (id === 'fixed-tuba-left') {
                pendingSpawns.current.push({
                    enemy: { id: 'fixed-tuba-left', type: 'tuba', level: 20, position: [-135, 1.5, 0], boundary: getZoneBoundary('left_corridor') },
                    targetTime: nowMs + 5000
                });
                setEnemies((prev) => prev.filter((e) => e.id !== id));
                return;
            } else if (id === 'fixed-tuba-right') {
                pendingSpawns.current.push({
                    enemy: { id: 'fixed-tuba-right', type: 'tuba', level: 10, position: [135, 1.5, 0], boundary: getZoneBoundary('right_corridor') },
                    targetTime: nowMs + 5000
                });
                setEnemies((prev) => prev.filter((e) => e.id !== id));
                return;
            } else if (id === 'fixed-tuba-underground') {
                pendingSpawns.current.push({
                    enemy: { id: 'fixed-tuba-underground', type: 'tuba', level: 30, position: [0, -18.5, 235], boundary: getZoneBoundary('underground_room') },
                    targetTime: nowMs + 5000
                });
                setEnemies((prev) => prev.filter((e) => e.id !== id));
                return;
            }

            if (id.startsWith('guardian')) {
                // ... Guardian respawn logic same as before ...
                if (id === 'guardian-tuba') {
                    pendingSpawns.current.push({ enemy: { id: 'guardian-tuba', type: 'tuba', level: 10, position: [-135, 1.5, 0] }, targetTime: nowMs + 5000 });
                } else if (id === 'guardian-tuba-right') {
                    pendingSpawns.current.push({ enemy: { id: 'guardian-tuba-right', type: 'tuba', level: 25, position: [135, 1.5, 0] }, targetTime: nowMs + 5000 });
                } else if (id === 'guardian-tuba-underground') {
                    pendingSpawns.current.push({ enemy: { id: 'guardian-tuba-underground', type: 'tuba', level: 30, position: [0, -18.5, 235] }, targetTime: nowMs + 5000 });
                } else if (id.startsWith('guardian-euphonium-')) {
                    // Respawn euphonium guardians
                    const spawnPositions: Record<string, [number, number, number]> = {
                        'guardian-euphonium-1': [-244, 61.5, -24],
                        'guardian-euphonium-2': [-200, 61.5, -24],
                        'guardian-euphonium-3': [-244, 61.5, 24],
                        'guardian-euphonium-4': [-200, 61.5, 24]
                    };
                    pendingSpawns.current.push({ enemy: { id, type: 'euphonium', level: 30, position: spawnPositions[id], maxRangeFromSpawn: 10 }, targetTime: nowMs + 5000 });
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

                        const respawnThreshold = config.respawnThreshold ?? 2;
                        const respawnDelay = config.respawnDelay ?? 10000;

                        // If less than threshold remaining and no respawn pending
                        const hasPendingRespawn = pendingRespawns.current.some(r => r.zoneId === zoneId);
                        if (remainingInZone < respawnThreshold && !hasPendingRespawn) {
                            console.log(`Respawing enemies for ${zoneId} in ${respawnDelay / 1000}s...`);
                            pendingRespawns.current.push({
                                zoneId,
                                targetTime: Date.now() + respawnDelay
                            });
                        }
                    });
                }
                return newEnemies;
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
        const playerZone = getPlayerZone(px, py, pz);
        const allZones = getAllSpawnZones();
        const nowRealMs = Date.now();

        // Perform ALL spawning and culling logic in a single atomic state update!
        setEnemies((prev) => {
            let next = [...prev];
            let changed = false;

            // --- PHASE 1: CULLING PASS ---
            // Remove enemies from non-visible zones immediately to free up global cap capacity.
            const culled = next.filter((enemy) => {
                if (!enemy.zoneId || enemy.id.startsWith('fixed') || enemy.id.startsWith('guardian')) {
                    return true;
                }
                if (!isZoneVisible(playerZone, enemy.zoneId as DungeonZone)) {
                    changed = true;
                    return false;
                }
                return true;
            });
            next = culled;

            // --- PHASE 2: PROCESS QUEUED RESPAWNS ---
            const readyRespawns = pendingRespawns.current.filter(t => nowRealMs >= t.targetTime);
            if (readyRespawns.length > 0) {
                pendingRespawns.current = pendingRespawns.current.filter(t => nowRealMs < t.targetTime);
                for (const task of readyRespawns) {
                    // Only respawn if the zone is actually visible
                    if (isZoneVisible(playerZone, task.zoneId as DungeonZone)) {
                        const zoneConf = getSpawnZone(task.zoneId);
                        if (!zoneConf) continue;
                        const maxEnemies = zoneConf.maxEnemies ?? 5;
                        const currentCount = next.filter(e => e.zoneId === task.zoneId).length;
                        
                        if (currentCount < maxEnemies && next.length < 25) {
                            const needed = Math.min(maxEnemies - currentCount, 25 - next.length);
                            if (needed > 0) {
                                const added = generateEnemies(task.zoneId, next, needed);
                                next.push(...added);
                                changed = true;
                            }
                        }
                    }
                }
            }

            // --- PHASE 3: PROCESS VISIBILITY SPAWNS ---
            for (const zone of allZones) {
                const zoneId = zone.id;
                
                // If zone is visible, it should be spawned or refilled
                if (isZoneVisible(playerZone, zoneId as DungeonZone)) {
                    const currentCount = next.filter(e => e.zoneId === zoneId).length;
                    const isRespawnPending = pendingRespawns.current.some(r => r.zoneId === zoneId);

                    // Trigger spawning if not previously spawned OR if refilling empty zone
                    if ((!hasSpawnedRef.current.has(zoneId) || (currentCount === 0 && !isRespawnPending)) && next.length < 25) {
                        hasSpawnedRef.current.add(zoneId);
                        
                        const maxEnemies = zone.maxEnemies ?? 5;
                        const needed = Math.min(maxEnemies, 25 - next.length);
                        
                        if (needed > 0) {
                            const added = generateEnemies(zoneId, next, needed);
                            next.push(...added);
                            changed = true;
                        }
                    }
                }
            }

            // --- PHASE 4: PROCESS FIXED SPAWNS (Guardians) ---
            const readyFixedSpawns = pendingSpawns.current.filter(t => nowRealMs >= t.targetTime);
            if (readyFixedSpawns.length > 0) {
                pendingSpawns.current = pendingSpawns.current.filter(t => nowRealMs < t.targetTime);
                for (const task of readyFixedSpawns) {
                    if (!next.some(e => e.id === task.enemy.id)) {
                        next.push(task.enemy);
                        changed = true;
                    }
                }
            }

            return changed ? next : prev;
        });
    });

    // Initialize fixed Tuba spawns for Backstage Halls
    useEffect(() => {
        if (!enabled) return;

        // Fixed Tuba spawns: Left (level 20), Right (level 10), Underground (level 30)
        // Upper Vault Room Guardians: 4x Euphonium (level 30)
        const fixedTubas: Enemy[] = [
            { id: 'fixed-tuba-left', type: 'tuba', level: 20, position: [-135, 1.5, 0], boundary: getZoneBoundary('left_corridor') },
            { id: 'fixed-tuba-right', type: 'tuba', level: 10, position: [135, 1.5, 0], boundary: getZoneBoundary('right_corridor') },
            { id: 'fixed-tuba-underground', type: 'tuba', level: 30, position: [0, -18.5, 240], boundary: getZoneBoundary('underground_room') },
            { id: 'guardian-euphonium-1', type: 'euphonium', level: 30, position: [-244, 61.5, -24], maxRangeFromSpawn: 10, boundary: getZoneBoundary('left_room_upper') },
            { id: 'guardian-euphonium-2', type: 'euphonium', level: 30, position: [-200, 61.5, -24], maxRangeFromSpawn: 10, boundary: getZoneBoundary('left_room_upper') },
            { id: 'guardian-euphonium-3', type: 'euphonium', level: 30, position: [-244, 61.5, 24], maxRangeFromSpawn: 10, boundary: getZoneBoundary('left_room_upper') },
            { id: 'guardian-euphonium-4', type: 'euphonium', level: 30, position: [-200, 61.5, 24], maxRangeFromSpawn: 10, boundary: getZoneBoundary('left_room_upper') }
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
                const sharedProps = {
                    initialPosition: enemy.position,
                    level: enemy.level,
                    onDeath: handleEnemyDeath,
                    pillars: pillars,
                    arenaCenter: enemy.boundary?.arenaCenter || [0, 0, 0],
                    arenaRadius: enemy.boundary?.radius || 1000,
                    rectangleBoundary: enemy.boundary?.width ? enemy.boundary : undefined
                };

                if (enemy.type === 'tuba') {
                    return (
                        <Tuba
                            key={enemy.id}
                            id={enemy.id}
                            {...sharedProps}
                        />
                    );
                }
                if (enemy.type === 'trombone') {
                    return (
                        <Trombone
                            key={enemy.id}
                            id={enemy.id}
                            {...sharedProps}
                        />
                    );
                }
                if (enemy.type === 'french_horn') {
                    return (
                        <FrenchHorn
                            key={enemy.id}
                            id={enemy.id}
                            {...sharedProps}
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
                            {...sharedProps}
                            maxRangeFromSpawn={50}
                        />
                    );
                }
                return (
                    <Trumpet
                        key={enemy.id}
                        id={enemy.id}
                        {...sharedProps}
                    />
                );
            })}
        </group>
    );
}

export default BackstageSpawner;
