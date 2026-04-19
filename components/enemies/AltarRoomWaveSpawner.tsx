'use client';

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import { usePlayerStore, useGameStore } from '@/lib/store';
import { Trumpet } from './Trumpet';
import { Trombone } from './Trombone';
import { Tuba } from './Tuba';
import { FrenchHorn } from './FrenchHorn';
import { Euphonium } from './Euphonium';
import AudioManager from '@/lib/audio/AudioManager';
import { getAltarRadius, getAltarCenterZ, getAltarTriggerZ, getAltarExitZ } from '@/lib/game/altarGeometry';
import { getAltarCompletionDrops } from '@/lib/enemies/enemyDrops';
import { useInventoryStore } from '@/lib/store/inventoryStore';

type EnemyType = 'trumpet' | 'trombone' | 'tuba' | 'french_horn' | 'euphonium';

interface Enemy {
    id: string;
    type: EnemyType;
    position: [number, number, number];
    level: number;
    isDead?: boolean;
}

const MAX_WAVES = 5;

// Shared configuration per wave
interface WaveConfig {
    level: number;
    quota: number;
    minActive: number;
    types: EnemyType[];
}

const WAVES_CONFIG: Record<number, { levelMult: number, quota: number, minActive: number, types: EnemyType[] }> = {
    1: { levelMult: 1.0, quota: 8, minActive: 8, types: ['trumpet', 'trombone'] },
    2: { levelMult: 1.1, quota: 16, minActive: 12, types: ['trumpet', 'trombone', 'french_horn'] },
    3: { levelMult: 1.2, quota: 24, minActive: 16, types: ['trumpet', 'trombone', 'french_horn', 'tuba'] },
    4: { levelMult: 1.35, quota: 32, minActive: 20, types: ['trumpet', 'trombone', 'french_horn', 'tuba', 'euphonium'] },
    5: { levelMult: 1.5, quota: 40, minActive: 24, types: ['trumpet', 'trombone', 'tuba', 'french_horn', 'euphonium'] }
};

let waveEnemyIdCounter = 0;
function generateEnemyId(currentWave: number): string {
    return `wave-enemy-${currentWave}-${waveEnemyIdCounter++}-${Math.random().toString(36).substr(2, 9)}`;
}

export const AltarRoomWaveSpawner = memo(function AltarRoomWaveSpawner({ index = 0 }: { index?: number }) {
    const altarCenterZ = getAltarCenterZ(index);
    const roomRadius = getAltarRadius(index);
    const triggerZ = getAltarTriggerZ(index);
    const nextRoomTriggerZ = getAltarTriggerZ(index + 1);
    const altarLevelBase = 100 * (index + 1);

    // Statue ring for spawning
    const statueRadius = roomRadius - 12.5;

    // Remove reactive currentAltarIndex hook for performance
    // const currentAltarIndex = useGameStore(state => state.currentAltarIndex);
    const setAltarIndex = useGameStore(state => state.setAltarIndex);

    // 0 = Not started, 1-5 = Active running wave, 6 = Completed
    const [currentWave, setCurrentWave] = useState(0);
    const [enemies, setEnemies] = useState<Enemy[]>([]);

    // State machine flags
    const hasTriggeredInitial = useRef(false);
    const isSpawning = useRef(false);
    const isBufferPhase = useRef(false);

    // Timer refs
    const initialWaveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const bufferTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Wave progress tracking
    const totalSpawnedInWave = useRef(0);
    const totalDefeatedInWave = useRef(0);
    const waveQuota = useRef(0);
    const lastReinforcementTime = useRef(0);
    const processedDeaths = useRef(new Set<string>());

    // Helper to spawn a single enemy at a random statue
    // Helper to spawn a single enemy at a random statue
    const spawnIndividualEnemy = useCallback((waveNum: number) => {
        const config = WAVES_CONFIG[waveNum];
        const statueIndex = Math.floor(Math.random() * 8);
        const angle = (statueIndex / 8) * Math.PI * 2 + Math.PI / 8;

        const position: [number, number, number] = [
            Math.sin(angle) * statueRadius,
            1,
            altarCenterZ + Math.cos(angle) * statueRadius
        ];

        const randomType = config.types[Math.floor(Math.random() * config.types.length)];
        const variance = Math.floor(Math.random() * 10) - 5;
        const targetLevel = Math.floor(altarLevelBase * config.levelMult);

        const newEnemy = {
            id: generateEnemyId(waveNum),
            type: randomType,
            position,
            level: Math.max(1, targetLevel + variance)
        };

        setEnemies(prev => [...prev, newEnemy]);
        totalSpawnedInWave.current++;
    }, []);

    // Spawn a specific wave
    const spawnWave = useCallback((waveNum: number) => {
        if (waveNum > MAX_WAVES) return;

        isSpawning.current = true;
        isBufferPhase.current = false;

        const config = WAVES_CONFIG[waveNum];
        waveQuota.current = config.quota;
        totalSpawnedInWave.current = 0;
        totalDefeatedInWave.current = 0;
        processedDeaths.current.clear();

        const newEnemies: Enemy[] = [];

        // Spawn initial batch (up to minActive)
        for (let i = 0; i < config.minActive; i++) {
            const statueIndex = i % 8; // Distribute initially
            const angle = (statueIndex / 8) * Math.PI * 2 + Math.PI / 8;

            const position: [number, number, number] = [
                Math.sin(angle) * statueRadius,
                1,
                altarCenterZ + Math.cos(angle) * statueRadius
            ];

            const randomType = config.types[Math.floor(Math.random() * config.types.length)];
            const variance = Math.floor(Math.random() * 10) - 5;

            newEnemies.push({
                id: generateEnemyId(waveNum),
                type: randomType,
                position,
                level: Math.max(1, Math.floor(altarLevelBase * config.levelMult) + variance)
            });
        }

        // Play spawn noise
        AudioManager.play('trumpet-fanfare', 'sfx', { volume: 0.6 });

        // Staggered addition to state to prevent FPS spikes (only for large waves)
        const totalToSpawn = newEnemies.length;
        totalSpawnedInWave.current = totalToSpawn;
        setCurrentWave(waveNum);
        useGameStore.getState().setAltarRoomWave(waveNum);
        useGameStore.getState().setAltarRitualStarted(true);
        useGameStore.getState().setAltarRoomWaveEnemies(config.quota, config.quota);

        if (totalToSpawn <= 24) {
            // Spawn all at once for smaller waves
            setEnemies(newEnemies);
            isSpawning.current = false;
        } else {
            // Stagger for very large waves
            setEnemies([]); // Clear current first
            let currentIndex = 0;
            const addNextBatch = () => {
                setEnemies(prev => {
                    const nextI = Math.min(currentIndex + 2, totalToSpawn);
                    const slice = newEnemies.slice(currentIndex, nextI);
                    currentIndex = nextI;

                    if (currentIndex < totalToSpawn) {
                        requestAnimationFrame(addNextBatch);
                    } else {
                        isSpawning.current = false;
                    }
                    return [...prev, ...slice];
                });
            };
            requestAnimationFrame(addNextBatch);
        }
    }, [altarCenterZ, altarLevelBase, statueRadius]);

    // Monitor for initial trigger
    useFrame((state) => {
        // PERF: Skip entire frame if simulation is paused
        if (!useGameStore.getState().simulationActive) return;

        // Optimization: Throttled check for distant spawners
        const nowMs = Date.now();
        const playerPos = usePlayerStore.getState().position;
        const distFromCenter = Math.abs(playerPos[2] - altarCenterZ);

        // If very far, skip logic entirely (every frame)
        if (distFromCenter > 1000) return;

        // If somewhat far, throttle to every 5 frames
        if (distFromCenter > 300 && state.clock.getElapsedTime() * 60 % 5 !== 0) return;

        const store = useGameStore.getState();
        const currentAltarIndex = store.currentAltarIndex;
        const exitZ = altarCenterZ + roomRadius;
        const isCurrentlyInZone = playerPos[2] > triggerZ && playerPos[2] < nextRoomTriggerZ;
        const isPhysicallyInRoom = playerPos[2] > triggerZ && playerPos[2] < exitZ;
        const wasInRoom = store.isInAltarRoom;

        // Hijack currentAltarIndex if we are in this zone but the store thinks we are elsewhere
        if (isCurrentlyInZone && index !== currentAltarIndex) {
            setAltarIndex(index);
        }

        if (isCurrentlyInZone !== wasInRoom && index === currentAltarIndex) {
            store.setIsInAltarRoom(isCurrentlyInZone);
            if (isCurrentlyInZone) {
                // Force stop the hub music when entering the altar
                AudioManager.stop('bg-ambience');
            }
        }

        // Check for transition to NEXT altar
        if (index === currentAltarIndex && currentWave > MAX_WAVES && playerPos[2] > nextRoomTriggerZ) {
            setAltarIndex(index + 1);
            store.setAltarRoomWave(0);
            // reset local state too
            setCurrentWave(0);
            hasTriggeredInitial.current = false;
            return;
        }

        // Monitor for initial trigger
        if (currentWave === 0 && isPhysicallyInRoom) {
            // Check if we already have a timer or if we're in the middle of launching
            if (!initialWaveTimerRef.current && !hasTriggeredInitial.current) {
                hasTriggeredInitial.current = true;

                const isTempoActive = usePlayerStore.getState().tempo > 0;

                initialWaveTimerRef.current = setTimeout(() => {
                    spawnWave(1);
                    initialWaveTimerRef.current = null;
                }, isTempoActive ? 0 : 10000);

                // Immediately mark as started so barriers close
                store.setAltarRitualStarted(true);
            }
        }

        // Reset logic: if player leaves room backwards (and ritual hasn't fully started waves yet), reset our triggers
        if (currentWave === 0 && hasTriggeredInitial.current && playerPos[2] <= triggerZ) {
            hasTriggeredInitial.current = false;
            store.setAltarRitualStarted(false);
        }

        // Repeatable logic: if wave is 6 (Completed) and player has left the room, reset to 0 to allow re-entry
        if (currentWave > MAX_WAVES && playerPos[2] < triggerZ - 50) {
            setCurrentWave(0);
            store.setAltarRoomWave(0);
            hasTriggeredInitial.current = false;
        }

        // Reinforcement logic
        if (currentWave > 0 && currentWave <= MAX_WAVES && !isSpawning.current && !isBufferPhase.current) {
            const config = WAVES_CONFIG[currentWave];
            const activeEnemiesCount = enemies.filter(e => !e.isDead).length;

            // Refill to minActive if we have quota left, but throttle to 1 every 500ms
            if (activeEnemiesCount < config.minActive && totalSpawnedInWave.current < config.quota) {
                if (nowMs - lastReinforcementTime.current > 500) {
                    spawnIndividualEnemy(currentWave);
                    lastReinforcementTime.current = nowMs;
                }
            }
        }
    });

    // Cleanup for initial wave timer if component unmounts
    useEffect(() => {
        return () => {
            if (initialWaveTimerRef.current) {
                clearTimeout(initialWaveTimerRef.current);
                initialWaveTimerRef.current = null;
            }
        };
    }, []);


    // Monitor wave completion and trigger buffers
    useEffect(() => {
        // Wave is "complete" when all enemies are dead AND we've spawned all we intended to
        // CRITICAL FIX: Add isSpawning.current check to prevent early wave termination
        const activeEnemiesCount = enemies.filter(e => !e.isDead).length;
        if (currentWave > 0 && currentWave <= MAX_WAVES && activeEnemiesCount === 0 && totalSpawnedInWave.current >= waveQuota.current && !isSpawning.current) {
            // Use refs for immediate state checks to avoid stale closures
            if (isSpawning.current || isBufferPhase.current) {
                return;
            }

            // Clear any previous buffer timer if this effect re-runs for some reason
            if (bufferTimerRef.current) {
                clearTimeout(bufferTimerRef.current);
                bufferTimerRef.current = null;
            }

            if (currentWave === MAX_WAVES) {
                // Completed all waves!
                setCurrentWave(MAX_WAVES + 1); // Mark as completed
                useGameStore.getState().setAltarRoomWave(MAX_WAVES + 1);
                useGameStore.getState().setAltarRitualStarted(false); // Clear ritual started flag

                // Grant Altar Completion Rewards
                const levelMult = index + 1;
                usePlayerStore.getState().collectEchoes(100 * levelMult);
                useGameStore.getState().collectGold(50 * levelMult);

                const drops = getAltarCompletionDrops(index);
                useInventoryStore.getState().addMaterials(drops);

                // Crystal Mouthpiece Drop System
                if (index >= 1) { // Starts at Altar 2 (index 1)
                    const dropChance = 0.10 + (index - 1) * 0.01;
                    if (Math.random() < dropChance) {
                        const maxBonusLevel = index - 1;
                        const bonusLevel = Math.floor(Math.random() * (maxBonusLevel + 1));
                        useInventoryStore.getState().obtainMouthpiece('crystal', 1 + bonusLevel);
                    }
                }

                // Optional: Trigger a victory sound or reward here
            } else {
                // Trigger next wave buffer
                isBufferPhase.current = true; // Set buffer phase flag
                const nextWave = currentWave + 1;

                bufferTimerRef.current = setTimeout(() => {
                    spawnWave(nextWave);
                    bufferTimerRef.current = null; // Clear ref after execution
                }, 5000);
            }
        }

        // Cleanup function for the buffer timer
        return () => {
            if (bufferTimerRef.current) {
                clearTimeout(bufferTimerRef.current);
                bufferTimerRef.current = null;
            }
        };
    }, [enemies, currentWave, spawnWave]); // Dependencies: enemies, currentWave, and spawnWave (which is useCallback)

    // Auto-reset room after 1 minute if player stays in room seeing "Ritual Complete"
    useEffect(() => {
        if (currentWave > MAX_WAVES) {
            const timer = setTimeout(() => {
                const pos = usePlayerStore.getState().position;
                const isCurrentlyInRoom = pos[2] > triggerZ;

                if (isCurrentlyInRoom) {
                    useGameStore.getState().setAltarRoomWave(0);
                    setCurrentWave(0);
                    hasTriggeredInitial.current = false;
                }
            }, 60000); // 1 minute
            return () => clearTimeout(timer);
        }
    }, [currentWave]);


    // Reset if player dies and respawns outside the room
    // The player respawns ON the altar now. So we KEEP the wave active if they die!
    // They are trapped in the wave gauntlet.
    // UNLESS they reach 10 deaths, then playerStore will reset currentWave to 0.

    const currentWaveRef = useRef(currentWave);
    currentWaveRef.current = currentWave;

    // Separate cleanup effect for room change
    useEffect(() => {
        const store = useGameStore.getState();
        if (index !== store.currentAltarIndex && enemies.length > 0) {
            setEnemies([]);
        }
    }, [index, enemies.length]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'n') {
                const state = useGameStore.getState();
                // Only act if we are the current active altar
                if (index !== state.currentAltarIndex) return;

                const pos = usePlayerStore.getState().position;
                const isOutside = pos[2] < triggerZ; // triggerZ is the start of the circular room

                console.log(`[AltarReset] 'N' pressed. Index: ${index}, isOutside: ${isOutside}, currentWave: ${currentWaveRef.current}`);

                if (isOutside) {
                    // CLEAR the room (Mark as completed) - Barriers will open
                    console.log(`[AltarReset] Clearing Room ${index} (Skip)`);
                    state.setAltarRoomWave(MAX_WAVES + 1);
                    state.setAltarRitualStarted(false);
                    state.setAltarRoomWaveEnemies(0, 0);

                    setEnemies([]);
                    setCurrentWave(MAX_WAVES + 1);
                    hasTriggeredInitial.current = false;
                    isSpawning.current = false;
                    isBufferPhase.current = false;
                    processedDeaths.current.clear();
                } else {
                    // RESET the room - Keep barriers (handled by AltarRoom.tsx using altarRitualStarted)
                    console.log(`[AltarReset] Resetting Room ${index} Ritual`);
                    state.setAltarRoomWave(0);
                    state.setAltarRitualStarted(true); // Stay started so barriers remain
                    state.setAltarRoomWaveEnemies(0, 0);

                    setEnemies([]);
                    setCurrentWave(0);
                    hasTriggeredInitial.current = true; // Stay triggered for 10s countdown
                    isSpawning.current = false;
                    isBufferPhase.current = false;
                    processedDeaths.current.clear();

                    // Optional: restart the timer? 
                    // The useFrame logic will see trigger=true and wave=0 and restart the timer if we null it
                }

                if (bufferTimerRef.current) {
                    clearTimeout(bufferTimerRef.current);
                    bufferTimerRef.current = null;
                }
                if (initialWaveTimerRef.current) {
                    clearTimeout(initialWaveTimerRef.current);
                    initialWaveTimerRef.current = null;
                }

                AudioManager.play('death', 'sfx', { volume: 0.5 });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [index, triggerZ]);

    useEffect(() => {
        const unsubscribe = useGameStore.subscribe(
            (state) => state.altarRoomWave,
            (newWave) => {
                const state = useGameStore.getState();
                if (newWave === 0 && currentWaveRef.current !== 0) {
                    setEnemies([]);
                    setCurrentWave(0);
                    hasTriggeredInitial.current = false;
                    isSpawning.current = false;
                    isBufferPhase.current = false;
                    processedDeaths.current.clear();
                    if (bufferTimerRef.current) {
                        clearTimeout(bufferTimerRef.current);
                        bufferTimerRef.current = null;
                    }
                    if (initialWaveTimerRef.current) {
                        clearTimeout(initialWaveTimerRef.current);
                        initialWaveTimerRef.current = null;
                    }
                }
            }
        );
        return () => unsubscribe();
    }, []);


    const handleEnemyDeath = useCallback((id: string) => {
        // Dedup check OUTSIDE the updater — immune to React StrictMode double-invocation
        if (processedDeaths.current.has(id)) return;
        processedDeaths.current.add(id);

        // Defer removal from the React tree by a few frames
        // This distributes the unmounting overhead across multiple frames.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    // Soft delete: flag as dead to prevent Troika Text EventListener memory leak!
                    setEnemies(prev => prev.map(e => e.id === id ? { ...e, isDead: true } : e));

                    // Side effects outside the updater (runs exactly once per kill)
                    totalDefeatedInWave.current++;
                    const store = useGameStore.getState();
                    const remaining = Math.max(0, waveQuota.current - totalDefeatedInWave.current);
                    store.setAltarRoomWaveEnemies(remaining, waveQuota.current);
                });
            });
        });
    }, []);

    return (
        <group name="altar-wave-spawner">
            {enemies.map(enemy => {
                const commonProps = {
                    id: enemy.id,
                    initialPosition: enemy.position,
                    level: enemy.level,
                    onDeath: handleEnemyDeath,
                    arenaRadius: roomRadius,
                    arenaCenter: [0, 1.5, altarCenterZ] as [number, number, number],
                    teleportToCenterOnOOB: true
                };

                if (enemy.type === 'tuba') return <Tuba key={enemy.id} {...commonProps} />;
                if (enemy.type === 'french_horn') return <FrenchHorn key={enemy.id} {...commonProps} />;
                if (enemy.type === 'euphonium') return <Euphonium key={enemy.id} {...commonProps} />;
                if (enemy.type === 'trombone') return <Trombone key={enemy.id} {...commonProps} />;
                return <Trumpet key={enemy.id} {...commonProps} />;
            })}
        </group>
    );
});

export default AltarRoomWaveSpawner;
