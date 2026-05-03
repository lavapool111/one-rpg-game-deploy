"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { getStatsForLevel, getXpRequiredForLevel } from "../game/stats";
import {
    MaterialItemId,
    ReedStrength,
    REED_MULTIPLIERS,
    RECIPE_MAP,
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
    WeaponMeldType,
    WEAPON_TIER_DAMAGE_MULTIPLIERS,
    getWeaponMeldStats,
    getWeaponMeldTierCost,
} from "../game/inventory";
import { calculateIngredientsXp, ACTION_XP_BASE, XP_MULTIPLIERS } from "../game/xp";
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
    caseSpeedMultiplier: number = 1,
    permanentSpeedBonus: number = 0,
    weaponMeldTier: number = 0
) {
    const base = getStatsForLevel(level);
    const baseSpeed = GAME_CONFIG.STARTING_SPEED;
    const embouchureCritBonus = (embouchure - 1) * 0.02;

    // Formula: (BaseSpeed * (1 + ReedBonus + EnchantBonus)) + CaseBonusFlat
    // We treat Reed stats as multipliers (e.g. 1.16), so bonus is stats.speed - 1
    // caseSpeedMultiplier passed in contains (1 + CaseBonusFlat), so extract bonus.

    if (!reed) {
        const flatBonus = (caseSpeedMultiplier - 1);
        const finalSpeed = Number((baseSpeed * (1 + permanentSpeedBonus) + flatBonus).toFixed(2));
        return {
            ...base,
            health: Math.floor(base.health * caseHealthMultiplier),
            speed: finalSpeed,
            basicAttackDamage: weaponMeldTier > 0 ? Math.floor(base.damage * WEAPON_TIER_DAMAGE_MULTIPLIERS[weaponMeldTier]) : base.damage,
            critChance: embouchureCritBonus,
            defense: 0,
        };
    }

    const stats = REED_MULTIPLIERS[reed];
    const reedBonus = (stats.speed - 1) * slotMultiplier;
    const flatBonus = (caseSpeedMultiplier - 1);
    const finalSpeed = Number((baseSpeed * (1 + reedBonus + permanentSpeedBonus) + flatBonus).toFixed(2));

    return {
        level,
        health: Math.floor(base.health * caseHealthMultiplier),
        damage: base.damage,
        basicAttackDamage: weaponMeldTier > 0 ? Math.floor(base.damage * WEAPON_TIER_DAMAGE_MULTIPLIERS[weaponMeldTier]) : base.damage,
        speed: finalSpeed,
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

    // Weapon Melding
    weaponMeldType: WeaponMeldType | null;
    weaponMeldTier: number;

    // Performance caches
    _cachedLigatureBonus: ReturnType<AccessoryState['getLigatureBonus']> | null;
    _cachedMouthpieceBonus: ReturnType<AccessoryState['getMouthpieceBonus']> | null;
    _cachedCaseBonus: ReturnType<AccessoryState['getCaseBonus']> | null;
    _cachedMeldBonus: MeldStatBonus | null;
    _cachedWeaponMeldBonus: { primary: number; damageMultiplier: number } | null;
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
    getMouthpieceBonus: () => { critFactor: number; critChance: number; echoBonus: number };

    // Case Actions
    equipCase: (caseIndex: number) => void;
    unequipCase: () => void;
    craftCase: (caseId: CaseId) => boolean;
    upgradeCase: (caseIndex: number) => boolean;
    getCaseBonus: () => { healthMultiplier: number; speedMultiplier: number; name: string; isEvolved: boolean };

    // Case Melding
    meldCase: (caseIndex: number, meldType: MeldType) => boolean;
    getMeldBonus: () => MeldStatBonus;

    // Weapon Melding
    meldWeapon: (meldType: WeaponMeldType) => boolean;
    getWeaponMeldBonus: () => { primary: number; damageMultiplier: number };

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
    loadState: (saved: any) => void;
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
    if (!state.equippedCase) return { healthMultiplier: 1, speedMultiplier: 1 };
    const caseBonus = getCaseStats(state.equippedCase.id, state.equippedCase.level);
    const slotMultiplier = getSlotMultiplier(state.caseSlot);
    return {
        healthMultiplier: 1 + (caseBonus.healthMultiplier - 1) * slotMultiplier,
        speedMultiplier: 1 + (caseBonus.speedBonus * slotMultiplier),
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
    basicAttackDamage: number;
    speed: number;
    critChance: number;
    superCritChance: number;
    defense: number;
}>) {
    const acc = useAccessoryStore.getState();
    const ps = getPlayerStore().getState();

    // Apply weapon meld damage multiplier to basicAttackDamage if present
    if (stats.basicAttackDamage !== undefined) {
        const wTier = acc.weaponMeldTier || 0;
        if (wTier > 0) {
            stats.basicAttackDamage = Math.floor(stats.basicAttackDamage * WEAPON_TIER_DAMAGE_MULTIPLIERS[wTier]);
        }
    }

    getPlayerStore().setState({ ...stats, version: ps.version + 1 });
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
        weaponMeldType: null,
        weaponMeldTier: 0,
        version: 0,

        _cachedLigatureBonus: null,
        _cachedMouthpieceBonus: null,
        _cachedCaseBonus: null,
        _cachedMeldBonus: null,
        _cachedWeaponMeldBonus: null,
        _cachedEnchantmentBonus: null,

        _invalidateBonusCaches: () => set({
            _cachedLigatureBonus: null,
            _cachedMouthpieceBonus: null,
            _cachedCaseBonus: null,
            _cachedMeldBonus: null,
            _cachedWeaponMeldBonus: null,
            _cachedEnchantmentBonus: null,
            version: get().version + 1,
        }),

        // ========== REED ==========

        equipReed: (strength) => {
            const state = get();
            const { level, embouchure, health, maxHealth } = getPlayerStats();
            const invStore = getInventoryStore().getState();

            if (!strength) {
                const caseBonuses = getCurrentCaseBonuses(state);
                const enchantmentBonus = get().getEnchantmentBonus();
                const baseStats = calculateStats(level, null, embouchure, getSlotMultiplier(state.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedMultiplier, enchantmentBonus.permanentSpeedBonus);

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
            const enchantmentBonus = get().getEnchantmentBonus();
            const newStats = calculateStats(level, strength, embouchure, getSlotMultiplier(state.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedMultiplier, enchantmentBonus.permanentSpeedBonus);

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
            const enchantmentBonus = get().getEnchantmentBonus();
            const newStats = calculateStats(level, null, embouchure, getSlotMultiplier(state.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedMultiplier, enchantmentBonus.permanentSpeedBonus);

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
                const enchantmentBonus = get().getEnchantmentBonus();
                const newStats = calculateStats(level, null, embouchure, getSlotMultiplier(state.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedMultiplier, enchantmentBonus.permanentSpeedBonus);

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
                const enchantmentBonus = get().getEnchantmentBonus();
                const newStats = calculateStats(ps.level, state.equippedReed, embouchure, getSlotMultiplier(state.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedMultiplier, enchantmentBonus.permanentSpeedBonus);

                let mpCritBonus = 0;
                if (state.equippedMouthpiece) {
                    const mpStats = getMouthpieceStats(state.equippedMouthpiece.id, state.equippedMouthpiece.level);
                    mpCritBonus = mpStats.critChance * getSlotMultiplier(state.mouthpieceSlot);
                }

                const newSuperCritChance = (newCritChance > 1.0) ? (newCritChance - 1.0) / 10 : 0;
                getPlayerStore().setState({
                    embouchure,
                    embouchureXp,
                    critChance: newCritChance,
                    superCritChance: newSuperCritChance,
                    version: ps.version + 1
                });
                return;
            }

            getPlayerStore().setState({
                embouchure,
                embouchureXp,
                version: ps.version + 1
            });
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

            const recipe = RECIPE_MAP.get(`ligature_${ligatureId}_craft`);
            if (!recipe) return false;

            for (const ing of recipe.ingredients) {
                const have = invStore.inventory.materials[ing.itemId as MaterialItemId] || 0;
                if (have < ing.quantity) return false;
            }

            for (const ing of recipe.ingredients) {
                invStore.removeMaterial(ing.itemId as MaterialItemId, ing.quantity);
            }

            const newLigature: LigatureInstance = { id: ligatureId, level: 1 };
            const newLigatures = [...invStore.inventory.ligatures, newLigature];

            getInventoryStore().setState({
                inventory: { ...getInventoryStore().getState().inventory, ligatures: newLigatures },
            });

            // Award XP
            const xpReward = ACTION_XP_BASE.CRAFT_ACCESSORY + calculateIngredientsXp(recipe.ingredients);
            const { usePlayerStore } = require('./playerStore');
            usePlayerStore.getState().addXp(xpReward);

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

            for (const ing of upgradeCost) {
                invStore.removeMaterial(ing.itemId as MaterialItemId, ing.quantity);
            }

            const newLigatures = [...getInventoryStore().getState().inventory.ligatures];
            newLigatures[ligatureIndex] = { ...ligature, level: nextLevel };

            let newEquipped = state.equippedLigature;
            if (newEquipped && newEquipped.id === ligature.id && newEquipped.level === ligature.level) {
                newEquipped = { ...newEquipped, level: nextLevel };
            }

            set({ equippedLigature: newEquipped, version: get().version + 1 });
            getInventoryStore().setState({
                inventory: { ...getInventoryStore().getState().inventory, ligatures: newLigatures },
            });

            // Award XP
            const xpReward = ACTION_XP_BASE.UPGRADE_ACCESSORY +
                (nextLevel * XP_MULTIPLIERS.UPGRADE_LEVEL_FACTOR) +
                calculateIngredientsXp(upgradeCost);
            const { usePlayerStore } = require('./playerStore');
            usePlayerStore.getState().addXp(xpReward);

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
            const enchantmentBonus = get().getEnchantmentBonus();
            const baseStats = calculateStats(level, state.equippedReed, embouchure, getSlotMultiplier(state.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedMultiplier, enchantmentBonus.permanentSpeedBonus);

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
            const enchantmentBonus = get().getEnchantmentBonus();
            const baseStats = calculateStats(level, state.equippedReed, embouchure, getSlotMultiplier(state.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedMultiplier, enchantmentBonus.permanentSpeedBonus);

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

            for (const ing of mouthpieceData.recipe) {
                invStore.removeMaterial(ing.itemId as MaterialItemId, ing.quantity);
            }

            const newMouthpieces = [...invStore.inventory.mouthpieces, { id: mouthpieceId, level: 1 }];
            getInventoryStore().setState({
                inventory: { ...getInventoryStore().getState().inventory, mouthpieces: newMouthpieces },
            });

            // Award XP
            const xpReward = ACTION_XP_BASE.CRAFT_ACCESSORY + calculateIngredientsXp(mouthpieceData.recipe);
            const { usePlayerStore } = require('./playerStore');
            usePlayerStore.getState().addXp(xpReward);

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

            for (const ing of upgradeCost) {
                invStore.removeMaterial(ing.itemId as MaterialItemId, ing.quantity);
            }

            const newMouthpieces = [...getInventoryStore().getState().inventory.mouthpieces];
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
                const enchantmentBonus = get().getEnchantmentBonus();
                const baseStats = calculateStats(level, state.equippedReed, embouchure, getSlotMultiplier(state.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedMultiplier, enchantmentBonus.permanentSpeedBonus);
                updatePlayerStats({
                    critChance: baseStats.critChance + (mouthpieceBonus.critChance * slotMultiplier),
                    superCritChance: (baseStats.critChance + (mouthpieceBonus.critChance * slotMultiplier) > 1.0) ? (baseStats.critChance + (mouthpieceBonus.critChance * slotMultiplier) - 1.0) / 10 : 0,
                });
            }

            set({ equippedMouthpiece: newEquipped, critFactor: newCritFactor, version: get().version + 1 });
            getInventoryStore().setState({
                inventory: { ...getInventoryStore().getState().inventory, mouthpieces: newMouthpieces },
            });

            // Award XP
            const xpReward = ACTION_XP_BASE.UPGRADE_ACCESSORY +
                (nextLevel * XP_MULTIPLIERS.UPGRADE_LEVEL_FACTOR) +
                calculateIngredientsXp(upgradeCost);
            const { usePlayerStore } = require('./playerStore');
            usePlayerStore.getState().addXp(xpReward);

            get()._invalidateBonusCaches();
            return true;
        },

        getMouthpieceBonus: () => {
            const state = get();
            if (!state.equippedMouthpiece) return { critFactor: 0, critChance: 0, echoBonus: 0 };
            const stats = getMouthpieceStats(state.equippedMouthpiece.id, state.equippedMouthpiece.level);
            const slotMultiplier = getSlotMultiplier(state.mouthpieceSlot);
            return {
                critFactor: stats.critFactor * slotMultiplier,
                critChance: stats.critChance * slotMultiplier,
                echoBonus: (stats.echoBonus || 0) * slotMultiplier // Apply slot multiplier to echo bonus as well
            };
        },

        // ========== SLOT POSITION ==========

        setLigatureSlot: (slotIndex) => {
            const state = get();
            if (state.mouthpieceSlot === slotIndex || state.reedSlot === slotIndex) return;
            set({ ligatureSlot: slotIndex, version: state.version + 1 });
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
                const enchantmentBonus = get().getEnchantmentBonus();
                const baseStats = calculateStats(level, state.equippedReed, embouchure, getSlotMultiplier(state.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedMultiplier, enchantmentBonus.permanentSpeedBonus);

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
                const enchantmentBonus = get().getEnchantmentBonus();
                const newStats = calculateStats(level, state.equippedReed, embouchure, getSlotMultiplier(slotIndex), caseBonuses.healthMultiplier, caseBonuses.speedMultiplier, enchantmentBonus.permanentSpeedBonus);

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
            const caseSpeedMultiplier = 1 + (caseBonus.speedBonus * slotMultiplier);
            const enchantmentBonus = get().getEnchantmentBonus();
            const baseStats = calculateStats(level, state.equippedReed, embouchure, getSlotMultiplier(state.reedSlot), caseBonus.healthMultiplier, caseSpeedMultiplier, enchantmentBonus.permanentSpeedBonus);

            let mpCritBonus = 0;
            if (state.equippedMouthpiece) {
                const mpStats = getMouthpieceStats(state.equippedMouthpiece.id, state.equippedMouthpiece.level);
                mpCritBonus = mpStats.critChance * getSlotMultiplier(state.mouthpieceSlot);
            }

            const hpRatio = maxHealth > 0 ? health / maxHealth : 1;
            const newHealth = Math.max(1, Math.floor(baseStats.health * hpRatio));

            set({ equippedCase: caseToEquip, version: get().version + 1 });
            updatePlayerStats({
                maxHealth: baseStats.health,
                health: newHealth,
                speed: baseStats.speed,
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
            const enchantmentBonus = get().getEnchantmentBonus();
            const baseStats = calculateStats(level, state.equippedReed, embouchure, getSlotMultiplier(state.reedSlot), 1, 0, enchantmentBonus.permanentSpeedBonus);

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

            for (const ing of caseData.recipe) {
                invStore.removeMaterial(ing.itemId as MaterialItemId, ing.quantity);
            }

            const newCases = [...getInventoryStore().getState().inventory.cases, { id: caseId, level: 1 }];
            getInventoryStore().setState({
                inventory: {
                    ...getInventoryStore().getState().inventory,
                    cases: newCases,
                },
            });

            // Award XP
            const xpReward = ACTION_XP_BASE.CRAFT_ACCESSORY + calculateIngredientsXp(caseData.recipe);
            const { usePlayerStore } = require('./playerStore');
            usePlayerStore.getState().addXp(xpReward);

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

            for (const ing of cost) {
                invStore.removeMaterial(ing.itemId as MaterialItemId, ing.quantity);
            }

            const newCases = [...getInventoryStore().getState().inventory.cases];
            newCases[caseIndex] = { ...caseToUpgrade, level: caseToUpgrade.level + 1 };

            // If equipped, recalculate stats
            if (state.equippedCase?.id === caseToUpgrade.id && state.equippedCase?.level === caseToUpgrade.level) {
                const caseBonus = getCaseStats(caseToUpgrade.id, caseToUpgrade.level + 1);
                const slotMultiplier = getSlotMultiplier(state.caseSlot);
                const caseSpeedMultiplier = 1 + (caseBonus.speedBonus * slotMultiplier);
                const enchantmentBonus = get().getEnchantmentBonus();
                const baseStats = calculateStats(playerStore.level, state.equippedReed, playerStore.embouchure, getSlotMultiplier(state.reedSlot), caseBonus.healthMultiplier, caseSpeedMultiplier, enchantmentBonus.permanentSpeedBonus);

                let mpCritBonus = 0;
                if (state.equippedMouthpiece) {
                    const mpStats = getMouthpieceStats(state.equippedMouthpiece.id, state.equippedMouthpiece.level);
                    mpCritBonus = mpStats.critChance * getSlotMultiplier(state.mouthpieceSlot);
                }

                const hpRatio = playerStore.maxHealth > 0 ? playerStore.health / playerStore.maxHealth : 1;
                const newHealth = Math.max(1, Math.floor(baseStats.health * hpRatio));

                set({ equippedCase: { id: caseToUpgrade.id, level: caseToUpgrade.level + 1 } });
                updatePlayerStats({
                    maxHealth: baseStats.health,
                    health: newHealth,
                    speed: baseStats.speed,
                    critChance: baseStats.critChance + mpCritBonus,
                    defense: baseStats.defense,
                });
            }

            getInventoryStore().setState({
                inventory: { ...getInventoryStore().getState().inventory, cases: newCases },
            });

            get()._invalidateBonusCaches();
            return true;
        },

        getCaseBonus: () => {
            const state = get();
            if (!state.equippedCase) return { healthMultiplier: 1, speedMultiplier: 1, name: '', isEvolved: false };
            const caseBonus = getCaseStats(state.equippedCase.id, state.equippedCase.level);
            const slotMultiplier = getSlotMultiplier(state.caseSlot);
            return { healthMultiplier: caseBonus.healthMultiplier, speedMultiplier: 1 + (caseBonus.speedBonus * slotMultiplier), name: caseBonus.name, isEvolved: caseBonus.isEvolved };
        },

        setCaseSlot: (slotIndex) => {
            const state = get();
            if (state.ligatureSlot === slotIndex || state.mouthpieceSlot === slotIndex || state.reedSlot === slotIndex) return;
            set({ caseSlot: slotIndex, version: state.version + 1 });

            if (state.equippedCase) {
                const { level, embouchure, health, maxHealth } = getPlayerStats();
                const caseBonus = getCaseStats(state.equippedCase.id, state.equippedCase.level);
                const slotMultiplier = getSlotMultiplier(slotIndex);
                const caseSpeedMultiplier = 1 + (caseBonus.speedBonus * slotMultiplier);
                const enchantmentBonus = get().getEnchantmentBonus();
                const baseStats = calculateStats(level, state.equippedReed, embouchure, getSlotMultiplier(state.reedSlot), caseBonus.healthMultiplier, caseSpeedMultiplier, enchantmentBonus.permanentSpeedBonus);

                let mpCritBonus = 0;
                if (state.equippedMouthpiece) {
                    const mpStats = getMouthpieceStats(state.equippedMouthpiece.id, state.equippedMouthpiece.level);
                    mpCritBonus = mpStats.critChance * getSlotMultiplier(state.mouthpieceSlot);
                }

                const hpRatio = maxHealth > 0 ? health / maxHealth : 1;
                const newHealth = Math.max(1, Math.floor(baseStats.health * hpRatio));

                updatePlayerStats({
                    maxHealth: baseStats.health,
                    health: newHealth,
                    speed: baseStats.speed,
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
            if (state._cachedMeldBonus) return state._cachedMeldBonus;

            if (!state.equippedCase?.meldType || !state.equippedCase?.meldTier) {
                const zeroBonus = { defense: 0, selfHeal: 0, critChance: 0, impact: 0, lifesteal: 0 };
                set({ _cachedMeldBonus: zeroBonus });
                return zeroBonus;
            }
            const bonus = getMeldStats(state.equippedCase.meldType, state.equippedCase.meldTier);
            set({ _cachedMeldBonus: bonus });
            return bonus;
        },

        // ========== WEAPON MELDING ==========

        meldWeapon: (meldType) => {
            const state = get();
            const playerStore = getPlayerStore().getState();
            if (playerStore.level < MELD_UNLOCK_LEVEL) return false;

            const invStore = getInventoryStore().getState();
            const currentTier = state.weaponMeldTier;

            // If weapon already has a different meld type, reject
            if (state.weaponMeldType && state.weaponMeldType !== meldType) return false;

            // Tier 0 → 1: Free, just choose type
            if (currentTier === 0) {
                set({ weaponMeldType: meldType, weaponMeldTier: 1, version: get().version + 1 });
                // updatePlayerStats will now automatically handle the multiplier
                updatePlayerStats({ basicAttackDamage: playerStore.damage });
                get()._invalidateBonusCaches();
                return true;
            }

            if (currentTier >= 5) return false;

            const targetTier = currentTier + 1;
            const cost = getWeaponMeldTierCost(meldType, targetTier);

            for (const ing of cost) {
                const have = invStore.inventory.materials[ing.itemId as MaterialItemId] || 0;
                if (have < ing.quantity) return false;
            }

            const newMaterials = { ...invStore.inventory.materials };
            for (const ing of cost) { newMaterials[ing.itemId as MaterialItemId] -= ing.quantity; }

            set({ weaponMeldType: meldType, weaponMeldTier: targetTier, version: get().version + 1 });
            getInventoryStore().setState({ inventory: { ...invStore.inventory, materials: newMaterials } });

            // updatePlayerStats will now automatically handle the multiplier
            updatePlayerStats({ basicAttackDamage: playerStore.damage });

            get()._invalidateBonusCaches();
            return true;
        },

        getWeaponMeldBonus: () => {
            const state = get();
            if (state._cachedWeaponMeldBonus) return state._cachedWeaponMeldBonus;

            if (!state.weaponMeldType || state.weaponMeldTier < 1) {
                const zeroBonus = { primary: 0, damageMultiplier: 1.0 };
                set({ _cachedWeaponMeldBonus: zeroBonus });
                return zeroBonus;
            }
            const bonus = getWeaponMeldStats(state.weaponMeldType, state.weaponMeldTier);
            set({ _cachedWeaponMeldBonus: bonus });
            return bonus;
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

            const recipe = RECIPE_MAP.get(`enchantment_${enchantmentId}_craft`);
            if (!recipe) return false;

            const invStore = getInventoryStore().getState();
            for (const ing of recipe.ingredients) {
                const have = invStore.inventory.materials[ing.itemId as MaterialItemId] || 0;
                if (have < ing.quantity) return false;
            }

            for (const ing of recipe.ingredients) {
                invStore.removeMaterial(ing.itemId as MaterialItemId, ing.quantity);
            }

            const newEnchantment: EnchantmentInstance = { id: enchantmentId, tier };
            const newEnchantments = [...invStore.inventory.enchantments, newEnchantment];

            getInventoryStore().setState({
                inventory: { ...getInventoryStore().getState().inventory, enchantments: newEnchantments },
            });

            // Award XP
            const xpReward = calculateIngredientsXp(recipe.ingredients);
            const { usePlayerStore } = require('./playerStore');
            usePlayerStore.getState().addXp(xpReward);

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
                set({ hasEmpoweringSpeedBonus: true });
                // We no longer call updatePlayerStats with a direct multiplication here.
                // Instead, we invalidate caches so recalculateStats (which calls calculateStats) 
                // will pick up the new permanentSpeedBonus from getEnchantmentBonus().
            }

            get()._invalidateBonusCaches();
            // Trigger a re-calculation in playerStore to apply the new proc state
            const { usePlayerStore } = require('./playerStore');
            usePlayerStore.getState().recalculateStats();
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
                if (data.permanentSpeedBonus) {
                    // Special case for 'empowering' - only apply if already procced
                    if (arcaneEnchant.id === 'empowering') {
                        if (state.hasEmpoweringSpeedBonus) permanentSpeedBonus += data.permanentSpeedBonus;
                    } else {
                        permanentSpeedBonus += data.permanentSpeedBonus;
                    }
                }
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
            invStore.removeMaterial('valves', cost.valves);
            invStore.removeMaterial('heavy_valves', cost.heavyValves);

            // Award XP
            const currentTotal = 20 + state.dungeonTimeBonus;
            let level = 0;
            let total = 20;
            while (total < currentTotal) {
                level++;
                total += (total < 108) ? 11 : 12;
            }

            const xpReward = ACTION_XP_BASE.UPGRADE_DUNGEON_TIME +
                (level * 25) +
                calculateIngredientsXp([
                    { itemId: 'valves', quantity: cost.valves },
                    { itemId: 'heavy_valves', quantity: cost.heavyValves }
                ]);

            const { usePlayerStore } = require('./playerStore');
            usePlayerStore.getState().addXp(xpReward);

            return true;
        },

        loadState: (saved: any) => set((state) => ({
            equippedReed: saved.equippedReed ?? state.equippedReed,
            reedDurability: saved.reedDurability ?? state.reedDurability,
            equippedLigature: saved.equippedLigature ?? state.equippedLigature,
            equippedMouthpiece: saved.equippedMouthpiece ?? state.equippedMouthpiece,
            equippedCase: saved.equippedCase ?? state.equippedCase,
            ligatureSlot: saved.ligatureSlot ?? state.ligatureSlot,
            mouthpieceSlot: saved.mouthpieceSlot ?? state.mouthpieceSlot,
            caseSlot: saved.caseSlot ?? state.caseSlot,
            reedSlot: saved.reedSlot ?? state.reedSlot,
            equippedEnchantments: saved.equippedEnchantments ?? state.equippedEnchantments,
            enchantmentSlots: saved.enchantmentSlots ?? state.enchantmentSlots,
            attackCounter: saved.attackCounter ?? state.attackCounter,
            hasEmpoweringSpeedBonus: saved.hasEmpoweringSpeedBonus ?? state.hasEmpoweringSpeedBonus,
            dungeonTimeBonus: saved.dungeonTimeBonus ?? state.dungeonTimeBonus,
            weaponMeldType: saved.weaponMeldType ?? state.weaponMeldType,
            weaponMeldTier: saved.weaponMeldTier ?? state.weaponMeldTier,
            version: state.version + 1,
        })),
    }))
);

export default useAccessoryStore;
