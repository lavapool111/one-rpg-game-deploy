'use client';

import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/lib/store';
import { saveGame } from '@/lib/db';
import { useThree, useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';

/**
 * SaveManager Component
 * 
 * Logic-only component that handles:
 * 1. Syncing player position from 3D world to Store
 * 2. Listening for significant events to trigger Auto-Save
 * 3. Auto-save every 10 seconds
 * 4. Emergency save on tab close/visibility change
 */
export function SaveManager() {
    const { camera } = useThree();

    // Auto-save throttling (don't save too fast)
    const lastSaveTime = useRef(0);
    const SAVE_COOLDOWN = 2.0;

    // Subscribe to store changes to trigger save
    useEffect(() => {
        // Create save data from current state
        const getSaveData = () => {
            const player = usePlayerStore.getState();
            return {
                level: player.level,
                health: player.health,
                xp: player.xp,
                echoes: player.echoes,
                position: {
                    x: player.position[0],
                    y: player.position[1],
                    z: player.position[2]
                },
                // Full inventory including materials, reeds, and ligatures
                inventory: player.inventory,
                // Reed state
                equippedReed: player.equippedReed,
                reedDurability: player.reedDurability,
                // Embouchure stats
                embouchure: player.embouchure,
                embouchureXp: player.embouchureXp,
                // Dungeon upgrades
                dungeonTimeBonus: player.dungeonTimeBonus,
                // Ligature state
                equippedLigature: player.equippedLigature,
                // Player class
                playerClass: player.playerClass,
            };
        };

        // Throttled save for regular events (uses requestIdleCallback)
        const handleSave = () => {
            const now = Date.now();
            if (now - lastSaveTime.current < SAVE_COOLDOWN * 1000) return;

            lastSaveTime.current = now;
            const saveData = getSaveData();

            // Use requestIdleCallback for non-blocking saves to avoid frame drops
            if ('requestIdleCallback' in window) {
                (window as any).requestIdleCallback(() => saveGame(saveData));
            } else {
                setTimeout(() => saveGame(saveData), 0);
            }
        };

        // Immediate save for critical moments (tab close, visibility change)
        // This bypasses throttling to ensure data is saved
        const handleEmergencySave = () => {
            const saveData = getSaveData();
            // Save immediately without requestIdleCallback - this needs to complete fast
            saveGame(saveData);
            console.log('Emergency save triggered');
        };

        // Handle tab close/refresh - this is critical for data preservation
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            handleEmergencySave();
            // Note: Modern browsers ignore custom messages, but we still trigger the save
        };

        // Handle visibility change (user switches tabs or minimizes)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                handleEmergencySave();
            }
        };

        // Subscribe to relevant changes
        const unsubXP = usePlayerStore.subscribe(state => state.xp, handleSave);
        const unsubLevel = usePlayerStore.subscribe(state => state.level, handleSave);
        const unsubEchoes = usePlayerStore.subscribe(state => state.echoes, handleSave);
        const unsubInventory = usePlayerStore.subscribe(state => state.inventory, handleSave);
        const unsubEmbouchure = usePlayerStore.subscribe(state => state.embouchure, handleSave);
        const unsubReed = usePlayerStore.subscribe(state => state.equippedReed, handleSave);
        const unsubDungeonTime = usePlayerStore.subscribe(state => state.dungeonTimeBonus, handleSave);
        const unsubLigature = usePlayerStore.subscribe(state => state.equippedLigature, handleSave);

        // Auto-save every 10 seconds
        const autoSaveInterval = setInterval(() => {
            handleSave();
        }, 10000);

        // Add critical event listeners for tab close/switch
        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Cleanup
        return () => {
            unsubXP();
            unsubLevel();
            unsubEchoes();
            unsubInventory();
            unsubEmbouchure();
            unsubReed();
            unsubDungeonTime();
            unsubLigature();
            clearInterval(autoSaveInterval);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            handleEmergencySave(); // Force save on unmount
        };
    }, []);

    return null;
}
