/**
 * Inventory System - Logic and Helpers
 * Imports data from inventoryData.ts and defines system logic
 */

import { GAME_CONFIG } from './config';
import {
    ReedStrength,
    REED_DATA,
    LigatureId,
    LIGATURE_DATA,
    CaseId,
    MeldType,
    MeldStatBonus,
    MELD_TIER_STATS,
    MELD_TIER_COSTS,
    CASE_DATA,
    MouthpieceId,
    MOUTHPIECE_DATA,
    ItemId,
    EnchantmentTier,
    EnchantmentId,
    EnchantmentDefinition,
    ENCHANTMENT_DATA,
    Inventory,
    Recipe,
    CRAFTING_RECIPES
} from './inventoryData';

// Re-export data and types for external use
export * from './inventoryData';

// ============= REED HELPERS =============

const REED_DATA_MAP = new Map(REED_DATA.map(r => [r.strength, r]));
export function getReedData(strength: ReedStrength) {
    return REED_DATA_MAP.get(strength)!;
}

// ============= LIGATURE HELPERS =============

const LIGATURE_DATA_MAP = new Map(LIGATURE_DATA.map(l => [l.id, l]));
export function getLigatureData(id: LigatureId) {
    return LIGATURE_DATA_MAP.get(id)!;
}

/**
 * Calculate ligature stats at a given level (stats scale linearly with level)
 */
export function getLigatureStats(id: LigatureId, level: number) {
    const data = getLigatureData(id);
    return {
        longToneBonus: data.longToneBonus * level,
        tubaDamageBonus: (data.tubaDamageBonus * (level - 1) * 0.4) + data.tubaDamageBonus
    };
}

/**
 * Get upgrade cost for a ligature (level * base cost)
 */
export function getLigatureUpgradeCost(id: LigatureId, currentLevel: number): any[] {
    const data = getLigatureData(id);
    const multiplier = currentLevel + 1; // Cost for next level
    const cost: { itemId: string; quantity: number }[] = data.recipe.map(item => ({
        itemId: item.itemId,
        quantity: Math.floor(item.quantity * multiplier)
    }));

    if (currentLevel >= 20) {
        cost.push({
            itemId: 'sheet_music_fragments_rare',
            quantity: currentLevel - 19
        });
    }

    return cost;
}

// ============= MELDING HELPERS =============

/**
 * Get the cumulative stat bonus for a meld type at a given tier
 */
export function getMeldStats(meldType: MeldType, tier: number): MeldStatBonus {
    const result: MeldStatBonus = { defense: 0, selfHeal: 0, critChance: 0, impact: 0, lifesteal: 0 };
    if (tier <= 1) return result; // Tier 1 has no stats

    const statKey: keyof MeldStatBonus =
        meldType === 'plated' ? 'defense' :
            meldType === 'weaved' ? 'selfHeal' :
                meldType === 'sundered' ? 'critChance' :
                    meldType === 'metallic' ? 'impact' :
                        'lifesteal';

    for (let t = 2; t <= tier; t++) {
        const tierStats = MELD_TIER_STATS[t - 2];
        result[statKey] += tierStats[statKey];
    }

    return result;
}

/**
 * Get the cost to upgrade to a target tier for a given meld type
 */
export function getMeldTierCost(meldType: MeldType, targetTier: number): Array<{ itemId: string; quantity: number }> {
    if (targetTier < 2 || targetTier > 5) return [];
    const costData = MELD_TIER_COSTS[targetTier - 2];
    const costs: Array<{ itemId: string; quantity: number }> = [];

    for (const frag of costData.fragments) {
        costs.push({ itemId: `${meldType}_fragment_t${frag.tier}`, quantity: frag.quantity });
    }

    if (costData.brassIngots > 0) costs.push({ itemId: 'brass_ingots', quantity: costData.brassIngots });
    if (costData.reinforcedBrassIngots > 0) costs.push({ itemId: 'reinforced_brass_ingots', quantity: costData.reinforcedBrassIngots });
    if (costData.infusedBrassIngots > 0) costs.push({ itemId: 'infused_brass_ingots', quantity: costData.infusedBrassIngots });

    return costs;
}

// ============= WEAPON MELDING HELPERS =============

import {
    WeaponMeldType,
    WeaponMeldTierStat,
    WEAPON_MELD_TIER_STATS,
    WEAPON_MELD_TIER_COSTS,
    WEAPON_TIER_DAMAGE_MULTIPLIERS,
} from './inventoryData';

/**
 * Get the primary stat bonus for a weapon meld type at a given tier
 */
export function getWeaponMeldStats(meldType: WeaponMeldType, tier: number): { primary: number; damageMultiplier: number } {
    if (tier < 1 || tier > 5) return { primary: 0, damageMultiplier: 1.0 };
    const tierStats = WEAPON_MELD_TIER_STATS[tier - 1];
    const damageMultiplier = WEAPON_TIER_DAMAGE_MULTIPLIERS[tier];

    const primaryKey: keyof WeaponMeldTierStat =
        meldType === 'plated' ? 'abilityTickBonus' :
            meldType === 'weaved' ? 'range' :
                meldType === 'sundered' ? 'critFactor' :
                    meldType === 'metallic' ? 'impact' :
                        'defensePenetration';

    return { primary: tierStats[primaryKey], damageMultiplier };
}

/**
 * Get the cost to upgrade a weapon meld to a target tier
 */
export function getWeaponMeldTierCost(meldType: WeaponMeldType, targetTier: number): Array<{ itemId: string; quantity: number }> {
    if (targetTier < 2 || targetTier > 5) return [];
    const costData = WEAPON_MELD_TIER_COSTS[targetTier - 2];
    const costs: Array<{ itemId: string; quantity: number }> = [];

    for (const frag of costData.fragments) {
        costs.push({ itemId: `${meldType}_fragment_t${frag.tier}`, quantity: frag.quantity });
    }

    if (costData.heavyValves > 0) costs.push({ itemId: 'heavy_valves', quantity: costData.heavyValves });
    if (costData.reinforcedValves > 0) costs.push({ itemId: 'reinforced_valves', quantity: costData.reinforcedValves });
    if (costData.infusedValves > 0) costs.push({ itemId: 'infused_valves', quantity: costData.infusedValves });
    if (costData.moonlightAzarite > 0) costs.push({ itemId: 'moonlight_azarite', quantity: costData.moonlightAzarite });

    return costs;
}

// ============= CASE HELPERS =============

const CASE_DATA_MAP = new Map(CASE_DATA.map(c => [c.id, c]));
export function getCaseData(id: CaseId) {
    return CASE_DATA_MAP.get(id)!;
}

/**
 * Calculate case stats at a given level
 */
export function getCaseStats(id: CaseId, level: number) {
    const data = getCaseData(id);
    const isEvolved = level >= 15;
    const evolvedName = isEvolved ? (id === 'fabric_case' ? 'Carbon Fiber Case' : 'Metal Case') : data.name;

    const healthMultiplier = Math.pow(1 + data.healthMultiplierPerLevel, level);

    return {
        name: evolvedName,
        healthMultiplier,
        speedBonus: data.speedBonusPerLevel * level,
        isEvolved
    };
}

/**
 * Get upgrade cost for a case (level * base cost)
 */
export function getCaseUpgradeCost(id: CaseId, currentLevel: number): any[] {
    const data = getCaseData(id);
    const multiplier = currentLevel + 1;
    const cost: { itemId: string; quantity: number }[] = data.recipe.map(item => ({
        itemId: item.itemId,
        quantity: item.quantity * multiplier
    }));

    if (currentLevel >= 20) {
        cost.push({ itemId: 'heavy_valves', quantity: (currentLevel - 19) * 4 });
    }

    if (currentLevel >= 40) {
        cost.push({ itemId: 'reinforced_valves', quantity: (currentLevel - 39) * 2 });
    }

    return cost;
}

// ============= MOUTHPIECE HELPERS =============

const MOUTHPIECE_DATA_MAP = new Map(MOUTHPIECE_DATA.map(m => [m.id, m]));
export function getMouthpieceData(id: MouthpieceId) {
    return MOUTHPIECE_DATA_MAP.get(id)!;
}

/**
 * Calculate mouthpiece stats at a given level
 */
export function getMouthpieceStats(id: MouthpieceId, level: number) {
    const data = getMouthpieceData(id) as any;
    const baseCritFactor = data.baseCritFactor || 0;
    const baseEchoBonus = data.baseEchoBonus || 0;
    const critFactorPerLevel = data.critFactorPerLevel || 0;
    const critChancePerLevel = data.critChancePerLevel || 0;
    const echoBonusPerLevel = data.echoBonusPerLevel || 0;

    const multiplier = data.baseCritFactor !== undefined ? Math.max(0, level - 1) : level;

    return {
        critFactor: baseCritFactor + (critFactorPerLevel * multiplier),
        critChance: critChancePerLevel * level,
        echoBonus: baseEchoBonus + (echoBonusPerLevel * multiplier)
    };
}

/**
 * Get upgrade cost for a mouthpiece (level * base cost)
 */
export function getMouthpieceUpgradeCost(id: MouthpieceId, currentLevel: number): any[] {
    const data = getMouthpieceData(id);
    const multiplier = currentLevel + 1;
    const cost: { itemId: string; quantity: number }[] = data.recipe.map(item => ({
        itemId: item.itemId,
        quantity: item.quantity * multiplier
    }));

    if (currentLevel >= 10) {
        cost.push({ itemId: 'brass_ingots', quantity: (currentLevel - 9) * 5 });
    }
    if (currentLevel >= 30) {
        cost.push({ itemId: 'reinforced_brass_ingots', quantity: (currentLevel - 29) * 5 });
    }

    return cost;
}

// ============= ENCHANTMENT HELPERS =============

/*
 Get enchantment data by ID and tier
 */
export function getEnchantmentData(id: EnchantmentId, tier: EnchantmentTier): EnchantmentDefinition {
    return ENCHANTMENT_DATA[tier][id as keyof typeof ENCHANTMENT_DATA[typeof tier]];
}

/**
 * Get all enchantments for a tier
 */
export function getEnchantmentsForTier(tier: EnchantmentTier) {
    return Object.values(ENCHANTMENT_DATA[tier]);
}

// ============= INVENTORY INITIALIZATION =============

/**
 * Initial inventory - uses config values for debug starting materials
 */
export function getInitialInventory(): Inventory {
    return {
        materials: {
            echoes: GAME_CONFIG.STARTING_ECHOES,
            valves: GAME_CONFIG.STARTING_MATERIALS.valves,
            heavy_valves: GAME_CONFIG.STARTING_MATERIALS.heavy_valves,
            reinforced_valves: GAME_CONFIG.STARTING_MATERIALS.reinforced_valves,
            infused_valves: GAME_CONFIG.STARTING_MATERIALS.infused_valves,
            trombone_slides: GAME_CONFIG.STARTING_MATERIALS.trombone_slides,
            brass_ingots: GAME_CONFIG.STARTING_MATERIALS.brass_ingots,
            reinforced_brass_ingots: GAME_CONFIG.STARTING_MATERIALS.reinforced_brass_ingots,
            infused_brass_ingots: GAME_CONFIG.STARTING_MATERIALS.infused_brass_ingots,
            moonlight_azarite: GAME_CONFIG.STARTING_MATERIALS.moonlight_azarite,
            valve_oil: GAME_CONFIG.STARTING_MATERIALS.valve_oil,
            cork_grease: GAME_CONFIG.STARTING_MATERIALS.cork_grease,
            sheet_music_fragments_common: GAME_CONFIG.STARTING_MATERIALS.sheet_music_fragments_common,
            sheet_music_fragments_rare: GAME_CONFIG.STARTING_MATERIALS.sheet_music_fragments_rare,
            sheet_music_fragments_legendary: GAME_CONFIG.STARTING_MATERIALS.sheet_music_fragments_legendary,
            spit_valve_liquid: GAME_CONFIG.STARTING_MATERIALS.spit_valve_liquid,
            brass_essence: GAME_CONFIG.STARTING_MATERIALS.brass_essence ?? 0,
            plated_fragment_t1: 0, plated_fragment_t2: 0, plated_fragment_t3: 0, plated_fragment_t4: 0, plated_fragment_t5: 0,
            weaved_fragment_t1: 0, weaved_fragment_t2: 0, weaved_fragment_t3: 0, weaved_fragment_t4: 0, weaved_fragment_t5: 0,
            sundered_fragment_t1: 0, sundered_fragment_t2: 0, sundered_fragment_t3: 0, sundered_fragment_t4: 0, sundered_fragment_t5: 0,
            metallic_fragment_t1: 0, metallic_fragment_t2: 0, metallic_fragment_t3: 0, metallic_fragment_t4: 0, metallic_fragment_t5: 0,
            corrupted_fragment_t1: 0, corrupted_fragment_t2: 0, corrupted_fragment_t3: 0, corrupted_fragment_t4: 0, corrupted_fragment_t5: 0,
        },
        reeds: Object.fromEntries(REED_DATA.map(r => [r.strength, 0])) as Record<ReedStrength, number>,
        accessories: {},
        ligatures: [],
        mouthpieces: [],
        cases: [],
        enchantments: [],
    };
}

// ============= UI HELPERS =============

export function getRarityColor(rarity?: string): string {
    switch (rarity) {
        case 'common': return 'text-slate-300';
        case 'uncommon': return 'text-green-400';
        case 'rare': return 'text-blue-400';
        case 'epic': return 'text-purple-400';
        case 'legendary': return 'text-yellow-400';
        default: return 'text-slate-300';
    }
}

export function getRarityBorderColor(rarity?: string): string {
    switch (rarity) {
        case 'common': return 'border-slate-500';
        case 'uncommon': return 'border-green-500';
        case 'rare': return 'border-blue-500';
        case 'epic': return 'border-purple-500';
        case 'legendary': return 'border-yellow-500';
        default: return 'border-slate-500';
    }
}

export function getRarityBgColor(rarity?: string): string {
    switch (rarity) {
        case 'common': return 'bg-slate-800/50';
        case 'uncommon': return 'bg-green-900/30';
        case 'rare': return 'bg-blue-900/30';
        case 'epic': return 'bg-purple-900/30';
        case 'legendary': return 'bg-yellow-900/30';
        default: return 'bg-slate-800/50';
    }
}

// ============= RECIPE GENERATION =============

/**
 * Generate all crafting and upgrade recipes
 */
function generateAllRecipes(): Recipe[] {
    // 1. Primary reed recipes derived from REED_DATA
    const reedBaseRecipes = REED_DATA.map(r => ({
        id: `reed_${r.strength}_craft`,
        outputId: r.strength as ItemId,
        outputQuantity: 10,
        ingredients: r.recipe.map(ing => ({ itemId: ing.itemId as ItemId, quantity: ing.quantity })),
        description: `Craft ${r.name}.`,
        category: 'reeds' as const
    }));

    // 2. Accessory Base Recipes
    const ligatureBaseRecipes = LIGATURE_DATA.map(l => ({
        id: `ligature_${l.id}_craft`,
        outputId: l.id as ItemId,
        outputQuantity: 1,
        ingredients: l.recipe.map(ing => ({ itemId: ing.itemId as ItemId, quantity: ing.quantity })),
        description: `Craft a ${l.name}.`,
        category: 'ligatures' as const
    }));

    const mouthpieceBaseRecipes = MOUTHPIECE_DATA.map(m => ({
        id: `mouthpiece_${m.id}_craft`,
        outputId: m.id as ItemId,
        outputQuantity: 1,
        ingredients: m.recipe.map(ing => ({ itemId: ing.itemId as ItemId, quantity: ing.quantity })),
        description: `Craft a ${m.name}.`,
        category: 'mouthpieces' as const
    }));

    const caseBaseRecipes = CASE_DATA.map(c => ({
        id: `case_${c.id}_craft`,
        outputId: c.id as ItemId,
        outputQuantity: 1,
        ingredients: c.recipe.map(ing => ({ itemId: ing.itemId as ItemId, quantity: ing.quantity })),
        description: `Craft a ${c.name}.`,
        category: 'cases' as const
    }));

    // 3. Accessory Upgrade Recipes
    const upgradeRecipes: Recipe[] = [];

    for (const ligature of LIGATURE_DATA) {
        for (let level = 1; level <= 200; level++) {
            upgradeRecipes.push({
                id: `ligature_${ligature.id}_upgrade_${level + 1}`,
                outputId: ligature.id as ItemId,
                outputQuantity: 1,
                ingredients: getLigatureUpgradeCost(ligature.id, level),
                description: `Upgrade ${ligature.name} to Level ${level + 1}.`,
                category: 'ligatures' as const
            });
        }
    }

    for (const mouthpiece of MOUTHPIECE_DATA) {
        for (let level = 1; level <= 200; level++) {
            upgradeRecipes.push({
                id: `mouthpiece_${mouthpiece.id}_upgrade_${level + 1}`,
                outputId: mouthpiece.id as ItemId,
                outputQuantity: 1,
                ingredients: getMouthpieceUpgradeCost(mouthpiece.id, level),
                description: `Upgrade ${mouthpiece.name} to Level ${level + 1}.`,
                category: 'mouthpieces' as const
            });
        }
    }

    for (const caseItem of CASE_DATA) {
        for (let level = 1; level <= 200; level++) {
            upgradeRecipes.push({
                id: `case_${caseItem.id}_upgrade_${level + 1}`,
                outputId: caseItem.id as ItemId,
                outputQuantity: 1,
                ingredients: getCaseUpgradeCost(caseItem.id, level),
                description: `Upgrade ${caseItem.name} to Level ${level + 1}.`,
                category: 'cases' as const
            });
        }
    }

    // 4. Enchantment Recipes
    const enchantmentRecipes: Recipe[] = [
        ...Object.values(ENCHANTMENT_DATA.common),
        ...Object.values(ENCHANTMENT_DATA.infused),
        ...Object.values(ENCHANTMENT_DATA.arcane)
    ].map(e => ({
        id: `enchantment_${e.id}_craft`,
        outputId: e.id as ItemId,
        outputQuantity: 1,
        ingredients: e.recipe.map(ing => ({ itemId: ing.itemId as ItemId, quantity: ing.quantity })),
        description: `Craft ${e.name} enchantment.`,
        category: 'enchantments' as const
    }));

    return [
        ...reedBaseRecipes,
        ...CRAFTING_RECIPES,
        ...ligatureBaseRecipes,
        ...mouthpieceBaseRecipes,
        ...caseBaseRecipes,
        ...upgradeRecipes,
        ...enchantmentRecipes
    ];
}

export const ALL_RECIPES = generateAllRecipes();
export const RECIPE_MAP = new Map(ALL_RECIPES.map(r => [r.id, r]));
export const MATERIAL_RECIPES = ALL_RECIPES.filter(r => r.category === 'materials');
export const REED_RECIPES = ALL_RECIPES.filter(r => r.category === 'reeds');
