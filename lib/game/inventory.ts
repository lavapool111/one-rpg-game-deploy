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
    | 'sheet_music_fragments';

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
    { strength: '5.0', name: 'Reed (5.0)', description: 'The hardest reed attainable as a beginner. Shows power and control.', rarity: 'legendary' as const, crit: 0.10, def: 0.30, speed: 1.16, recipe: [{ itemId: '4.5', quantity: 10 }, { itemId: 'echoes', quantity: 40 }, { itemId: 'valves', quantity: 32 }, { itemId: 'trombone_slides', quantity: 4 }, { itemId: 'valve_oil', quantity: 3 }] },
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

// Accessory item IDs (placeholder for future)
export type AccessoryItemId = 'placeholder';

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

    // Reeds - derived from REED_DATA
    ...Object.fromEntries(REED_DATA.map(r => [r.strength, {
        id: r.strength,
        name: r.name,
        description: r.description,
        category: 'reeds' as const,
        rarity: r.rarity,
    }])),

    // Accessories placeholder
    placeholder: {
        id: 'placeholder',
        name: 'Placeholder',
        description: 'Coming soon...',
        category: 'accessories',
    },
} as Record<ItemId, ItemDefinition>;

// Initial empty inventory
export const INITIAL_INVENTORY: Inventory = {
    materials: {
        echoes: 0,
        valves: 0,
        heavy_valves: 0,
        reinforced_valves: 0,
        infused_valves: 0,
        trombone_slides: 0,
        brass_ingots: 0,
        reinforced_brass_ingots: 0,
        infused_brass_ingots: 0,
        moonlight_azarite: 0,
        valve_oil: 0,
        cork_grease: 0,
        sheet_music_fragments: 0,
    },
    // Derive reeds inventory from REED_DATA
    reeds: Object.fromEntries(REED_DATA.map(r => [r.strength, 0])) as Record<ReedStrength, number>,
    accessories: {},
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
        description: 'Refine 1.0 reeds into 1.5.'
    },
    {
        id: 'reed_2.0_upgrade',
        outputId: '2.0',
        outputQuantity: 10,
        ingredients: [
            { itemId: '1.5', quantity: 10 },
            { itemId: 'echoes', quantity: 4 }
        ],
        description: 'Refine 1.5 reeds into 2.0.'
    },
];

// Combined recipes: primary reed recipes from REED_DATA + alternate recipes from CRAFTING_RECIPES
// Use this for the full list of available crafting options
export const ALL_RECIPES: Recipe[] = [
    // Primary reed recipes derived from REED_DATA
    ...REED_DATA.map(r => ({
        id: `reed_${r.strength}_craft`,
        outputId: r.strength as ItemId,
        outputQuantity: 10,
        ingredients: r.recipe.map(ing => ({ itemId: ing.itemId as ItemId, quantity: ing.quantity })),
        description: `Craft ${r.name}.`
    })),
    // Alternate recipes
    ...CRAFTING_RECIPES
];
