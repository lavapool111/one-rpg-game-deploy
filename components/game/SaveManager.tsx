'use client';

import { useEffect, useRef } from 'react';
import { usePlayerStore, useInventoryStore, useAccessoryStore, useGameStore } from '@/lib/store';
import { saveGame, loadGame, deleteLatestSave } from '@/lib/db';
import { getSaveData } from '@/lib/db/saveUtils';
import { cloudSave } from '@/lib/db/cloudSync';

/**
 * Unified auto-save manager.
 */

export const SaveManager = () => {
    // Save throttling and dirty checking
    const lastSaveTime = useRef(0);
    const lastPlayerVersion = useRef(0);
    const lastInvVersion = useRef(0);
    const lastAccVersion = useRef(0);
    const lastGameVersion = useRef(0);
    const lastPosition = useRef([0, 1.5, 0]);
    const saveTimeout = useRef<NodeJS.Timeout | null>(null);

    const SAVE_COOLDOWN_MS = 1000; // Auto-save at most every 1 second
    const DEBOUNCE_DELAY_MS = 500; // Minimum wait after a state change
    const isSavePending = useRef(false);

    // Subscribe to store changes to trigger save
    useEffect(() => {
        // Guaranteed rolling save check: prevents starvation from rapid state updates
        const triggerSaveCheck = () => {
            if (isSavePending.current) {
                console.log('[SaveManager] Save already pending, skipping check');
                return;
            }

            const now = Date.now();
            const timeSinceLastSave = now - lastSaveTime.current;
            const timeToNextAllowedSave = SAVE_COOLDOWN_MS - timeSinceLastSave;

            const delay = Math.max(DEBOUNCE_DELAY_MS, timeToNextAllowedSave);

            isSavePending.current = true;
            if (saveTimeout.current) clearTimeout(saveTimeout.current);

            saveTimeout.current = setTimeout(() => {
                isSavePending.current = false;
                const { version: playerVersion, isLoading, position: pos } = usePlayerStore.getState();
                const { version: accVersion } = useAccessoryStore.getState();
                const { version: invVersion } = useInventoryStore.getState();
                const { version: gameVersion, gameState } = useGameStore.getState();

                if (isLoading) {
                    console.log('[SaveManager] Save skipped: Store is currently loading');
                    return;
                }
                if (gameState !== 'playing' && gameState !== 'paused') {
                    console.log(`[SaveManager] Save skipped: Invalid GameState (${gameState})`);
                    return;
                }

                const isPosDirty =
                    Math.abs(pos[0] - lastPosition.current[0]) > 1 ||
                    Math.abs(pos[2] - lastPosition.current[2]) > 1;

                const isDirty =
                    playerVersion !== lastPlayerVersion.current ||
                    accVersion !== lastAccVersion.current ||
                    invVersion !== lastInvVersion.current ||
                    gameVersion !== lastGameVersion.current ||
                    isPosDirty;

                if (isDirty) {
                    console.log('[SaveManager] Progress detected, saving...', {
                        player: `${lastPlayerVersion.current} -> ${playerVersion}`,
                        acc: `${lastAccVersion.current} -> ${accVersion}`,
                        inv: `${lastInvVersion.current} -> ${invVersion}`,
                        game: `${lastGameVersion.current} -> ${gameVersion}`,
                        pos: isPosDirty ? 'Moved > 1 unit' : 'Stationary'
                    });

                    const saveData = getSaveData();
                    saveGame(saveData)
                        .then(() => {
                            lastSaveTime.current = Date.now();
                            lastPlayerVersion.current = playerVersion;
                            lastAccVersion.current = accVersion;
                            lastInvVersion.current = invVersion;
                            lastGameVersion.current = gameVersion;
                            lastPosition.current = pos;
                            console.log('[SaveManager] Save successful');

                            // Push to cloud if authenticated (non-blocking)
                            cloudSave(saveData);
                        })
                        .catch(err => {
                            console.error('[SaveManager] Save failed:', err);
                            // Do NOT update refs on failure - this allows retry on next check
                        });
                } else {
                    // Periodic log to show it's alive but idle
                    if (now % 10000 < 2200) { // Log roughly every 10s
                        console.debug('[SaveManager] No progress detected, idle...');
                    }
                }
            }, delay);
        };

        const handleRollback = async () => {
            console.log('[SaveManager] Rollback requested...');
            const success = await deleteLatestSave();
            if (success) {
                const previousSave = await loadGame();
                if (previousSave) {
                    console.log('[SaveManager] Rolling back to save:', previousSave.timestamp);

                    // Update all stores
                    usePlayerStore.getState().loadState(previousSave);
                    useInventoryStore.getState().loadState(previousSave);
                    useAccessoryStore.getState().loadState(previousSave);
                    useGameStore.getState().loadState(previousSave);

                    // Update local refs to prevent immediate re-save
                    lastPlayerVersion.current = usePlayerStore.getState().version;
                    lastInvVersion.current = useInventoryStore.getState().version;
                    lastAccVersion.current = useAccessoryStore.getState().version;
                    lastGameVersion.current = useGameStore.getState().version;
                    lastPosition.current = [...usePlayerStore.getState().position];

                    // Feedback (optional, could be an overlay)
                    alert('Reverted to previous save version.');
                } else {
                    alert('No previous save found to revert to.');
                }
            } else {
                alert('No save to rollback.');
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'm') {
                // Check if not in an input field
                if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
                handleRollback();
            }
        };

        // Immediate save for critical moments (tab close, visibility change)
        const handleEmergencySave = () => {
            const { version: gameVersion, gameState } = useGameStore.getState();
            const { isLoading, version: playerVersion } = usePlayerStore.getState();
            const { version: inventoryVersion } = useInventoryStore.getState();
            const { version: accessoryVersion } = useAccessoryStore.getState();

            if (gameState !== 'playing' && gameState !== 'paused') return;
            if (isLoading) return;

            const pos = usePlayerStore.getState().position;
            const isPosDirty =
                Math.abs(pos[0] - lastPosition.current[0]) > 1 ||
                Math.abs(pos[2] - lastPosition.current[2]) > 1;

            // Emergency dirty check
            const isDirty =
                playerVersion !== lastPlayerVersion.current ||
                inventoryVersion !== lastInvVersion.current ||
                accessoryVersion !== lastAccVersion.current ||
                gameVersion !== lastGameVersion.current ||
                isPosDirty;

            if (isDirty) {
                lastPlayerVersion.current = playerVersion;
                lastInvVersion.current = inventoryVersion;
                lastAccVersion.current = accessoryVersion;
                lastGameVersion.current = gameVersion;
                lastPosition.current = [...usePlayerStore.getState().position];

                const saveData = getSaveData();
                saveGame(saveData);

                // Synchronous fallback for tab close (IndexedDB writes drop if tab closes instantly)
                try {
                    localStorage.setItem('emergency_backup_save', JSON.stringify({
                        timestamp: Date.now(),
                        ...saveData
                    }));
                } catch (e) {
                    // Ignore quota errors
                }

                console.log('[SaveManager] Emergency save triggered (versioned + sync backup)');
            }
        };

        // Handle tab close/refresh
        const handleBeforeUnload = () => handleEmergencySave();

        // Handle visibility change
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') handleEmergencySave();
        };

        // Subscribe to relevant changes - consolidated where possible
        const unsubs = [
            usePlayerStore.subscribe(state => state.version, triggerSaveCheck),
            useInventoryStore.subscribe(state => state.version, triggerSaveCheck),
            useAccessoryStore.subscribe(state => state.version, triggerSaveCheck),
            useGameStore.subscribe(state => state.version, triggerSaveCheck),
        ];

        // Occasional auto-save check regardless of subscriptions
        // Using 2100ms to stagger against the 3100ms Registry cleanup
        const autoSaveInterval = setInterval(triggerSaveCheck, 2100);


        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            unsubs.forEach(unsub => unsub());
            clearInterval(autoSaveInterval);
            if (saveTimeout.current) clearTimeout(saveTimeout.current);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('keydown', handleKeyDown);
            // handleEmergencySave(); // Removed to prevent blocking exit-lag when UI unmounts/remounts
        };
    }, []);

    return null;
};
