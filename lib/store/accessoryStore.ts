"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { getStatsForLevel, getXpRequiredForLevel } from "../game/stats";
import {
    Inventory,
    getInitialInventory,
    MaterialItemId,
    ReedStrength,
    REED_MULTIPLIERS,
    ALL_RECIPES,
    LigatureInstance,
    LigatureId,
    getLigatureStats,
    getLigatureData,
    getLigatureUpgradeCost,
    MouthpieceInstance,
    MouthpieceId,
    getMouthpieceStats,
    getMouthpieceData,
    getMouthpieceUpgradeCost,
    CaseInstance,
    CaseId,
    getCaseStats,
    getCaseData,
    getCaseUpgradeCost,
    EnchantmentInstance,
    EnchantmentId,
    EnchantmentTier,
    getEnchantmentData,
    ENCHANTMENT_SLOT_LEVELS,
    MeldType,
    MeldStatBonus,
    getMeldStats,
    getMeldTierCost,
    MELD_UNLOCK_LEVEL,
} from "../game/inventory";
import { GAME_CONFIG } from "../game/config";

// ===== Shared helpers (also used by playerStore) =====

// Slot bonuses - percentage boost to accessory stats based on slot position
export const SLOT_BONUSES = [0.30, 0.26, 0.21, 0.16, 0.12, 0.07, 0.03, 0.00];

export function getSlotMultiplier(slotIndex: number): number {
    if (slotIndex < 0 || slotIndex >= SLOT_BONUSES.length) return 1.0;
    return 1.0 + SLOT_BONUSES[slotIndex];
}

// Stat Calculation with Reed Stats
export function calculateStats(
    level: number,
    reed: ReedStrength | null,
    embouchure: number = 1,
    slotMultiplier: number = 1,
    caseHealthMultiplier: number = 1,
    caseSpeedBonus: number = 0,
    permanentSpeedBonus: number = 0
) {
    const base = getStatsForLevel(level);
    const baseSpeed = GAME_CONFIG.STARTING_SPEED;
    const embouchureCritBonus = (embouchure - 1) * 0.02;

    if (!reed) {
        return {
            ...base,
            health: Math.floor(base.health * caseHealthMultiplier),
            speed: baseSpeed + caseSpeedBonus + permanentSpeedBonus,
            basicAttackDamage: base.damage,
            critChance: embouchureCritBonus,
            defense: 0,
        };
    }

    const stats = REED_MULTIPLIERS[reed];
    const speedBonus = (stats.speed - 1) * slotMultiplier;
    const totalSpeedMultiplier = 1 + speedBonus;

    return {
        health: Math.floor(base.health * caseHealthMultiplier),
        damage: base.damage,
        basicAttackDamage: base.damage,
        speed: Number((baseSpeed * totalSpeedMultiplier + caseSpeedBonus + permanentSpeedBonus).toFixed(2)),
        critChance: (stats.crit * slotMultiplier) + embouchureCritBonus,
        superCritChance: ((stats.crit * slotMultiplier) + embouchureCritBonus > 1.0) ? (((stats.crit * slotMultiplier) + embouchureCritBonus) - 1.0) / 10 : 0,
        defense: stats.def * slotMultiplier,
    };
}

/**
 * Accessory Store
 * Manages all equipment: reed, ligature, mouthpiece, case, enchantments, slots, melding, dungeon upgrades.
 * Reads player stats from playerStore via lazy import and updates them via setState.
 */

export interface AccessoryState {
    // Reed
    equippedReed: ReedStrength | null;
    reedDurability: number;
    // Ligature
    equippedLigature: LigatureInstance | null;
    // Mouthpiece
    equippedMouthpiece: MouthpieceInstance | null;
    critFactor: number;
    // Case
    equippedCase: CaseInstance | null;
    accessorySlots: number;
    // Slot positions (-1 = not slotted)
    ligatureSlot: number;
    mouthpieceSlot: number;
    reedSlot: number;
    caseSlot: number;
    // Enchantments
    equippedEnchantments: Record<EnchantmentTier, EnchantmentInstance | null>;
    enchantmentSlots: Record<EnchantmentTier, number>;
    attackCounter: number;
    hasEmpoweringSpeedBonus: boolean;
    // Dungeon upgrades
    dungeonTimeBonus: number;

    // Performance caches
    _cachedLigatureBonus: ReturnType<AccessoryState['getLigatureBonus']> | null;
    _cachedMouthpieceBonus: ReturnType<AccessoryState['getMouthpieceBonus']> | null;
    _cachedCaseBonus: ReturnType<AccessoryState['getCaseBonus']> | null;
    _cachedMeldBonus: MeldStatBonus | null;
    _cachedEnchantmentBonus: ReturnType<AccessoryState['getEnchantmentBonus']> | null;
    _invalidateBonusCaches: () => void;

    // Reed Actions
    equipReed: (strength: ReedStrength | null) => void;
    unequipReed: () => void;
    tickReedDurability: (deltaSeconds: number) => void;

    // Embouchure
    addEmbouchureXp: (amount: number) => void;

    // Ligature Actions
    equipLigature: (ligatureIndex: number) => void;
    unequipLigature: () => void;
    craftLigature: (ligatureId: LigatureId) => boolean;
    upgradeLigature: (ligatureIndex: number) => boolean;
    getLigatureBonus: () => { longToneDurationMs: number; tubaDamageBonus: number };

    // Mouthpiece Actions
    equipMouthpiece: (mouthpieceIndex: number) => void;
    unequipMouthpiece: () => void;
    craftMouthpiece: (mouthpieceId: MouthpieceId) => boolean;
    upgradeMouthpiece: (mouthpieceIndex: number) => boolean;
    getMouthpieceBonus: () => { critFactor: number; critChance: number };

    // Case Actions
    equipCase: (caseIndex: number) => void;
    unequipCase: () => void;
    craftCase: (caseId: CaseId) => boolean;
    upgradeCase: (caseIndex: number) => boolean;
    getCaseBonus: () => { healthMultiplier: number; speedBonus: number; name: string; isEvolved: boolean };

    // Case Melding
    meldCase: (caseIndex: number, meldType: MeldType) => boolean;
    getMeldBonus: () => MeldStatBonus;

    // Enchantment Actions
    isEnchantmentSlotUnlocked: (tier: EnchantmentTier) => boolean;
    craftEnchantment: (enchantmentId: EnchantmentId, tier: EnchantmentTier) => boolean;
    equipEnchantment: (enchantmentIndex: number) => void;
    unequipEnchantment: (tier: EnchantmentTier) => void;
    getEnchantmentBonus: () => {
        critFactorBonus: number;
        defenseBonus: number;
        euphoniumDefenseBonus: number;
        trumpetDamageMultiplier: number;
        procAttackCount: number | null;
        healPercent: number;
        hasPulse: boolean;
        hasPercussive: boolean;
        hasEmpowering: boolean;
        hornRetaliationDamage: number;
        permanentSpeedBonus: number;
    };
    incrementAttackCounter: () => void;

    // Slot Actions
    setLigatureSlot: (slotIndex: number) => void;
    setMouthpieceSlot: (slotIndex: number) => void;
    setReedSlot: (slotIndex: number) => void;
    setCaseSlot: (slotIndex: number) => void;
    clearSlot: (slotIndex: number) => void;
    getSlotContent: (slotIndex: number) => { type: 'ligature' | 'mouthpiece' | 'reed' | 'case'; data: any } | null;

    // Dungeon Upgrades
    getDungeonTimeLimit: () => number;
    getNextDungeonUpgradeCost: () => { valves: number; heavyValves: number; timeIncrease: number };
    upgradeDungeonTime: () => boolean;
    version: number;
}

// Helper to get playerStore lazily (avoids circular import)
function getPlayerStore() {
    return require('./playerStore').usePlayerStore;
}

// Helper to get inventoryStore lazily
function getInventoryStore() {
    return require('./inventoryStore').useInventoryStore;
}

function getCurrentCaseBonuses(state: AccessoryState) {
    if (!state.equippedCase) return { healthMultiplier: 1, speedBonus: 0 };
    const caseBonus = getCaseStats(state.equippedCase.id, state.equippedCase.level);
    const slotMultiplier = getSlotMultiplier(state.caseSlot);
    return {
        healthMultiplier: 1 + (caseBonus.healthMultiplier - 1) * slotMultiplier,
        speedBonus: caseBonus.speedBonus * slotMultiplier,
    };
}

// Helper to get player stats needed for recalculation
function getPlayerStats() {
    const ps = getPlayerStore().getState();
    return {
        level: ps.level,
        embouchure: ps.embouchure,
        health: ps.health,
        maxHealth: ps.maxHealth,
    };
}

// Helper to update player stats after accessory change
function updatePlayerStats(stats: Partial<{
    maxHealth: number;
    health: number;
    damage: number;
    speed: number;
    critChance: number;
    superCritChance: number;
    defense: number;
    basicAttackDamage: number;
}>) {
    getPlayerStore().setState(stats);
}

export const useAccessoryStore = create<AccessoryState>()(
    subscribeWithSelector((set, get) => ({
        equippedReed: null,
        reedDurability: 0,
        equippedLigature: null,
        equippedMouthpiece: null,
        critFactor: 1.5,
        equippedCase: null,
        accessorySlots: 8,
        ligatureSlot: -1,
        mouthpieceSlot: -1,
        reedSlot: -1,
        caseSlot: -1,
        equippedEnchantments: { common: null, infused: null, arcane: null },
        enchantmentSlots: { common: -1, infused: -1, arcane: -1 },
        attackCounter: 0,
        hasEmpoweringSpeedBonus: false,
        dungeonTimeBonus: 0,
        version: 0,

        _cachedLigatureBonus: null,
        _cachedMouthpieceBonus: null,
        _cachedCaseBonus: null,
        _cachedMeldBonus: null,
        _cachedEnchantmentBonus: null,

        _invalidateBonusCaches: () => set({
            _cachedLigatureBonus: null,
            _cachedMouthpieceBonus: null,
            _cachedCaseBonus: null,
            _cachedMeldBonus: null,
            _cachedEnchantmentBonus: null,
        }),

        // ========== REED ==========

        equipReed: (strength) => {
            const state = get();
            const { level, embouchure, health, maxHealth } = getPlayerStats();
            const invStore = getInventoryStore().getState();

            if (!strength) {
                const caseBonuses = getCurrentCaseBonuses(state);
                const baseStats = calculateStats(level, null, embouchure, getSlotMultiplier(state.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedBonus);

                let mpCritBonus = 0;
                if (state.equippedMouthpiece) {
                    const mpStats = getMouthpieceStats(state.equippedMouthpiece.id, state.equippedMouthpiece.level);
                    mpCritBonus = mpStats.critChance * getSlotMultiplier(state.mouthpieceSlot);
                }

                const hpRatio = maxHealth > 0 ? health / maxHealth : 1;
                const newHealth = Math.max(1, Math.floor(baseStats.health * hpRatio));

                set({ equippedReed: null, reedDurability: 0 });
                updatePlayerStats({
                    maxHealth: baseStats.health,
                    health: newHealth,
                    damage: baseStats.damage,
                    speed: baseStats.speed,
                    critChance: baseStats.critChance + mpCritBonus,
                    superCritChance: (baseStats.critChance + mpCritBonus > 1.0) ? (baseStats.critChance + mpCritBonus - 1.0) / 10 : 0,
                    defense: baseStats.defense,
                });
                return;
            }

            if (invStore.inventory.reeds[strength] <= 0) return;

            // Consume reed from inventory
            getInventoryStore().setState((invState: any) => ({
                inventory: {
                    ...invState.inventory,
                    reeds: { ...invState.inventory.reeds, [strength]: Math.max(0, invState.inventory.reeds[strength] - 1) },
                },
            }));

            const caseBonuses = getCurrentCaseBonuses(state);
            const newStats = calculateStats(level, strength, embouchure, getSlotMultiplier(state.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedBonus);

            let mpCritBonus = 0;
            if (state.equippedMouthpiece) {
                const mpStats = getMouthpieceStats(state.equippedMouthpiece.id, state.equippedMouthpiece.level);
                mpCritBonus = mpStats.critChance * getSlotMultiplier(state.mouthpieceSlot);
            }

            const hpRatio = maxHealth > 0 ? health / maxHealth : 1;
            const newHealth = Math.max(1, Math.floor(newStats.health * hpRatio));

            set({ equippedReed: strength, reedDurability: 600, version: get().version + 1 });
            updatePlayerStats({
                maxHealth: newStats.health,
                health: newHealth,
                damage: newStats.damage,
                speed: newStats.speed,
                critChance: newStats.critChance + mpCritBonus,
                defense: newStats.defense,
            });
        },

        unequipReed: () => {
            const state = get();
            if (!state.equippedReed) return;

            const { level, embouchure, health, maxHealth } = getPlayerStats();
            const caseBonuses = getCurrentCaseBonuses(state);
            const newStats = calculateStats(level, null, embouchure, getSlotMultiplier(state.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedBonus);

            let mpCritBonus = 0;
            if (state.equippedMouthpiece) {
                const mpStats = getMouthpieceStats(state.equippedMouthpiece.id, state.equippedMouthpiece.level);
                mpCritBonus = mpStats.critChance * getSlotMultiplier(state.mouthpieceSlot);
            }

            const hpRatio = maxHealth > 0 ? health / maxHealth : 1;
            const newHealth = Math.max(1, Math.floor(newStats.health * hpRatio));

            set({ equippedReed: null, reedDurability: 0, version: get().version + 1 });
            updatePlayerStats({
                maxHealth: newStats.health,
                health: newHealth,
                damage: newStats.damage,
                speed: newStats.speed,
                critChance: newStats.critChance + mpCritBonus,
                defense: newStats.defense,
            });
        },

        tickReedDurability: (dt) => {
            const state = get();
            if (!state.equippedReed || state.reedDurability <= 0) return;

            const newDurability = state.reedDurability - dt;
            if (newDurability <= 0) {
                // Reed broke — auto-unequip
                const { level, embouchure, health, maxHealth } = getPlayerStats();
                const caseBonuses = getCurrentCaseBonuses(state);
                const newStats = calculateStats(level, null, embouchure, getSlotMultiplier(state.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedBonus);

                let mpCritBonus = 0;
                if (state.equippedMouthpiece) {
                    const mpStats = getMouthpieceStats(state.equippedMouthpiece.id, state.equippedMouthpiece.level);
                    mpCritBonus = mpStats.critChance * getSlotMultiplier(state.mouthpieceSlot);
                }

                const hpRatio = maxHealth > 0 ? health / maxHealth : 1;
                const newHealth = Math.max(1, Math.floor(newStats.health * hpRatio));

                set({ equippedReed: null, reedDurability: 0, version: get().version + 1 });
                updatePlayerStats({
                    maxHealth: newStats.health,
                    health: newHealth,
                    damage: newStats.damage,
                    speed: newStats.speed,
                    critChance: newStats.critChance + mpCritBonus,
                    defense: newStats.defense,
                });
            } else {
                set({ reedDurability: newDurability });
            }
        },

        // ========== EMBOUCHURE ==========

        addEmbouchureXp: (amount) => {
            const state = get();
            const ps = getPlayerStore().getState();
            if (ps.embouchure >= 10) return;

            let embouchure = ps.embouchure;
            let embouchureXp = ps.embouchureXp + amount;
            const xpRequired = embouchure * 100;

            let newCritChance = ps.critChance;
            if (embouchureXp >= xpRequired) {
                embouchureXp -= xpRequired;
                embouchure += 1;
                if (embouchure > 10) { embouchure = 10; embouchureXp = 0; }

                const caseBonuses = getCurrentCaseBonuses(state);
                const newStats = calculateStats(ps.level, state.equippedReed, embouchure, getSlotMultiplier(state.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedBonus);

                let mpCritBonus = 0;
                if (state.equippedMouthpiece) {
                    const mpStats = getMouthpieceStats(state.equippedMouthpiece.id, state.equippedMouthpiece.level);
                    mpCritBonus = mpStats.critChance * getSlotMultiplier(state.mouthpieceSlot);
                }

                newCritChance = newStats.critChance + mpCritBonus;
                const newSuperCritChance = (newCritChance > 1.0) ? (newCritChance - 1.0) / 10 : 0;
                getPlayerStore().setState({ embouchure, embouchureXp, critChance: newCritChance, superCritChance: newSuperCritChance });
                return;
            }

            getPlayerStore().setState({ embouchure, embouchureXp });
        },

        // ========== LIGATURE ==========

        getLigatureBonus: () => {
            const state = get();
            if (!state.equippedLigature) return { longToneDurationMs: 0, tubaDamageBonus: 0 };
            const stats = getLigatureStats(state.equippedLigature.id, state.equippedLigature.level);
            const slotMultiplier = getSlotMultiplier(state.ligatureSlot);
            const durationMs = stats.longToneBonus * 1000 * slotMultiplier;
            return {
                longToneDurationMs: Math.min(12000, durationMs),
                tubaDamageBonus: stats.tubaDamageBonus * slotMultiplier,
            };
        },

        equipLigature: (ligatureIndex) => {
            const invStore = getInventoryStore().getState();
            const ligature = invStore.inventory.ligatures[ligatureIndex];
            if (!ligature) return;
            set({ equippedLigature: ligature, version: get().version + 1 });
            get()._invalidateBonusCaches();
        },

        unequipLigature: () => {
            set({ equippedLigature: null, version: get().version + 1 });
            get()._invalidateBonusCaches();
        },

        craftLigature: (ligatureId) => {
            const invStore = getInventoryStore().getState();
            const ligatureData = getLigatureData(ligatureId);
            if (!ligatureData) return false;

            const recipe = ALL_RECIPES.find(r => r.id === `ligature_${ligatureId}_craft`);
            if (!recipe) return false;

            for (const ing of recipe.ingredients) {
                const have = invStore.inventory.materials[ing.itemId as MaterialItemId] || 0;
                if (have < ing.quantity) return false;
            }

            const newMaterials = { ...invStore.inventory.materials };
            for (const ing of recipe.ingredients) {
                newMaterials[ing.itemId as MaterialItemId] = (newMaterials[ing.itemId as MaterialItemId] || 0) - ing.quantity;
            }

            const newLigature: LigatureInstance = { id: ligatureId, level: 1 };
            const newLigatures = [...invStore.inventory.ligatures, newLigature];

            getInventoryStore().setState({
                inventory: { ...invStore.inventory, materials: newMaterials, ligatures: newLigatures },
            });

            return true;
        },

        upgradeLigature: (ligatureIndex) => {
            const state = get();
            const invStore = getInventoryStore().getState();
            const ligature = invStore.inventory.ligatures[ligatureIndex];
            if (!ligature) return false;

            const nextLevel = ligature.level + 1;
            const upgradeCost = getLigatureUpgradeCost(ligature.id, ligature.level);

            for (const ing of upgradeCost) {
                const have = invStore.inventory.materials[ing.itemId as MaterialItemId] || 0;
                if (have < ing.quantity) return false;
            }

            const newMaterials = { ...invStore.inventory.materials };
            for (const ing of upgradeCost) {
                newMaterials[ing.itemId as MaterialItemId] = (newMaterials[ing.itemId as MaterialItemId] || 0) - ing.quantity;
            }

            const newLigatures = [...invStore.inventory.ligatures];
            newLigatures[ligatureIndex] = { ...ligature, level: nextLevel };

            let newEquipped = state.equippedLigature;
            if (newEquipped && newEquipped.id === ligature.id && newEquipped.level === ligature.level) {
                newEquipped = { ...newEquipped, level: nextLevel };
            }

            set({ equippedLigature: newEquipped, version: get().version + 1 });
            getInventoryStore().setState({
                inventory: { ...invStore.inventory, materials: newMaterials, ligatures: newLigatures },
            });
            get()._invalidateBonusCaches();
            return true;
        },

        // ========== MOUTHPIECE ==========

        equipMouthpiece: (mouthpieceIndex) => {
            const state = get();
            const { level, embouchure, health, maxHealth } = getPlayerStats();
            const invStore = getInventoryStore().getState();
            const mouthpiece = invStore.inventory.mouthpieces[mouthpieceIndex];
            if (!mouthpiece) return;

            const mouthpieceBonus = getMouthpieceStats(mouthpiece.id, mouthpiece.level);
            const slotMultiplier = getSlotMultiplier(state.mouthpieceSlot);
            const caseBonuses = getCurrentCaseBonuses(state);
            const baseStats = calculateStats(level, state.equippedReed, embouchure, getSlotMultiplier(state.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedBonus);

            const hpRatio = maxHealth > 0 ? health / maxHealth : 1;
            const newHealth = Math.max(1, Math.floor(baseStats.health * hpRatio));

            set({
                equippedMouthpiece: mouthpiece,
                critFactor: 1.5 + (mouthpieceBonus.critFactor * slotMultiplier),
                version: get().version + 1,
            });
            updatePlayerStats({
                maxHealth: baseStats.health,
                health: newHealth,
                critChance: baseStats.critChance + (mouthpieceBonus.critChance * slotMultiplier),
                superCritChance: (baseStats.critChance + (mouthpieceBonus.critChance * slotMultiplier) > 1.0) ? (baseStats.critChance + (mouthpieceBonus.critChance * slotMultiplier) - 1.0) / 10 : 0,
            });
            get()._invalidateBonusCaches();
        },

        unequipMouthpiece: () => {
            const state = get();
            const { level, embouchure, health, maxHealth } = getPlayerStats();
            const caseBonuses = getCurrentCaseBonuses(state);
            const baseStats = calculateStats(level, state.equippedReed, embouchure, getSlotMultiplier(state.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedBonus);

            const hpRatio = maxHealth > 0 ? health / maxHealth : 1;
            const newHealth = Math.max(1, Math.floor(baseStats.health * hpRatio));

            set({
                equippedMouthpiece: null,
                critFactor: 1.5,
                version: get().version + 1,
            });
            updatePlayerStats({
                maxHealth: baseStats.health,
                health: newHealth,
                critChance: baseStats.critChance,
                superCritChance: (baseStats.critChance > 1.0) ? (baseStats.critChance - 1.0) / 10 : 0,
            });
            get()._invalidateBonusCaches();
        },

        craftMouthpiece: (mouthpieceId) => {
            const invStore = getInventoryStore().getState();
            const mouthpieceData = getMouthpieceData(mouthpieceId);

            for (const ing of mouthpieceData.recipe) {
                const have = invStore.inventory.materials[ing.itemId as MaterialItemId] || 0;
                if (have < ing.quantity) return false;
            }

            const newMaterials = { ...invStore.inventory.materials };
            for (const ing of mouthpieceData.recipe) {
                newMaterials[ing.itemId as MaterialItemId] = (newMaterials[ing.itemId as MaterialItemId] || 0) - ing.quantity;
            }

            const newMouthpieces = [...invStore.inventory.mouthpieces, { id: mouthpieceId, level: 1 }];
            getInventoryStore().setState({
                inventory: { ...invStore.inventory, materials: newMaterials, mouthpieces: newMouthpieces },
            });
            return true;
        },

        upgradeMouthpiece: (mouthpieceIndex) => {
            const state = get();
            const invStore = getInventoryStore().getState();
            const mouthpiece = invStore.inventory.mouthpieces[mouthpieceIndex];
            if (!mouthpiece) return false;

            const nextLevel = mouthpiece.level + 1;
            const upgradeCost = getMouthpieceUpgradeCost(mouthpiece.id, mouthpiece.level);

            for (const ing of upgradeCost) {
                const have = invStore.inventory.materials[ing.itemId as MaterialItemId] || 0;
                if (have < ing.quantity) return false;
            }

            const newMaterials = { ...invStore.inventory.materials };
            for (const ing of upgradeCost) {
                newMaterials[ing.itemId as MaterialItemId] = (newMaterials[ing.itemId as MaterialItemId] || 0) - ing.quantity;
            }

            const newMouthpieces = [...invStore.inventory.mouthpieces];
            newMouthpieces[mouthpieceIndex] = { ...mouthpiece, level: nextLevel };

            let newEquipped = state.equippedMouthpiece;
            let newCritFactor = state.critFactor;

            if (newEquipped && newEquipped.id === mouthpiece.id && newEquipped.level === mouthpiece.level) {
                newEquipped = { ...newEquipped, level: nextLevel };
                const mouthpieceBonus = getMouthpieceStats(newEquipped.id, nextLevel);
                const slotMultiplier = getSlotMultiplier(state.mouthpieceSlot);
                newCritFactor = 1.5 + (mouthpieceBonus.critFactor * slotMultiplier);

                const { level, embouchure } = getPlayerStats();
                const caseBonuses = getCurrentCaseBonuses(state);
                const baseStats = calculateStats(level, state.equippedReed, embouchure, getSlotMultiplier(state.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedBonus);
                updatePlayerStats({
                    critChance: baseStats.critChance + (mouthpieceBonus.critChance * slotMultiplier),
                    superCritChance: (baseStats.critChance + (mouthpieceBonus.critChance * slotMultiplier) > 1.0) ? (baseStats.critChance + (mouthpieceBonus.critChance * slotMultiplier) - 1.0) / 10 : 0,
                });
            }

            set({ equippedMouthpiece: newEquipped, critFactor: newCritFactor, version: get().version + 1 });
            getInventoryStore().setState({
                inventory: { ...invStore.inventory, materials: newMaterials, mouthpieces: newMouthpieces },
            });
            get()._invalidateBonusCaches();
            return true;
        },

        getMouthpieceBonus: () => {
            const state = get();
            if (!state.equippedMouthpiece) return { critFactor: 0, critChance: 0 };
            const stats = getMouthpieceStats(state.equippedMouthpiece.id, state.equippedMouthpiece.level);
            const slotMultiplier = getSlotMultiplier(state.mouthpieceSlot);
            return { critFactor: stats.critFactor * slotMultiplier, critChance: stats.critChance * slotMultiplier };
        },

        // ========== SLOT POSITION ==========

        setLigatureSlot: (slotIndex) => {
            const state = get();
            if (state.mouthpieceSlot === slotIndex || state.reedSlot === slotIndex) return;
            set({ ligatureSlot: slotIndex });
            get()._invalidateBonusCaches();
        },

        setMouthpieceSlot: (slotIndex) => {
            const state = get();
            if (state.ligatureSlot === slotIndex || state.reedSlot === slotIndex) return;
            set({ mouthpieceSlot: slotIndex, version: get().version + 1 });

            if (state.equippedMouthpiece) {
                const mouthpieceBonus = getMouthpieceStats(state.equippedMouthpiece.id, state.equippedMouthpiece.level);
                const slotMultiplier = getSlotMultiplier(slotIndex);
                const { level, embouchure } = getPlayerStats();
                const caseBonuses = getCurrentCaseBonuses(state);
                const baseStats = calculateStats(level, state.equippedReed, embouchure, getSlotMultiplier(state.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedBonus);

                set({ critFactor: 1.5 + mouthpieceBonus.critFactor * slotMultiplier });
                updatePlayerStats({
                    critChance: baseStats.critChance + mouthpieceBonus.critChance * slotMultiplier,
                    superCritChance: (baseStats.critChance + mouthpieceBonus.critChance * slotMultiplier > 1.0) ? (baseStats.critChance + mouthpieceBonus.critChance * slotMultiplier - 1.0) / 10 : 0,
                });
            }
            get()._invalidateBonusCaches();
        },

        setReedSlot: (slotIndex) => {
            const state = get();
            if (state.ligatureSlot === slotIndex || state.mouthpieceSlot === slotIndex) return;
            set({ reedSlot: slotIndex, version: get().version + 1 });

            if (state.equippedReed) {
                const { level, embouchure, health, maxHealth } = getPlayerStats();
                const caseBonuses = getCurrentCaseBonuses(state);
                const newStats = calculateStats(level, state.equippedReed, embouchure, getSlotMultiplier(slotIndex), caseBonuses.healthMultiplier, caseBonuses.speedBonus);

                let mpCritBonus = 0;
                if (state.equippedMouthpiece) {
                    const mpStats = getMouthpieceStats(state.equippedMouthpiece.id, state.equippedMouthpiece.level);
                    mpCritBonus = mpStats.critChance * getSlotMultiplier(state.mouthpieceSlot);
                }

                const hpRatio = maxHealth > 0 ? health / maxHealth : 1;
                const newHealth = Math.max(1, Math.floor(newStats.health * hpRatio));

                updatePlayerStats({
                    maxHealth: newStats.health,
                    health: newHealth,
                    damage: newStats.damage,
                    speed: newStats.speed,
                    critChance: newStats.critChance + mpCritBonus,
                    defense: newStats.defense,
                });
            }
            get()._invalidateBonusCaches();
        },

        clearSlot: (slotIndex) => {
            const state = get();
            if (state.ligatureSlot === slotIndex) set({ ligatureSlot: -1, version: get().version + 1 });
            else if (state.mouthpieceSlot === slotIndex) set({ mouthpieceSlot: -1, version: get().version + 1 });
            else if (state.reedSlot === slotIndex) set({ reedSlot: -1, version: get().version + 1 });
            else if (state.caseSlot === slotIndex) set({ caseSlot: -1, version: get().version + 1 });
        },

        getSlotContent: (slotIndex) => {
            const state = get();
            if (state.ligatureSlot === slotIndex && state.equippedLigature) return { type: 'ligature' as const, data: state.equippedLigature };
            if (state.mouthpieceSlot === slotIndex && state.equippedMouthpiece) return { type: 'mouthpiece' as const, data: state.equippedMouthpiece };
            if (state.reedSlot === slotIndex && state.equippedReed) return { type: 'reed' as const, data: state.equippedReed };
            if (state.caseSlot === slotIndex && state.equippedCase) return { type: 'case' as const, data: state.equippedCase };
            return null;
        },

        // ========== CASE ==========

        equipCase: (caseIndex) => {
            const state = get();
            const { level, embouchure, health, maxHealth } = getPlayerStats();
            const invStore = getInventoryStore().getState();
            const caseToEquip = invStore.inventory.cases[caseIndex];
            if (!caseToEquip) return;

            const caseBonus = getCaseStats(caseToEquip.id, caseToEquip.level);
            const slotMultiplier = getSlotMultiplier(state.caseSlot);
            const baseStats = calculateStats(level, state.equippedReed, embouchure, getSlotMultiplier(state.reedSlot));

            let mpCritBonus = 0;
            if (state.equippedMouthpiece) {
                const mpStats = getMouthpieceStats(state.equippedMouthpiece.id, state.equippedMouthpiece.level);
                mpCritBonus = mpStats.critChance * getSlotMultiplier(state.mouthpieceSlot);
            }

            const healthMultiplier = caseBonus.healthMultiplier;
            const speedBonus = caseBonus.speedBonus * slotMultiplier;
            const hpRatio = maxHealth > 0 ? health / maxHealth : 1;
            const newHealth = Math.max(1, Math.floor(baseStats.health * healthMultiplier * hpRatio));

            set({ equippedCase: caseToEquip, version: get().version + 1 });
            updatePlayerStats({
                maxHealth: Math.floor(baseStats.health * healthMultiplier),
                health: newHealth,
                speed: baseStats.speed + speedBonus,
                critChance: baseStats.critChance + mpCritBonus,
                superCritChance: (baseStats.critChance + mpCritBonus > 1.0) ? (baseStats.critChance + mpCritBonus - 1.0) / 10 : 0,
                defense: baseStats.defense,
            });
            get()._invalidateBonusCaches();
        },

        unequipCase: () => {
            const state = get();
            if (!state.equippedCase) return;

            const { level, embouchure, health, maxHealth } = getPlayerStats();
            const baseStats = calculateStats(level, state.equippedReed, embouchure, getSlotMultiplier(state.reedSlot));

            let mpCritBonus = 0;
            if (state.equippedMouthpiece) {
                const mpStats = getMouthpieceStats(state.equippedMouthpiece.id, state.equippedMouthpiece.level);
                mpCritBonus = mpStats.critChance * getSlotMultiplier(state.mouthpieceSlot);
            }

            const hpRatio = maxHealth > 0 ? health / maxHealth : 1;
            const newHealth = Math.max(1, Math.floor(baseStats.health * hpRatio));

            set({ equippedCase: null, _cachedCaseBonus: null, _cachedMeldBonus: null, version: get().version + 1 });
            updatePlayerStats({
                maxHealth: baseStats.health,
                health: newHealth,
                speed: baseStats.speed,
                critChance: baseStats.critChance + mpCritBonus,
                superCritChance: (baseStats.critChance + mpCritBonus > 1.0) ? (baseStats.critChance + mpCritBonus - 1.0) / 10 : 0,
                defense: baseStats.defense,
            });
        },

        craftCase: (caseId) => {
            const invStore = getInventoryStore().getState();
            const playerStore = getPlayerStore().getState();
            const caseData = getCaseData(caseId);

            for (const ing of caseData.recipe) {
                if (ing.itemId === 'echoes') {
                    if (playerStore.echoes < ing.quantity) return false;
                } else if (invStore.inventory.materials[ing.itemId as MaterialItemId] < ing.quantity) {
                    return false;
                }
            }

            const newMaterials = { ...invStore.inventory.materials };
            let newEchoes = playerStore.echoes;

            for (const ing of caseData.recipe) {
                if (ing.itemId === 'echoes') {
                    newEchoes -= ing.quantity;
                } else {
                    newMaterials[ing.itemId as MaterialItemId] -= ing.quantity;
                }
            }

            const newCases = [...invStore.inventory.cases, { id: caseId, level: 1 }];
            getPlayerStore().setState({ echoes: newEchoes });
            getInventoryStore().setState({
                echoes: newEchoes,
                inventory: {
                    ...invStore.inventory,
                    materials: { ...newMaterials, echoes: newEchoes },
                    cases: newCases,
                },
            });
            return true;
        },

        upgradeCase: (caseIndex) => {
            const state = get();
            const invStore = getInventoryStore().getState();
            const playerStore = getPlayerStore().getState();
            const caseToUpgrade = invStore.inventory.cases[caseIndex];
            if (!caseToUpgrade) return false;

            const cost = getCaseUpgradeCost(caseToUpgrade.id, caseToUpgrade.level);

            for (const ing of cost) {
                if (ing.itemId === 'echoes') {
                    if (playerStore.echoes < ing.quantity) return false;
                } else if (invStore.inventory.materials[ing.itemId as MaterialItemId] < ing.quantity) {
                    return false;
                }
            }

            const newMaterials = { ...invStore.inventory.materials };
            let newEchoes = playerStore.echoes;

            for (const ing of cost) {
                if (ing.itemId === 'echoes') {
                    newEchoes -= ing.quantity;
                } else {
                    newMaterials[ing.itemId as MaterialItemId] -= ing.quantity;
                }
            }

            const newCases = [...invStore.inventory.cases];
            newCases[caseIndex] = { ...caseToUpgrade, level: caseToUpgrade.level + 1 };

            // If equipped, recalculate stats
            if (state.equippedCase?.id === caseToUpgrade.id && state.equippedCase?.level === caseToUpgrade.level) {
                const caseBonus = getCaseStats(caseToUpgrade.id, caseToUpgrade.level + 1);
                const slotMultiplier = getSlotMultiplier(state.caseSlot);
                const baseStats = calculateStats(playerStore.level, state.equippedReed, playerStore.embouchure, getSlotMultiplier(state.reedSlot), caseBonus.healthMultiplier, caseBonus.speedBonus * slotMultiplier);

                let mpCritBonus = 0;
                if (state.equippedMouthpiece) {
                    const mpStats = getMouthpieceStats(state.equippedMouthpiece.id, state.equippedMouthpiece.level);
                    mpCritBonus = mpStats.critChance * getSlotMultiplier(state.mouthpieceSlot);
                }

                const hpRatio = playerStore.maxHealth > 0 ? playerStore.health / playerStore.maxHealth : 1;
                const newHealth = Math.max(1, Math.floor(baseStats.health * caseBonus.healthMultiplier * hpRatio));

                set({ equippedCase: { id: caseToUpgrade.id, level: caseToUpgrade.level + 1 } });
                updatePlayerStats({
                    maxHealth: Math.floor(baseStats.health * caseBonus.healthMultiplier),
                    health: newHealth,
                    speed: baseStats.speed + caseBonus.speedBonus * slotMultiplier,
                    critChance: baseStats.critChance + mpCritBonus,
                    defense: baseStats.defense,
                });
            }

            getPlayerStore().setState({ echoes: newEchoes });
            getInventoryStore().setState({
                echoes: newEchoes,
                inventory: { ...invStore.inventory, materials: { ...newMaterials, echoes: newEchoes }, cases: newCases },
            });

            get()._invalidateBonusCaches();
            return true;
        },

        getCaseBonus: () => {
            const state = get();
            if (!state.equippedCase) return { healthMultiplier: 1, speedBonus: 0, name: '', isEvolved: false };
            const caseBonus = getCaseStats(state.equippedCase.id, state.equippedCase.level);
            const slotMultiplier = getSlotMultiplier(state.caseSlot);
            return { healthMultiplier: caseBonus.healthMultiplier, speedBonus: caseBonus.speedBonus * slotMultiplier, name: caseBonus.name, isEvolved: caseBonus.isEvolved };
        },

        setCaseSlot: (slotIndex) => {
            const state = get();
            if (state.ligatureSlot === slotIndex || state.mouthpieceSlot === slotIndex || state.reedSlot === slotIndex) return;
            set({ caseSlot: slotIndex, version: get().version + 1 });

            if (state.equippedCase) {
                const { level, embouchure, health, maxHealth } = getPlayerStats();
                const caseBonus = getCaseStats(state.equippedCase.id, state.equippedCase.level);
                const slotMultiplier = getSlotMultiplier(slotIndex);
                const baseStats = calculateStats(level, state.equippedReed, embouchure, getSlotMultiplier(state.reedSlot));

                let mpCritBonus = 0;
                if (state.equippedMouthpiece) {
                    const mpStats = getMouthpieceStats(state.equippedMouthpiece.id, state.equippedMouthpiece.level);
                    mpCritBonus = mpStats.critChance * getSlotMultiplier(state.mouthpieceSlot);
                }

                const hpRatio = maxHealth > 0 ? health / maxHealth : 1;
                const newHealth = Math.max(1, Math.floor(baseStats.health * caseBonus.healthMultiplier * hpRatio));

                updatePlayerStats({
                    maxHealth: Math.floor(baseStats.health * caseBonus.healthMultiplier),
                    health: newHealth,
                    speed: baseStats.speed + caseBonus.speedBonus * slotMultiplier,
                    critChance: baseStats.critChance + mpCritBonus,
                    defense: baseStats.defense,
                });
            }
            get()._invalidateBonusCaches();
        },

        // ========== CASE MELDING ==========

        meldCase: (caseIndex, meldType) => {
            const state = get();
            const playerStore = getPlayerStore().getState();
            if (playerStore.level < MELD_UNLOCK_LEVEL) return false;

            const invStore = getInventoryStore().getState();
            const caseToMeld = invStore.inventory.cases[caseIndex];
            if (!caseToMeld) return false;
            if (caseToMeld.meldType && caseToMeld.meldType !== meldType) return false;

            const currentTier = caseToMeld.meldTier || 0;

            if (currentTier === 0) {
                const newCases = [...invStore.inventory.cases];
                newCases[caseIndex] = { ...caseToMeld, meldType, meldTier: 1 };

                let updatedEquipped = state.equippedCase;
                if (state.equippedCase?.id === caseToMeld.id && state.equippedCase?.level === caseToMeld.level) {
                    updatedEquipped = { ...caseToMeld, meldType, meldTier: 1 };
                }

                set({ equippedCase: updatedEquipped });
                getInventoryStore().setState({ inventory: { ...invStore.inventory, cases: newCases } });
                return true;
            }

            if (currentTier >= 5) return false;

            const targetTier = currentTier + 1;
            const cost = getMeldTierCost(meldType, targetTier);

            for (const ing of cost) {
                const have = invStore.inventory.materials[ing.itemId as MaterialItemId] || 0;
                if (have < ing.quantity) return false;
            }

            const newMaterials = { ...invStore.inventory.materials };
            for (const ing of cost) { newMaterials[ing.itemId as MaterialItemId] -= ing.quantity; }

            const newCases = [...invStore.inventory.cases];
            newCases[caseIndex] = { ...caseToMeld, meldType, meldTier: targetTier };

            let updatedEquipped = state.equippedCase;
            if (state.equippedCase?.id === caseToMeld.id && state.equippedCase?.level === caseToMeld.level) {
                const newMeldStats = getMeldStats(meldType, targetTier);
                updatedEquipped = { ...caseToMeld, meldType, meldTier: targetTier };
                updatePlayerStats({ impact: newMeldStats.impact } as any);
            }

            set({ equippedCase: updatedEquipped });
            getInventoryStore().setState({ inventory: { ...invStore.inventory, materials: newMaterials, cases: newCases } });
            get()._invalidateBonusCaches();
            return true;
        },

        getMeldBonus: (): MeldStatBonus => {
            const state = get();
            if (!state.equippedCase?.meldType || !state.equippedCase?.meldTier) {
                return { defense: 0, selfHeal: 0, critChance: 0, impact: 0, lifesteal: 0 };
            }
            return getMeldStats(state.equippedCase.meldType, state.equippedCase.meldTier);
        },

        // ========== ENCHANTMENT ==========

        isEnchantmentSlotUnlocked: (tier) => {
            const ps = getPlayerStore().getState();
            return ps.level >= ENCHANTMENT_SLOT_LEVELS[tier];
        },

        craftEnchantment: (enchantmentId, tier) => {
            const state = get();
            if (!state.isEnchantmentSlotUnlocked(tier)) return false;

            const enchantmentData = getEnchantmentData(enchantmentId, tier);
            if (!enchantmentData) return false;

            const recipe = ALL_RECIPES.find(r => r.id === `enchantment_${enchantmentId}_craft`);
            if (!recipe) return false;

            const invStore = getInventoryStore().getState();
            for (const ing of recipe.ingredients) {
                const have = invStore.inventory.materials[ing.itemId as MaterialItemId] || 0;
                if (have < ing.quantity) return false;
            }

            const newMaterials = { ...invStore.inventory.materials };
            for (const ing of recipe.ingredients) {
                newMaterials[ing.itemId as MaterialItemId] = (newMaterials[ing.itemId as MaterialItemId] || 0) - ing.quantity;
            }

            const newEnchantment: EnchantmentInstance = { id: enchantmentId, tier };
            const newEnchantments = [...invStore.inventory.enchantments, newEnchantment];

            getInventoryStore().setState({
                inventory: { ...invStore.inventory, materials: newMaterials, enchantments: newEnchantments },
            });
            return true;
        },

        equipEnchantment: (enchantmentIndex) => {
            const state = get();
            const invStore = getInventoryStore().getState();
            const enchantment = invStore.inventory.enchantments[enchantmentIndex];
            if (!enchantment) return;
            if (!state.isEnchantmentSlotUnlocked(enchantment.tier)) return;

            const enchantmentData = getEnchantmentData(enchantment.id, enchantment.tier);
            const newEquippedEnchantments = { ...state.equippedEnchantments, [enchantment.tier]: enchantment };
            set({ equippedEnchantments: newEquippedEnchantments });

            if (enchantmentData.critFactorBonus) {
                set({ critFactor: state.critFactor + enchantmentData.critFactorBonus });
            }

            if (enchantment.id === 'empowering' && !state.hasEmpoweringSpeedBonus) {
                const ps = getPlayerStore().getState();
                set({ hasEmpoweringSpeedBonus: true });
                updatePlayerStats({ speed: ps.speed * (1 + (enchantmentData.permanentSpeedBonus || 0)) });
            }

            get()._invalidateBonusCaches();
        },

        unequipEnchantment: (tier) => {
            const state = get();
            const enchantment = state.equippedEnchantments[tier];
            if (!enchantment) return;

            const enchantmentData = getEnchantmentData(enchantment.id, enchantment.tier);
            set({ equippedEnchantments: { ...state.equippedEnchantments, [tier]: null } });

            if (enchantmentData.critFactorBonus) {
                set({ critFactor: Math.max(1.5, state.critFactor - enchantmentData.critFactorBonus) });
            }

            get()._invalidateBonusCaches();
        },

        getEnchantmentBonus: () => {
            const state = get();

            let critFactorBonus = 0;
            let defenseBonus = 0;
            let euphoniumDefenseBonus = 0;
            let trumpetDamageMultiplier = 1;
            let procAttackCount: number | null = null;
            let healPercent = 0;
            let hasPulse = false;
            let hasPercussive = false;
            let hasEmpowering = false;
            let hornRetaliationDamage = 0;
            let permanentSpeedBonus = 0;

            const commonEnchant = state.equippedEnchantments.common;
            if (commonEnchant) {
                const data = getEnchantmentData(commonEnchant.id, 'common');
                if (data.critFactorBonus) critFactorBonus += data.critFactorBonus;
                if (data.defenseBonus) defenseBonus += data.defenseBonus;
                if (data.procAttackCount) {
                    procAttackCount = data.procAttackCount;
                    healPercent = data.healPercent || 0;
                    if (commonEnchant.id === 'pulse') hasPulse = true;
                }
            }

            const infusedEnchant = state.equippedEnchantments.infused;
            if (infusedEnchant) {
                const data = getEnchantmentData(infusedEnchant.id, 'infused');
                if (data.critFactorBonus) critFactorBonus += data.critFactorBonus;
                if (data.defenseBonus) defenseBonus += data.defenseBonus;
                if (data.euphoniumDefenseBonus) euphoniumDefenseBonus += data.euphoniumDefenseBonus;
                if (data.trumpetDamageMultiplier) trumpetDamageMultiplier *= data.trumpetDamageMultiplier;
                if (data.procAttackCount) {
                    procAttackCount = data.procAttackCount;
                    healPercent = Math.max(healPercent, data.healPercent || 0);
                    if (infusedEnchant.id === 'percussive') hasPercussive = true;
                }
            }

            const arcaneEnchant = state.equippedEnchantments.arcane;
            if (arcaneEnchant) {
                const data = getEnchantmentData(arcaneEnchant.id, 'arcane');
                if (data.critFactorBonus) critFactorBonus += data.critFactorBonus;
                if (data.euphoniumDefenseBonus) euphoniumDefenseBonus += data.euphoniumDefenseBonus;
                if (data.trumpetDamageMultiplier) trumpetDamageMultiplier *= data.trumpetDamageMultiplier;
                if (data.hornRetaliationDamage) hornRetaliationDamage = data.hornRetaliationDamage;
                if (data.permanentSpeedBonus) permanentSpeedBonus += data.permanentSpeedBonus;
                if (data.procAttackCount) {
                    procAttackCount = data.procAttackCount;
                    healPercent = Math.max(healPercent, data.healPercent || 0);
                    if (arcaneEnchant.id === 'empowering') hasEmpowering = true;
                }
            }

            return {
                critFactorBonus, defenseBonus, euphoniumDefenseBonus, trumpetDamageMultiplier,
                procAttackCount, healPercent, hasPulse, hasPercussive, hasEmpowering,
                hornRetaliationDamage, permanentSpeedBonus,
            };
        },

        incrementAttackCounter: () => {
            const state = get();
            const newCounter = state.attackCounter + 1;
            const enchantmentBonus = state.getEnchantmentBonus();

            if (enchantmentBonus.procAttackCount && newCounter >= enchantmentBonus.procAttackCount) {
                const ps = getPlayerStore().getState();
                const healAmount = Math.floor(ps.maxHealth * enchantmentBonus.healPercent);
                if (healAmount > 0) ps.heal(healAmount);
                set({ attackCounter: 0 });
            } else {
                set({ attackCounter: newCounter });
            }
        },

        // ========== DUNGEON UPGRADES ==========

        getDungeonTimeLimit: () => {
            return GAME_CONFIG.BASE_DUNGEON_TIME + get().dungeonTimeBonus;
        },

        getNextDungeonUpgradeCost: () => {
            const currentBonus = get().dungeonTimeBonus;
            const currentTotal = 20 + currentBonus;

            let level = 0;
            let total = 20;
            while (total < currentTotal) {
                level++;
                total += (total < 108) ? 11 : 12;
            }

            const valves = 10 + (level * 5);
            const heavyValves = level + 1;
            const timeIncrease = currentTotal < 97 ? 11 : 12;
            return { valves, heavyValves, timeIncrease };
        },

        upgradeDungeonTime: () => {
            const state = get();
            const cost = state.getNextDungeonUpgradeCost();
            const invStore = getInventoryStore().getState();

            const valves = invStore.inventory.materials.valves || 0;
            const heavyValves = invStore.inventory.materials.heavy_valves || 0;

            if (valves < cost.valves || heavyValves < cost.heavyValves) return false;

            set({ dungeonTimeBonus: state.dungeonTimeBonus + cost.timeIncrease, version: state.version + 1 });
            getInventoryStore().setState((invState: any) => ({
                inventory: {
                    ...invState.inventory,
                    materials: {
                        ...invState.inventory.materials,
                        valves: invState.inventory.materials.valves - cost.valves,
                        heavy_valves: invState.inventory.materials.heavy_valves - cost.heavyValves,
                    },
                },
            }));
            return true;
        },
    }))
);

export default useAccessoryStore;
