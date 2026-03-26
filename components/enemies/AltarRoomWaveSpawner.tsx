'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { usePlayerStore, useGameStore } from '@/lib/store';
import { Trumpet } from './Trumpet';
import { Trombone } from './Trombone';
import { Tuba } from './Tuba';
import { FrenchHorn } from './FrenchHorn';
import { Euphonium } from './Euphonium';
import AudioManager from '@/lib/audio/AudioManager';
import { getAltarRadius, getAltarCenterZ, getAltarTriggerZ } from '@/lib/game/altarGeometry';
import { getAltarCompletionDrops } from '@/lib/game/enemyDrops';
import { useInventoryStore } from '@/lib/store/inventoryStore';

type EnemyType = 'trumpet' | 'trombone' | 'tuba' | 'french_horn' | 'euphonium';

interface Enemy {
    id: string;
    type: EnemyType;
    position: [number, number, number];
    level: number;
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

export function AltarRoomWaveSpawner({ index = 0 }: { index?: number }) {
    const altarCenterZ = getAltarCenterZ(index);
    const roomRadius = getAltarRadius(index);
    const triggerZ = getAltarTriggerZ(index);
    const nextRoomTriggerZ = getAltarTriggerZ(index + 1);
    const altarLevelBase = 100 * (index + 1);

    // Statue ring for spawning
    const statueRadius = roomRadius - 12.5;

    const currentAltarIndex = useGameStore(state => state.currentAltarIndex);
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
        console.log(`[Wave ${waveNum}] Reinforcement spawned at statue ${statueIndex}. Total spawned: ${totalSpawnedInWave.current}/${config.quota}`);
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

        totalSpawnedInWave.current = newEnemies.length;
        setEnemies(newEnemies);
        setCurrentWave(waveNum);
        useGameStore.getState().setAltarRoomWave(waveNum);
        // Progress is Quota - Defeated. Initially Quota remaining.
        useGameStore.getState().setAltarRoomWaveEnemies(config.quota, config.quota);

        // Allow brief time for react state to settle before checking empty conditions
        setTimeout(() => {
            isSpawning.current = false;
        }, 1000);

    }, []);

    // Monitor for initial trigger
    useFrame(() => {
        // Only run logic if this spawner is for the current active altar
        if (index !== currentAltarIndex) return;

        const pos = usePlayerStore.getState().position;
        const isCurrentlyInRoom = pos[2] > triggerZ;
        const wasInRoom = useGameStore.getState().isInAltarRoom;

        if (isCurrentlyInRoom !== wasInRoom) {
            useGameStore.getState().setIsInAltarRoom(isCurrentlyInRoom);
        }

        // Check for transition to NEXT altar
        if (currentWave > MAX_WAVES && pos[2] > nextRoomTriggerZ) {
            console.log(`Transitioning from Altar ${index} to ${index + 1}`);
            setAltarIndex(index + 1);
            useGameStore.getState().setAltarRoomWave(0);
            // reset local state too
            setCurrentWave(0);
            hasTriggeredInitial.current = false;
            return;
        }

        // Monitor for initial trigger
        if (currentWave === 0 && pos[2] > triggerZ) {
            // Check if we already have a timer or if we're in the middle of launching
            if (!initialWaveTimerRef.current && !hasTriggeredInitial.current) {
                hasTriggeredInitial.current = true;
                console.log("Player entered Altar Room. Wave 1 starts in 10 seconds.");

                initialWaveTimerRef.current = setTimeout(() => {
                    spawnWave(1);
                    initialWaveTimerRef.current = null;
                }, 10000);
            }
        }

        // Reset logic: if wave is set back to 0 from the outside (like on 10 deaths), reset our triggers
        if (currentWave === 0 && hasTriggeredInitial.current && pos[2] <= triggerZ) {
            hasTriggeredInitial.current = false;
            console.log("Resetting altar spawner triggers because wave was reset and player is outside.");
        }

        // Repeatable logic: if wave is 6 (Completed) and player has left the room, reset to 0 to allow re-entry
        if (currentWave > MAX_WAVES && pos[2] < triggerZ - 50) {
            setCurrentWave(0);
            useGameStore.getState().setAltarRoomWave(0);
            hasTriggeredInitial.current = false;
            console.log("Altar Room cleared and player left. Resetting for repeatability.");
        }

        // Reinforcement logic
        if (currentWave > 0 && currentWave <= MAX_WAVES && !isSpawning.current && !isBufferPhase.current) {
            const config = WAVES_CONFIG[currentWave];
            const now = Date.now();

            // Refill to minActive if we have quota left, but throttle to 1 every 500ms
            if (enemies.length < config.minActive && totalSpawnedInWave.current < config.quota) {
                if (now - lastReinforcementTime.current > 500) {
                    spawnIndividualEnemy(currentWave);
                    lastReinforcementTime.current = now;
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
        if (currentWave > 0 && currentWave <= MAX_WAVES && enemies.length === 0 && totalSpawnedInWave.current >= waveQuota.current) {
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
                console.log("Altar Room Waves Defeated!");
                setCurrentWave(MAX_WAVES + 1); // Mark as completed
                useGameStore.getState().setAltarRoomWave(MAX_WAVES + 1);

                // Grant Altar Completion Rewards
                const levelMult = index + 1;
                usePlayerStore.getState().collectEchoes(100 * levelMult);
                useGameStore.getState().collectGold(50 * levelMult);

                const drops = getAltarCompletionDrops(index);
                useInventoryStore.getState().addMaterials(drops);

                // Optional: Trigger a victory sound or reward here
            } else {
                // Trigger next wave buffer
                isBufferPhase.current = true; // Set buffer phase flag
                const nextWave = currentWave + 1;
                console.log(`Wave ${currentWave} complete. Wave ${nextWave} starting in 5 seconds.`);

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
    }, [enemies.length, currentWave, spawnWave]); // Dependencies: enemies.length, currentWave, and spawnWave (which is useCallback)

    // Auto-reset room after 1 minute if player stays in room seeing "Ritual Complete"
    useEffect(() => {
        if (currentWave > MAX_WAVES) {
            console.log("Ritual complete. Auto-reset timer started (1 minute).");
            const timer = setTimeout(() => {
                const pos = usePlayerStore.getState().position;
                const isCurrentlyInRoom = pos[2] > triggerZ;

                if (isCurrentlyInRoom) {
                    console.log("Auto-resetting Altar Room after 1 minute of completion.");
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

    useEffect(() => {
        // Cleanup if this room is no longer the current focus
        if (index !== currentAltarIndex && enemies.length > 0) {
            console.log(`[AltarRoom ${index}] Cleaning up enemies as room is no longer active.`);
            setEnemies([]);
        }

        // Sync with external wave resets (like from 10 deaths logic)
        const unsubscribe = useGameStore.subscribe(
            (state) => state.altarRoomWave,
            (newWave) => {
                if (newWave === 0 && currentWave !== 0) {
                    console.log("Wave reset detected from store. Clearing enemies.");
                    setEnemies([]);
                    setCurrentWave(0);
                    hasTriggeredInitial.current = false;
                    isSpawning.current = false;
                    isBufferPhase.current = false;
                    if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
                    if (initialWaveTimerRef.current) clearTimeout(initialWaveTimerRef.current);
                }
            }
        );
        return () => unsubscribe();
    }, [index, currentAltarIndex, enemies.length, currentWave]);


    const handleEnemyDeath = useCallback((id: string) => {
        // Dedup check OUTSIDE the updater — immune to React StrictMode double-invocation
        if (processedDeaths.current.has(id)) return;
        processedDeaths.current.add(id);

        // Pure updater: only filter the array, no side effects
        setEnemies(prev => prev.filter(e => e.id !== id));

        // Side effects outside the updater (runs exactly once per kill)
        totalDefeatedInWave.current++;
        const store = useGameStore.getState();
        const remaining = Math.max(0, waveQuota.current - totalDefeatedInWave.current);
        store.setAltarRoomWaveEnemies(remaining, waveQuota.current);
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
}

export default AltarRoomWaveSpawner;
