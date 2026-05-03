import { usePlayerStore, useInventoryStore, useAccessoryStore, useGameStore } from '@/lib/store';
import { PlayerSave } from './index';

/**
 * Unified save data getter to ensure consistent saves across the game.
 * Centralized here to be used by SaveManager (auto-save) and SaveDebugger (manual export).
 */
export const getSaveData = (): Omit<PlayerSave, 'id' | 'timestamp'> => {
    const player = usePlayerStore.getState();
    const accessory = useAccessoryStore.getState();
    const inventoryState = useInventoryStore.getState();
    const game = useGameStore.getState();

    return {
        position: player.position,
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
        weaponMeldType: accessory.weaponMeldType,
        weaponMeldTier: accessory.weaponMeldTier,
        inventory: inventoryState.inventory,
        playerClass: player.playerClass,
        playerName: player.playerName,
        abilityUpgrades: player.abilityUpgrades,
        currentAltarIndex: game.currentAltarIndex,
        outerBackstageUnlocked: game.outerBackstageUnlocked,
        hasSeenAltarIntro: game.hasSeenAltarIntro,
        sessionId: player.sessionId,
    };
};
