/**
 * Inventory System
 * Defines item types, categories, and inventory structure
 */

// Item Categories
export type ItemCategory = 'materials' | 'reeds' | 'accessories';

// Material item IDs
export type MaterialItemId =
    | 'echoes'
    | 'valves'
    | 'heavy_valves'
    | 'reinforced_valves'
    | 'infused_valves'
    | 'trombone_slides'
    | 'brass_ingots'
    | 'reinforced_brass_ingots'
    | 'infused_brass_ingots'
    | 'moonlight_azarite'
    | 'valve_oil'
    | 'cork_grease'
    | 'sheet_music_fragments'
    | 'spit_valve_liquid';

// Master Reed Data Array - Add new reeds here
// All reed-related types and records are derived from this array
// recipe = full ingredients list to craft/buy this reed
export const REED_DATA = [
    { strength: '1.0', name: 'Reed (1.0)', description: 'A very soft reed. Easy to play, quiet tone.', rarity: 'common' as const, crit: 0.00, def: 0.00, speed: 1.0, recipe: [{ itemId: 'echoes', quantity: 5 }] },
    { strength: '1.5', name: 'Reed (1.5)', description: 'A soft-medium reed. Beginner friendly.', rarity: 'common' as const, crit: 0.0125, def: 0.0375, speed: 1.02, recipe: [{ itemId: 'echoes', quantity: 8 }] },
    { strength: '2.0', name: 'Reed (2.0)', description: 'A medium-soft reed. Good for developing players.', rarity: 'common' as const, crit: 0.025, def: 0.075, speed: 1.04, recipe: [{ itemId: 'echoes', quantity: 12 }] },
    { strength: '2.5', name: 'Reed (2.5)', description: 'A medium reed. Balanced tone and response.', rarity: 'uncommon' as const, crit: 0.0375, def: 0.1125, speed: 1.06, recipe: [{ itemId: '2.0', quantity: 10 }, { itemId: 'echoes', quantity: 10 }, { itemId: 'valves', quantity: 5 }] },
    { strength: '3.0', name: 'Reed (3.0)', description: 'A standard medium reed. Versatile choice.', rarity: 'uncommon' as const, crit: 0.05, def: 0.15, speed: 1.08, recipe: [{ itemId: '2.5', quantity: 10 }, { itemId: 'echoes', quantity: 14 }, { itemId: 'valves', quantity: 7 }, { itemId: 'trombone_slides', quantity: 1 }] },
    { strength: '3.5', name: 'Reed (3.5)', description: 'A medium-hard reed. Rich, projecting tone.', rarity: 'rare' as const, crit: 0.0625, def: 0.1875, speed: 1.10, recipe: [{ itemId: '3.0', quantity: 10 }, { itemId: 'echoes', quantity: 20 }, { itemId: 'valves', quantity: 12 }, { itemId: 'trombone_slides', quantity: 2 }] },
    { strength: '4.0', name: 'Reed (4.0)', description: 'A hard reed. Powerful tone, requires skill.', rarity: 'rare' as const, crit: 0.075, def: 0.225, speed: 1.12, recipe: [{ itemId: '3.5', quantity: 10 }, { itemId: 'echoes', quantity: 24 }, { itemId: 'valves', quantity: 16 }, { itemId: 'trombone_slides', quantity: 2 }, { itemId: 'valve_oil', quantity: 1 }] },
    { strength: '4.5', name: 'Reed (4.5)', description: 'A very hard reed. Demands a strong embouchure.', rarity: 'epic' as const, crit: 0.0875, def: 0.2625, speed: 1.14, recipe: [{ itemId: '4.0', quantity: 10 }, { itemId: 'echoes', quantity: 36 }, { itemId: 'valves', quantity: 24 }, { itemId: 'trombone_slides', quantity: 3 }, { itemId: 'valve_oil', quantity: 2 }] },
    { strength: '5.0', name: 'Reed (5.0)', description: 'Amour.', rarity: 'legendary' as const, crit: 0.10, def: 0.30, speed: 1.16, recipe: [{ itemId: '4.5', quantity: 10 }, { itemId: 'echoes', quantity: 40 }, { itemId: 'valves', quantity: 32 }, { itemId: 'trombone_slides', quantity: 4 }, { itemId: 'valve_oil', quantity: 3 }] },
] as const;

// Derive ReedStrength type from the master array
export type ReedStrength = typeof REED_DATA[number]['strength'];

// Derive REED_MULTIPLIERS from master array (renamed to REED_STATS maybe? keeping name to minimize breakage if used elsewhere, but updating type)
export const REED_MULTIPLIERS: Record<ReedStrength, { crit: number; def: number; speed: number }> =
    Object.fromEntries(REED_DATA.map(r => [r.strength, { crit: r.crit, def: r.def, speed: r.speed }])) as any;

// Helper to get reed data by strength
export function getReedData(strength: ReedStrength) {
    return REED_DATA.find(r => r.strength === strength)!;
}

// ============= LIGATURE SYSTEM =============
// Ligatures are accessories for clarinets and saxophones that modify Long Tone duration
// and provide passive defense against Tubas (and future Euphoniums)

export type LigatureId =
    | 'one_screw_fabric'
    | 'two_screw_fabric'
    | 'one_screw_metal'
    | 'two_screw_metal'
    | 'one_screw_reinforced_metal'
    | 'two_screw_reinforced_metal';

export interface LigatureInstance {
    id: LigatureId;
    level: number; // 1-10, stats scale with level
}

// Master Ligature Data Array
// longToneBonus = seconds added to Long Tone duration (at level 1)
// lowBrassDefense = passive defense % against Tubas/Euphoniums (at level 1)
export const LIGATURE_DATA = [
    {
        id: 'one_screw_fabric' as const,
        name: 'One-Screw Fabric Ligature',
        description: 'A basic fabric ligature with a single screw adjustment.',
        rarity: 'common' as const,
        longToneBonus: 0.1,
        lowBrassDefense: 0.10,
        recipe: [
            { itemId: 'echoes', quantity: 15 },
            { itemId: 'sheet_music_fragments', quantity: 2 }
        ]
    },
    {
        id: 'two_screw_fabric' as const,
        name: 'Two-Screw Fabric Ligature',
        description: 'A fabric ligature with dual screw adjustment for better control.',
        rarity: 'common' as const,
        longToneBonus: 0.2,
        lowBrassDefense: 0.05,
        recipe: [
            { itemId: 'echoes', quantity: 15 },
            { itemId: 'sheet_music_fragments', quantity: 4 }
        ]
    },
    {
        id: 'one_screw_metal' as const,
        name: 'One-Screw Metal Ligature',
        description: 'A sturdy metal ligature with a single secure fastening.',
        rarity: 'uncommon' as const,
        longToneBonus: 0.2,
        lowBrassDefense: 0.25,
        recipe: [
            { itemId: 'echoes', quantity: 30 },
            { itemId: 'sheet_music_fragments', quantity: 3 },
            { itemId: 'trombone_slides', quantity: 1 }
        ]
    },
    {
        id: 'two_screw_metal' as const,
        name: 'Two-Screw Metal Ligature',
        description: 'A metal ligature with dual fastening for optimal resonance.',
        rarity: 'uncommon' as const,
        longToneBonus: 0.35,
        lowBrassDefense: 0.15,
        recipe: [
            { itemId: 'echoes', quantity: 30 },
            { itemId: 'sheet_music_fragments', quantity: 6 },
            { itemId: 'trombone_slides', quantity: 2 }
        ]
    },
    {
        id: 'one_screw_reinforced_metal' as const,
        name: 'One-Screw Reinforced Metal Ligature',
        description: 'A reinforced metal ligature with maximum durability.',
        rarity: 'rare' as const,
        longToneBonus: 0.4,
        lowBrassDefense: 0.35,
        recipe: [
            { itemId: 'echoes', quantity: 45 },
            { itemId: 'sheet_music_fragments', quantity: 6 },
            { itemId: 'trombone_slides', quantity: 2 }
        ]
    },
    {
        id: 'two_screw_reinforced_metal' as const,
        name: 'Two-Screw Reinforced Metal Ligature',
        description: 'The ultimate reinforced metal ligature with supreme protection.',
        rarity: 'epic' as const,
        longToneBonus: 0.72,
        lowBrassDefense: 0.275,
        recipe: [
            { itemId: 'echoes', quantity: 45 },
            { itemId: 'sheet_music_fragments', quantity: 10 },
            { itemId: 'trombone_slides', quantity: 3 }
        ]
    }
] as const;

// Helper to get ligature data by ID
export function getLigatureData(id: LigatureId) {
    return LIGATURE_DATA.find(l => l.id === id)!;
}

// Calculate ligature stats at a given level (stats scale linearly with level)
export function getLigatureStats(id: LigatureId, level: number) {
    const data = getLigatureData(id);
    return {
        longToneBonus: data.longToneBonus * level,
        lowBrassDefense: Math.min(0.9, data.lowBrassDefense * level) // Cap at 90%
    };
}

// ============= MOUTHPIECE/ROSIN SYSTEM =============
// Mouthpieces (for clarinet) / Rosin (for viola)
// Two types: Plastic/Soft (crit factor) and Rubber/Hard (crit chance)

export type MouthpieceId = 'plastic' | 'rubber';

export interface MouthpieceInstance {
    id: MouthpieceId;
    level: number; // 1-10
}

// Mouthpiece data with class-specific names
export const MOUTHPIECE_DATA = [
    {
        id: 'plastic' as const,
        name: 'Plastic Mouthpiece',
        violaName: 'Soft Rosin',
        description: 'A flexible plastic mouthpiece that enhances critical hit damage.',
        violaDescription: 'A soft rosin that enhances bow control for critical strikes.',
        rarity: 'uncommon' as const,
        critFactorPerLevel: 0.1, // +0.1 crit factor per level (adds to 1.5x base)
        critChancePerLevel: 0, // No crit chance
        recipe: [
            { itemId: 'echoes', quantity: 40 },
            { itemId: 'spit_valve_liquid', quantity: 80 },
            { itemId: 'valves', quantity: 5 }
        ]
    },
    {
        id: 'rubber' as const,
        name: 'Rubber Mouthpiece',
        violaName: 'Hard Rosin',
        description: 'A resilient rubber mouthpiece that increases critical hit chance.',
        violaDescription: 'A hard rosin that provides consistent grip for precise attacks.',
        rarity: 'uncommon' as const,
        critFactorPerLevel: 0, // No crit factor
        critChancePerLevel: 0.02, // +2% crit chance per level
        recipe: [
            { itemId: 'echoes', quantity: 30 },
            { itemId: 'spit_valve_liquid', quantity: 100 },
            { itemId: 'valves', quantity: 6 }
        ]
    }
] as const;

// Helper to get mouthpiece data by ID
export function getMouthpieceData(id: MouthpieceId) {
    return MOUTHPIECE_DATA.find(m => m.id === id)!;
}

// Calculate mouthpiece stats at a given level
export function getMouthpieceStats(id: MouthpieceId, level: number) {
    const data = getMouthpieceData(id);
    return {
        critFactor: data.critFactorPerLevel * level, // Added to base 1.5x crit multiplier
        critChance: data.critChancePerLevel * level // Added to crit chance
    };
}

// Get upgrade cost for a mouthpiece (level * base cost)
export function getMouthpieceUpgradeCost(id: MouthpieceId, currentLevel: number) {
    const data = getMouthpieceData(id);
    const multiplier = currentLevel + 1; // Cost for next level
    return data.recipe.map(item => ({
        itemId: item.itemId,
        quantity: item.quantity * multiplier
    }));
}

// Accessory item IDs (includes ligatures and mouthpieces)
export type AccessoryItemId = LigatureId | MouthpieceId | 'placeholder';

// Combined item ID type
export type ItemId = MaterialItemId | ReedStrength | AccessoryItemId;

// Item definition with metadata
export interface ItemDefinition {
    id: ItemId;
    name: string;
    description: string;
    category: ItemCategory;
    rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    icon?: string; // Future: path to icon
}

// Inventory item (item with quantity)
export interface InventoryItem {
    itemId: ItemId;
    quantity: number;
}

// Full inventory structure
export interface Inventory {
    materials: Record<MaterialItemId, number>;
    reeds: Record<ReedStrength, number>;
    accessories: Record<string, number>;
    ligatures: LigatureInstance[]; // Owned ligatures with levels
    mouthpieces: MouthpieceInstance[]; // Owned mouthpieces with levels
}

// Item definitions catalog
export const ITEM_DEFINITIONS = {
    // Materials
    echoes: {
        id: 'echoes',
        name: 'Echoes',
        description: 'Resonant fragments of sound, used as currency.',
        category: 'materials',
        rarity: 'common',
    },
    valves: {
        id: 'valves',
        name: 'Valves',
        description: 'Precision brass valves salvaged from fallen enemies.',
        category: 'materials',
        rarity: 'common',
    },
    heavy_valves: {
        id: 'heavy_valves',
        name: 'Heavy Valves',
        description: 'Massive brass valves from powerful Tubas. Dense and durable.',
        category: 'materials',
        rarity: 'uncommon',
    },
    reinforced_valves: {
        id: 'reinforced_valves',
        name: 'Reinforced Valves',
        description: 'Heavy valves strengthened with additional brass layers.',
        category: 'materials',
        rarity: 'rare',
    },
    infused_valves: {
        id: 'infused_valves',
        name: 'Infused Valves',
        description: 'Valves infused with harmonic resonance. Hum with latent power.',
        category: 'materials',
        rarity: 'epic',
    },
    trombone_slides: {
        id: 'trombone_slides',
        name: 'Trombone Slides',
        description: 'Smooth metal slides with perfect glide.',
        category: 'materials',
        rarity: 'uncommon',
    },
    brass_ingots: {
        id: 'brass_ingots',
        name: 'Brass Ingots',
        description: 'Raw brass material for crafting.',
        category: 'materials',
        rarity: 'common',
    },
    reinforced_brass_ingots: {
        id: 'reinforced_brass_ingots',
        name: 'Reinforced Brass Ingots',
        description: 'Strengthened brass for advanced crafting.',
        category: 'materials',
        rarity: 'uncommon',
    },
    infused_brass_ingots: {
        id: 'infused_brass_ingots',
        name: 'Infused Brass Ingots',
        description: 'Brass infused with harmonic energy.',
        category: 'materials',
        rarity: 'rare',
    },
    moonlight_azarite: {
        id: 'moonlight_azarite',
        name: 'Moonlight Azarite',
        description: 'A rare crystal that glows with lunar resonance.',
        category: 'materials',
        rarity: 'epic',
    },
    valve_oil: {
        id: 'valve_oil',
        name: 'Valve Oil',
        description: 'Lubricant to keep instruments running smoothly.',
        category: 'materials',
        rarity: 'common',
    },
    cork_grease: {
        id: 'cork_grease',
        name: 'Cork Grease',
        description: 'Essential for maintaining clarinet joints.',
        category: 'materials',
        rarity: 'common',
    },
    sheet_music_fragments: {
        id: 'sheet_music_fragments',
        name: 'Sheet Music Fragments',
        description: 'Torn pages from ancient compositions.',
        category: 'materials',
        rarity: 'uncommon',
    },
    spit_valve_liquid: {
        id: 'spit_valve_liquid',
        name: 'Spit Valve Liquid',
        description: 'A glowing, viscous liquid collected from brass instruments. Gross but powerful.',
        category: 'materials',
        rarity: 'common',
    },

    // Reeds - derived from REED_DATA
    ...Object.fromEntries(REED_DATA.map(r => [r.strength, {
        id: r.strength,
        name: r.name,
        description: r.description,
        category: 'reeds' as const,
        rarity: r.rarity,
    }])),

    // Ligatures - derived from LIGATURE_DATA
    ...Object.fromEntries(LIGATURE_DATA.map(l => [l.id, {
        id: l.id,
        name: l.name,
        description: l.description,
        category: 'accessories' as const,
        rarity: l.rarity,
    }])),
} as Record<ItemId, ItemDefinition>;

// Initial inventory - uses config values for debug starting materials
import { GAME_CONFIG } from './config';

export const INITIAL_INVENTORY: Inventory = {
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
        sheet_music_fragments: GAME_CONFIG.STARTING_MATERIALS.sheet_music_fragments,
        spit_valve_liquid: GAME_CONFIG.STARTING_MATERIALS.spit_valve_liquid,
    },
    // Derive reeds inventory from REED_DATA
    reeds: Object.fromEntries(REED_DATA.map(r => [r.strength, 0])) as Record<ReedStrength, number>,
    accessories: {},
    ligatures: [], // Empty array, ligatures are owned with levels
    mouthpieces: [], // Empty array, mouthpieces are owned with levels
};

// Helper function to get rarity color
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

// Crafting System
export interface Ingredient {
    itemId: ItemId;
    quantity: number;
}

export interface Recipe {
    id: string;
    outputId: ItemId;
    outputQuantity: number;
    ingredients: Ingredient[];
    description?: string;
    category?: 'materials' | 'reeds' | 'ligatures'; // For UI sub-tabs
}

export const CRAFTING_RECIPES: Recipe[] = [
    // Alternate Reed Recipes (upgrade paths instead of direct purchase)
    // These provide an alternative way to get reeds using previous tier + fewer echoes
    {
        id: 'reed_1.5_upgrade',
        outputId: '1.5',
        outputQuantity: 10,
        ingredients: [
            { itemId: '1.0', quantity: 10 },
            { itemId: 'echoes', quantity: 3 }
        ],
        description: 'Refine 1.0 reeds into 1.5.',
        category: 'reeds'
    },
    {
        id: 'reed_2.0_upgrade',
        outputId: '2.0',
        outputQuantity: 10,
        ingredients: [
            { itemId: '1.5', quantity: 10 },
            { itemId: 'echoes', quantity: 4 }
        ],
        description: 'Refine 1.5 reeds into 2.0.',
        category: 'reeds'
    },
    // Material Crafting
    {
        id: 'heavy_valve_craft',
        outputId: 'heavy_valves',
        outputQuantity: 1,
        ingredients: [
            { itemId: 'valves', quantity: 10 },
            { itemId: 'brass_ingots', quantity: 5 }
        ],
        description: 'Forge ordinary valves and brass into a heavy valve.',
        category: 'materials'
    },
];

// Generate ligature base crafting recipes
const LIGATURE_BASE_RECIPES: Recipe[] = LIGATURE_DATA.map(l => ({
    id: `ligature_${l.id}_craft`,
    outputId: l.id as ItemId,
    outputQuantity: 1,
    ingredients: l.recipe.map(ing => ({ itemId: ing.itemId as ItemId, quantity: ing.quantity })),
    description: `Craft a ${l.name}.`,
    category: 'ligatures' as const
}));

// Generate ligature upgrade recipes (levels 2-10)
// Level N costs N times the base recipe
const LIGATURE_UPGRADE_RECIPES: Recipe[] = [];
for (const ligature of LIGATURE_DATA) {
    for (let level = 2; level <= 10; level++) {
        LIGATURE_UPGRADE_RECIPES.push({
            id: `ligature_${ligature.id}_upgrade_${level}`,
            outputId: ligature.id as ItemId,
            outputQuantity: 1,
            ingredients: ligature.recipe.map(ing => ({
                itemId: ing.itemId as ItemId,
                quantity: ing.quantity * level
            })),
            description: `Upgrade ${ligature.name} to Level ${level}.`,
            category: 'ligatures' as const
        });
    }
}

// Combined recipes: primary reed recipes from REED_DATA + alternate recipes from CRAFTING_RECIPES
// Use this for the full list of available crafting options
export const ALL_RECIPES: Recipe[] = [
    // Primary reed recipes derived from REED_DATA
    ...REED_DATA.map(r => ({
        id: `reed_${r.strength}_craft`,
        outputId: r.strength as ItemId,
        outputQuantity: 10,
        ingredients: r.recipe.map(ing => ({ itemId: ing.itemId as ItemId, quantity: ing.quantity })),
        description: `Craft ${r.name}.`,
        category: 'reeds' as const
    })),
    // Alternate recipes (materials & reeds)
    ...CRAFTING_RECIPES,
    // Ligature base crafting
    ...LIGATURE_BASE_RECIPES,
    // Ligature upgrades
    ...LIGATURE_UPGRADE_RECIPES
];

