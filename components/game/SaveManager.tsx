'use client';

import { useEffect, useRef } from 'react';
import { usePlayerStore, useGameStore } from '@/lib/store';
import { useAccessoryStore } from '@/lib/store/accessoryStore';
import { useInventoryStore } from '@/lib/store/inventoryStore';
import { saveGame, loadGame, deleteLatestSave } from '@/lib/db';

/**
 * Unified save data getter to ensure consistent saves across the game.
 */
export const getSaveData = () => {
    const player = usePlayerStore.getState();
    const accessory = useAccessoryStore.getState();
    const inventoryState = useInventoryStore.getState();
    const game = useGameStore.getState();

    return {
        level: player.level,
        xp: player.xp,
        echoes: player.echoes,
        health: player.health,
        embouchure: player.embouchure,
        embouchureXp: player.embouchureXp,
        dungeonTimeBonus: accessory.dungeonTimeBonus,
        equippedReed: accessory.equippedReed,
        reedDurability: accessory.reedDurability,
        equippedLigature: accessory.equippedLigature,
        equippedMouthpiece: accessory.equippedMouthpiece,
        equippedCase: accessory.equippedCase,
        ligatureSlot: accessory.ligatureSlot,
        mouthpieceSlot: accessory.mouthpieceSlot,
        caseSlot: accessory.caseSlot,
        reedSlot: accessory.reedSlot,
        equippedEnchantments: accessory.equippedEnchantments,
        enchantmentSlots: accessory.enchantmentSlots,
        attackCounter: accessory.attackCounter,
        hasEmpoweringSpeedBonus: accessory.hasEmpoweringSpeedBonus,
        accessorySlots: accessory.accessorySlots,
        critFactor: accessory.critFactor,
        inventory: inventoryState.inventory,
        playerClass: player.playerClass,
        playerName: player.playerName,
        abilityUpgrades: player.abilityUpgrades,
        currentAltarIndex: game.currentAltarIndex,
        outerBackstageUnlocked: game.outerBackstageUnlocked,
        hasSeenAltarIntro: game.hasSeenAltarIntro,
        sessionId: player.sessionId,
        position: {
            x: player.position[0],
            y: player.position[1],
            z: player.position[2]
        }
    };
};

export const SaveManager = () => {
    // Save throttling and dirty checking
    const lastSaveTime = useRef(0);
    const lastPlayerVersion = useRef(0);
    const lastInventoryVersion = useRef(0);
    const lastAccessoryVersion = useRef(0);
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
            if (isSavePending.current) return;

            const now = Date.now();
            const timeSinceLastSave = now - lastSaveTime.current;
            const timeToNextAllowedSave = Math.max(0, SAVE_COOLDOWN_MS - timeSinceLastSave);

            // Wait for cooldown to expire, plus at least minimum debounce
            const delay = Math.max(DEBOUNCE_DELAY_MS, timeToNextAllowedSave);

            isSavePending.current = true;

            saveTimeout.current = setTimeout(() => {
                isSavePending.current = false;

                const gameStore = useGameStore.getState();
                const gameVersion = gameStore.version;
                const gameState = gameStore.gameState;

                const { version: playerVersion, isLoading } = usePlayerStore.getState();
                const { version: inventoryVersion } = useInventoryStore.getState();
                const { version: accessoryVersion } = useAccessoryStore.getState();

                if (gameState !== 'playing' && gameState !== 'paused') return;
                if (isLoading) return;

                const pos = usePlayerStore.getState().position;
                const isPosDirty =
                    Math.abs(pos[0] - lastPosition.current[0]) > 1 ||
                    Math.abs(pos[2] - lastPosition.current[2]) > 1;

                // Fast dirty check using version numbers and position
                const isDirty =
                    playerVersion !== lastPlayerVersion.current ||
                    inventoryVersion !== lastInventoryVersion.current ||
                    accessoryVersion !== lastAccessoryVersion.current ||
                    gameVersion !== lastGameVersion.current ||
                    isPosDirty;

                if (isDirty) {
                    lastSaveTime.current = Date.now();
                    lastPlayerVersion.current = playerVersion;
                    lastInventoryVersion.current = inventoryVersion;
                    lastAccessoryVersion.current = accessoryVersion;
                    lastGameVersion.current = gameVersion;
                    lastPosition.current = [...usePlayerStore.getState().position];

                    const saveData = getSaveData();
                    console.log('[SaveManager] State is dirty (versioned), saving...', {
                        playerVersion, inventoryVersion, accessoryVersion
                    });
                    saveGame(saveData).catch(console.error);
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
                    lastInventoryVersion.current = useInventoryStore.getState().version;
                    lastAccessoryVersion.current = useAccessoryStore.getState().version;
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
                inventoryVersion !== lastInventoryVersion.current ||
                accessoryVersion !== lastAccessoryVersion.current ||
                gameVersion !== lastGameVersion.current ||
                isPosDirty;

            if (isDirty) {
                lastPlayerVersion.current = playerVersion;
                lastInventoryVersion.current = inventoryVersion;
                lastAccessoryVersion.current = accessoryVersion;
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
