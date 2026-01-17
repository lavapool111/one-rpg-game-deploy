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
 */
export function SaveManager() {
    const { camera } = useThree();
    const setPosition = usePlayerStore(state => state.setPosition);
    
    // Position sync throttling
    const lastSyncTime = useRef(0);
    const SYNC_INTERVAL = 1.0; // Sync position to store every 1s

    // Auto-save throttling (don't save too fast)
    const lastSaveTime = useRef(0);
    const SAVE_COOLDOWN = 2.0;

    // Use frame to sync position
    useFrame((state, delta) => {
        const time = state.clock.elapsedTime;
        if (time - lastSyncTime.current > SYNC_INTERVAL) {
            setPosition(camera.position.x, camera.position.y, camera.position.z);
            lastSyncTime.current = time;
        }
    });

    // Subscribe to store changes to trigger save
    useEffect(() => {
        // Function to handle saving
        const handleSave = () => {
            const now = Date.now();
            if (now - lastSaveTime.current < SAVE_COOLDOWN * 1000) return;
            
            lastSaveTime.current = now;
            
            const player = usePlayerStore.getState();
            const saveData = {
                level: player.level,
                health: player.health,
                xp: player.xp,
                echoes: player.echoes,
                position: { 
                    x: player.position[0], 
                    y: player.position[1], 
                    z: player.position[2] 
                },
                // Full inventory including materials and reeds
                inventory: player.inventory,
                // Reed state
                equippedReed: player.equippedReed,
                reedDurability: player.reedDurability,
                // Embouchure stats
                embouchure: player.embouchure,
                embouchureXp: player.embouchureXp,
            };
            
            // Use requestIdleCallback for non-blocking saves to avoid frame drops
            if ('requestIdleCallback' in window) {
                (window as any).requestIdleCallback(() => saveGame(saveData));
            } else {
                // Fallback for browsers without requestIdleCallback
                setTimeout(() => saveGame(saveData), 0);
            }
        };

        // Subscribe to relevant changes
        // "Every significant action": Kill (XP), Level Up (Level), Item Pickup (Echoes/Materials/Reeds), Embouchure
        const unsubXP = usePlayerStore.subscribe(state => state.xp, handleSave);
        const unsubLevel = usePlayerStore.subscribe(state => state.level, handleSave);
        const unsubEchoes = usePlayerStore.subscribe(state => state.echoes, handleSave);
        const unsubInventory = usePlayerStore.subscribe(state => state.inventory, handleSave);
        const unsubEmbouchure = usePlayerStore.subscribe(state => state.embouchure, handleSave);
        const unsubReed = usePlayerStore.subscribe(state => state.equippedReed, handleSave);
        
        // Also save on unmount
        return () => {
            unsubXP();
            unsubLevel();
            unsubEchoes();
            unsubInventory();
            unsubEmbouchure();
            unsubReed();
            handleSave(); // Force save on unmount/close
        };
    }, []);

    return null;
}
