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
    | 'sheet_music_fragments_common'
    | 'sheet_music_fragments_rare'
    | 'sheet_music_fragments_legendary'
    | 'spit_valve_liquid'
    | 'brass_essence'
    // Case Fragments (5 types × 5 tiers)
    | 'plated_fragment_t1' | 'plated_fragment_t2' | 'plated_fragment_t3' | 'plated_fragment_t4' | 'plated_fragment_t5'
    | 'weaved_fragment_t1' | 'weaved_fragment_t2' | 'weaved_fragment_t3' | 'weaved_fragment_t4' | 'weaved_fragment_t5'
    | 'sundered_fragment_t1' | 'sundered_fragment_t2' | 'sundered_fragment_t3' | 'sundered_fragment_t4' | 'sundered_fragment_t5'
    | 'metallic_fragment_t1' | 'metallic_fragment_t2' | 'metallic_fragment_t3' | 'metallic_fragment_t4' | 'metallic_fragment_t5'
    | 'corrupted_fragment_t1' | 'corrupted_fragment_t2' | 'corrupted_fragment_t3' | 'corrupted_fragment_t4' | 'corrupted_fragment_t5';

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
    level: number; // stats scale with level
}

// Master Ligature Data Array
// longToneBonus = seconds added to Long Tone duration (at level 1)
// tubaDamageBonus = damage multiplier bonus against Tubas/Euphoniums (at level 1)
export const LIGATURE_DATA = [
    {
        id: 'one_screw_fabric' as const,
        name: 'One-Screw Fabric Ligature',
        description: 'A basic fabric ligature with a single screw adjustment.',
        rarity: 'common' as const,
        longToneBonus: 0.1,
        tubaDamageBonus: 0.10,
        recipe: [
            { itemId: 'echoes', quantity: 6 },
            { itemId: 'sheet_music_fragments_common', quantity: 2 }
        ]
    },
    {
        id: 'two_screw_fabric' as const,
        name: 'Two-Screw Fabric Ligature',
        description: 'A fabric ligature with dual screw adjustment for better control.',
        rarity: 'common' as const,
        longToneBonus: 0.2,
        tubaDamageBonus: 0.05,
        recipe: [
            { itemId: 'echoes', quantity: 6 },
            { itemId: 'sheet_music_fragments_common', quantity: 4 }
        ]
    },
    {
        id: 'one_screw_metal' as const,
        name: 'One-Screw Metal Ligature',
        description: 'A sturdy metal ligature with a single secure fastening.',
        rarity: 'uncommon' as const,
        longToneBonus: 0.2,
        tubaDamageBonus: 0.25,
        recipe: [
            { itemId: 'echoes', quantity: 10 },
            { itemId: 'sheet_music_fragments_common', quantity: 3 },
            { itemId: 'trombone_slides', quantity: 1 }
        ]
    },
    {
        id: 'two_screw_metal' as const,
        name: 'Two-Screw Metal Ligature',
        description: 'A metal ligature with dual fastening for optimal resonance.',
        rarity: 'uncommon' as const,
        longToneBonus: 0.35,
        tubaDamageBonus: 0.15,
        recipe: [
            { itemId: 'echoes', quantity: 10 },
            { itemId: 'sheet_music_fragments_common', quantity: 6 },
            { itemId: 'trombone_slides', quantity: 2 }
        ]
    },
    {
        id: 'one_screw_reinforced_metal' as const,
        name: 'One-Screw Reinforced Metal Ligature',
        description: 'A reinforced metal ligature with maximum durability.',
        rarity: 'rare' as const,
        longToneBonus: 0.4,
        tubaDamageBonus: 0.35,
        recipe: [
            { itemId: 'echoes', quantity: 15 },
            { itemId: 'sheet_music_fragments_common', quantity: 6 },
            { itemId: 'trombone_slides', quantity: 2 }
        ]
    },
    {
        id: 'two_screw_reinforced_metal' as const,
        name: 'Two-Screw Reinforced Metal Ligature',
        description: 'The ultimate reinforced metal ligature with supreme protection.',
        rarity: 'epic' as const,
        longToneBonus: 0.72,
        tubaDamageBonus: 0.275,
        recipe: [
            { itemId: 'echoes', quantity: 15 },
            { itemId: 'sheet_music_fragments_common', quantity: 10 },
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
        tubaDamageBonus: (data.tubaDamageBonus * (level - 1) * 0.4) + data.tubaDamageBonus
    };
}

// Get upgrade cost for a ligature (level * base cost)
export function getLigatureUpgradeCost(id: LigatureId, currentLevel: number) {
    const data = getLigatureData(id);
    const multiplier = currentLevel + 1; // Cost for next level
    return data.recipe.map(item => ({
        itemId: item.itemId,
        quantity: Math.floor(item.quantity * multiplier)
    }));
}

// ============= INSTRUMENT CASES SYSTEM =============
// Instrument cases provide health and speed bonuses
// Two types: Fabric (health + speed) and Wood (health only)
// Upgrade at level 15 to Carbon Fiber (Fabric) or Metal (Wood)

export type CaseId = 'fabric_case' | 'wood_case';

export interface CaseInstance {
    id: CaseId;
    level: number; // Stats scale with level
    meldType?: MeldType; // Which fragment type is melded onto this case
    meldTier?: number; // 1-5, tier 1 = base (free, no stats), tiers 2-5 grant bonuses
}

// ============= CASE MELDING SYSTEM =============
// Melding allows adding one of 5 fragment-based stats to a case
// Unlocked at player level 30. Each case can have only 1 meld type.
// Tier 1 is the base (assigned when crafting, free, no stats).
// Tiers 2-5 require fragments + brass ingots to upgrade.

export type MeldType = 'plated' | 'weaved' | 'sundered' | 'metallic' | 'corrupted';

export const MELD_UNLOCK_LEVEL = 30;

export const MELD_TYPE_INFO: Record<MeldType, { name: string; statName: string; emoji: string }> = {
    plated: { name: 'Plated', statName: 'Defense', emoji: '🛡️' },
    weaved: { name: 'Weaved', statName: 'Self-Healing', emoji: '💚' },
    sundered: { name: 'Sundered', statName: 'Crit Chance', emoji: '⚡' },
    metallic: { name: 'Metallic', statName: 'Impact', emoji: '💥' },
    corrupted: { name: 'Corrupted', statName: 'LifeSteal', emoji: '🩸' },
};

// Stat bonuses per tier (these are the incremental bonuses at each tier, not cumulative)
// defense = % damage reduction (additive), selfHeal = % max HP per second,
// critChance = % crit chance (additive), impact = flat impact on ability, lifesteal = % damage healed
export interface MeldStatBonus {
    defense: number;       // e.g. 0.05 = +5%
    selfHeal: number;      // e.g. 0.0025 = +0.25% max HP/s
    critChance: number;    // e.g. 0.025 = +2.5%
    impact: number;        // flat, e.g. 2
    lifesteal: number;     // e.g. 0.0015 = +0.15%
}

// Per-tier stat bonuses (index 0 = tier 2 bonus, index 1 = tier 3, etc.)
// Tier 1 has no stats (base tier)
export const MELD_TIER_STATS: MeldStatBonus[] = [
    // Tier 2 bonuses
    { defense: 0.05, selfHeal: 0.0025, critChance: 0.025, impact: 2, lifesteal: 0.0015 },
    // Tier 3 bonuses
    { defense: 0.035, selfHeal: 0.0025, critChance: 0.05, impact: 3, lifesteal: 0.0015 },
    // Tier 4 bonuses
    { defense: 0.045, selfHeal: 0.005, critChance: 0.075, impact: 4, lifesteal: 0.003 },
    // Tier 5 bonuses
    { defense: 0.05, selfHeal: 0.01, critChance: 0.075, impact: 4, lifesteal: 0.006 },
];

// Fragment and ingot costs per tier upgrade (targetTier - 2 = index in this array)
// Each entry specifies: fragments required (type × tier), brass ingot costs
export const MELD_TIER_COSTS: Array<{
    fragments: Array<{ tier: number; quantity: number }>; // tier of fragment, quantity needed
    brassIngots: number;
    reinforcedBrassIngots: number;
    infusedBrassIngots: number;
}> = [
        // To tier 2: 5×T1, 1×T2, 15 brass
        { fragments: [{ tier: 1, quantity: 5 }, { tier: 2, quantity: 1 }], brassIngots: 15, reinforcedBrassIngots: 0, infusedBrassIngots: 0 },
        // To tier 3: 24×T1, 5×T2, 1×T3, 60 brass, 15 reinforced
        { fragments: [{ tier: 1, quantity: 24 }, { tier: 2, quantity: 5 }, { tier: 3, quantity: 1 }], brassIngots: 60, reinforcedBrassIngots: 15, infusedBrassIngots: 0 },
        // To tier 4: 30×T2, 15×T3, 1×T4, 480 brass, 75 reinforced, 15 infused
        { fragments: [{ tier: 2, quantity: 30 }, { tier: 3, quantity: 15 }, { tier: 4, quantity: 1 }], brassIngots: 480, reinforcedBrassIngots: 75, infusedBrassIngots: 15 },
        // To tier 5: 60×T3, 16×T4, 1×T5, 2016 brass, 224 reinforced, 56 infused
        { fragments: [{ tier: 3, quantity: 60 }, { tier: 4, quantity: 16 }, { tier: 5, quantity: 1 }], brassIngots: 2016, reinforcedBrassIngots: 224, infusedBrassIngots: 56 },
    ];

// Get the cumulative stat bonus for a meld type at a given tier
// Only the stat matching the meld type is non-zero
export function getMeldStats(meldType: MeldType, tier: number): MeldStatBonus {
    const result: MeldStatBonus = { defense: 0, selfHeal: 0, critChance: 0, impact: 0, lifesteal: 0 };
    if (tier <= 1) return result; // Tier 1 has no stats

    // Map meld type to the stat key
    const statKey: keyof MeldStatBonus =
        meldType === 'plated' ? 'defense' :
            meldType === 'weaved' ? 'selfHeal' :
                meldType === 'sundered' ? 'critChance' :
                    meldType === 'metallic' ? 'impact' :
                        'lifesteal';

    // Sum up bonuses from tier 2 through the current tier
    for (let t = 2; t <= tier; t++) {
        const tierStats = MELD_TIER_STATS[t - 2]; // index 0 = tier 2
        result[statKey] += tierStats[statKey];
    }

    return result;
}

// Get the cost to upgrade to a target tier for a given meld type
// Returns array of { itemId, quantity } for fragments + ingots
export function getMeldTierCost(meldType: MeldType, targetTier: number): Array<{ itemId: string; quantity: number }> {
    if (targetTier < 2 || targetTier > 5) return [];
    const costData = MELD_TIER_COSTS[targetTier - 2];
    const costs: Array<{ itemId: string; quantity: number }> = [];

    // Add fragment costs
    for (const frag of costData.fragments) {
        costs.push({ itemId: `${meldType}_fragment_t${frag.tier}`, quantity: frag.quantity });
    }

    // Add brass ingot costs
    if (costData.brassIngots > 0) {
        costs.push({ itemId: 'brass_ingots', quantity: costData.brassIngots });
    }
    if (costData.reinforcedBrassIngots > 0) {
        costs.push({ itemId: 'reinforced_brass_ingots', quantity: costData.reinforcedBrassIngots });
    }
    if (costData.infusedBrassIngots > 0) {
        costs.push({ itemId: 'infused_brass_ingots', quantity: costData.infusedBrassIngots });
    }

    return costs;
}

// Master Case Data Array
// healthMultiplier = multiplicative health bonus per level (at level 1)
// speedBonus = additive speed bonus per level in feet/second (at level 1)
export const CASE_DATA = [
    {
        id: 'fabric_case' as const,
        name: 'Fabric Case',
        description: 'A lightweight fabric case that provides modest protection and mobility.',
        rarity: 'uncommon' as const,
        healthMultiplierPerLevel: 0.03, // *1.03 health per level
        speedBonusPerLevel: 0.07, // +0.07 feet/second per level
        recipe: [
            { itemId: 'echoes', quantity: 28 },
            { itemId: 'valve_oil', quantity: 1 },
            { itemId: 'valves', quantity: 4 }
        ]
    },
    {
        id: 'wood_case' as const,
        name: 'Wood Case',
        description: 'A sturdy wood case that provides excellent protection.',
        rarity: 'uncommon' as const,
        healthMultiplierPerLevel: 0.07, // *1.07 health per level
        speedBonusPerLevel: 0, // No speed bonus
        recipe: [
            { itemId: 'echoes', quantity: 28 },
            { itemId: 'valves', quantity: 8 }
        ]
    }
] as const;

// Helper to get case data by ID
export function getCaseData(id: CaseId) {
    return CASE_DATA.find(c => c.id === id)!;
}

// Calculate case stats at a given level
export function getCaseStats(id: CaseId, level: number) {
    const data = getCaseData(id);

    // Check for evolution at level 15
    const isEvolved = level >= 15;
    const evolvedName = isEvolved ? (id === 'fabric_case' ? 'Carbon Fiber Case' : 'Metal Case') : data.name;

    return {
        name: evolvedName,
        healthMultiplier: (() => {
            let result = 1;
            for (let i = 0; i < level; i++) {
                result *= (1 + data.healthMultiplierPerLevel);
            }
            return result;
        })(),
        speedBonus: data.speedBonusPerLevel * level,
        isEvolved
    };
}

// Get upgrade cost for a case (level * base cost)
export function getCaseUpgradeCost(id: CaseId, currentLevel: number) {
    const data = getCaseData(id);
    const multiplier = currentLevel + 1; // Cost for next level
    return data.recipe.map(item => ({
        itemId: item.itemId,
        quantity: item.quantity * multiplier
    }));
}

// ============= MOUTHPIECE/ROSIN SYSTEM =============
// Mouthpieces (for clarinet) / Rosin (for viola)
// Two types: Plastic/Soft (crit factor) and Rubber/Hard (crit chance)

export type MouthpieceId = 'plastic' | 'rubber';

export interface MouthpieceInstance {
    id: MouthpieceId;
    level: number;
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

// Accessory item IDs (includes ligatures, mouthpieces, and cases)
export type AccessoryItemId = LigatureId | MouthpieceId | CaseId | 'placeholder';

// Combined item ID type
export type ItemId = MaterialItemId | ReedStrength | AccessoryItemId;

// ============= ENCHANTMENT SYSTEM =============
// Enchantments are weapon enhancements with three tiers: Common, Infused, Arcane
// Each tier has unique enchantments that provide combat bonuses

export type EnchantmentTier = 'common' | 'infused' | 'arcane';

export type CommonEnchantmentId = 'edge' | 'dampening' | 'pulse';
export type InfusedEnchantmentId = 'brass_edge' | 'muted' | 'percussive';
export type ArcaneEnchantmentId = 'metallic_edge' | 'silenced' | 'empowering';
export type EnchantmentId = CommonEnchantmentId | InfusedEnchantmentId | ArcaneEnchantmentId;

export interface EnchantmentInstance {
    id: EnchantmentId;
    tier: EnchantmentTier;
}

// Master Enchantment Data
export interface EnchantmentDefinition {
    id: string;
    name: string;
    description: string;
    rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    critFactorBonus?: number;
    defenseBonus?: number;
    euphoniumDefenseBonus?: number;
    trumpetDamageMultiplier?: number;
    procAttackCount?: number;
    healPercent?: number;
    permanentSpeedBonus?: number;
    hornRetaliationDamage?: number;
    recipe: { itemId: string; quantity: number }[];
}

// Master Enchantment Data
export const ENCHANTMENT_DATA: {
    common: Record<CommonEnchantmentId, EnchantmentDefinition>;
    infused: Record<InfusedEnchantmentId, EnchantmentDefinition>;
    arcane: Record<ArcaneEnchantmentId, EnchantmentDefinition>;
} = {
    // Common Enchantments (Slot unlocks at start)
    common: {
        edge: {
            id: 'edge' as const,
            name: 'Edge',
            description: 'Sharpens your weapon, increasing critical hit damage.',
            rarity: 'common' as const,
            critFactorBonus: 0.5,
            recipe: [
                { itemId: 'sheet_music_fragments_common', quantity: 30 },
                { itemId: 'reinforced_valves', quantity: 5 }
            ]
        },
        dampening: {
            id: 'dampening' as const,
            name: 'Dampening',
            description: 'Reduces incoming damage with harmonic dampening fields.',
            rarity: 'common' as const,
            defenseBonus: 0.05,
            recipe: [
                { itemId: 'sheet_music_fragments_common', quantity: 30 },
                { itemId: 'reinforced_valves', quantity: 5 }
            ]
        },
        pulse: {
            id: 'pulse' as const,
            name: 'Pulse',
            description: 'Every 25 attacks, heals 1% of full health through rhythmic resonance.',
            rarity: 'common' as const,
            procAttackCount: 25,
            healPercent: 0.01,
            recipe: [
                { itemId: 'sheet_music_fragments_common', quantity: 30 },
                { itemId: 'reinforced_valves', quantity: 5 }
            ]
        }
    },
    // Infused Enchantments (Slot unlocks at level 100)
    infused: {
        brass_edge: {
            id: 'brass_edge' as const,
            name: 'Brass Edge',
            description: 'Enhanced critical damage with bonus damage against Trumpets.',
            rarity: 'rare' as const,
            critFactorBonus: 0.8,
            trumpetDamageMultiplier: 1.2,
            recipe: [
                { itemId: 'sheet_music_fragments_rare', quantity: 25 },
                { itemId: 'infused_valves', quantity: 3 }
            ]
        },
        muted: {
            id: 'muted' as const,
            name: 'Muted',
            description: 'Provides defense and extra protection against Euphoniums.',
            rarity: 'rare' as const,
            defenseBonus: 0.05,
            euphoniumDefenseBonus: 0.10,
            recipe: [
                { itemId: 'sheet_music_fragments_rare', quantity: 25 },
                { itemId: 'infused_valves', quantity: 3 }
            ]
        },
        percussive: {
            id: 'percussive' as const,
            name: 'Percussive',
            description: 'Every 25 attacks, heals 2% of full health through percussive beats.',
            rarity: 'rare' as const,
            procAttackCount: 25,
            healPercent: 0.02,
            recipe: [
                { itemId: 'sheet_music_fragments_rare', quantity: 25 },
                { itemId: 'infused_valves', quantity: 3 }
            ]
        }
    },
    // Arcane Enchantments (Slot unlocks at level 250)
    arcane: {
        metallic_edge: {
            id: 'metallic_edge' as const,
            name: 'Metallic Edge',
            description: 'Supreme critical damage with massive bonus against Trumpets.',
            rarity: 'epic' as const,
            critFactorBonus: 1.2,
            trumpetDamageMultiplier: 1.6,
            recipe: [
                { itemId: 'sheet_music_fragments_legendary', quantity: 20 },
                { itemId: 'infused_valves', quantity: 15 },
                { itemId: 'moonlight_azarite', quantity: 3 }
            ]
        },
        silenced: {
            id: 'silenced' as const,
            name: 'Silenced',
            description: 'Great defense against Euphoniums. Horns take damage when using immobility abilities.',
            rarity: 'epic' as const,
            euphoniumDefenseBonus: 0.15,
            hornRetaliationDamage: 0.20,
            recipe: [
                { itemId: 'sheet_music_fragments_legendary', quantity: 20 },
                { itemId: 'infused_valves', quantity: 15 },
                { itemId: 'moonlight_azarite', quantity: 3 }
            ]
        },
        empowering: {
            id: 'empowering' as const,
            name: 'Empowering',
            description: 'Every 25 attacks, heals 3% health and permanently grants +12% movement speed.',
            rarity: 'epic' as const,
            procAttackCount: 25,
            healPercent: 0.03,
            permanentSpeedBonus: 0.12,
            recipe: [
                { itemId: 'sheet_music_fragments_legendary', quantity: 20 },
                { itemId: 'infused_valves', quantity: 15 },
                { itemId: 'moonlight_azarite', quantity: 3 }
            ]
        }
    }
} as const;

// Helper to get enchantment data by ID and tier
export function getEnchantmentData(id: EnchantmentId, tier: EnchantmentTier): EnchantmentDefinition {
    return ENCHANTMENT_DATA[tier][id as keyof typeof ENCHANTMENT_DATA[typeof tier]];
}

// Get all enchantments for a tier
export function getEnchantmentsForTier(tier: EnchantmentTier) {
    return Object.values(ENCHANTMENT_DATA[tier]);
}

// Slot unlock levels
export const ENCHANTMENT_SLOT_LEVELS = {
    common: 1,    // Available at start
    infused: 100, // Unlocks at level 100
    arcane: 250   // Unlocks at level 250
} as const;

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
    cases: CaseInstance[]; // Owned cases with levels
    enchantments: EnchantmentInstance[]; // Owned enchantments
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
    sheet_music_fragments_common: {
        id: 'sheet_music_fragments_common',
        name: 'Common Sheet Music Fragments',
        description: 'Torn pages from basic compositions.',
        category: 'materials',
        rarity: 'uncommon',
    },
    sheet_music_fragments_rare: {
        id: 'sheet_music_fragments_rare',
        name: 'Rare Sheet Music Fragments',
        description: 'Well-preserved pages from advanced compositions.',
        category: 'materials',
        rarity: 'rare',
    },
    sheet_music_fragments_legendary: {
        id: 'sheet_music_fragments_legendary',
        name: 'Legendary Sheet Music Fragments',
        description: 'Ancient pages from master compositions that glow with musical energy.',
        category: 'materials',
        rarity: 'legendary',
    },
    spit_valve_liquid: {
        id: 'spit_valve_liquid',
        name: 'Spit Valve Liquid',
        description: 'A glowing, viscous liquid collected from brass instruments. Gross but powerful.',
        category: 'materials',
        rarity: 'common',
    },
    brass_essence: {
        id: 'brass_essence',
        name: 'Brass Essence',
        description: 'Pure distilled essence of brass instruments. Used for advanced crafting.',
        category: 'materials',
        rarity: 'rare',
    },

    // === Case Fragments ===
    // Plated Fragments (from Trumpets)
    plated_fragment_t1: { id: 'plated_fragment_t1', name: 'Plated Fragment (T1)', description: 'A thin plated shard torn from a trumpet\'s casing. Faintly warm.', category: 'materials', rarity: 'common' },
    plated_fragment_t2: { id: 'plated_fragment_t2', name: 'Plated Fragment (T2)', description: 'A sturdy plated shard with hardened brass layers.', category: 'materials', rarity: 'uncommon' },
    plated_fragment_t3: { id: 'plated_fragment_t3', name: 'Plated Fragment (T3)', description: 'A dense plated shard that hums with residual resonance.', category: 'materials', rarity: 'rare' },
    plated_fragment_t4: { id: 'plated_fragment_t4', name: 'Plated Fragment (T4)', description: 'A reinforced plated shard radiating harmonic energy.', category: 'materials', rarity: 'epic' },
    plated_fragment_t5: { id: 'plated_fragment_t5', name: 'Plated Fragment (T5)', description: 'A pristine plated shard of legendary craftsmanship, pulsing with power.', category: 'materials', rarity: 'legendary' },
    // Weaved Fragments (from Euphoniums)
    weaved_fragment_t1: { id: 'weaved_fragment_t1', name: 'Weaved Fragment (T1)', description: 'A loosely woven brass thread from a euphonium\'s bell.', category: 'materials', rarity: 'common' },
    weaved_fragment_t2: { id: 'weaved_fragment_t2', name: 'Weaved Fragment (T2)', description: 'Tightly woven brass fibers with improved tensile strength.', category: 'materials', rarity: 'uncommon' },
    weaved_fragment_t3: { id: 'weaved_fragment_t3', name: 'Weaved Fragment (T3)', description: 'Intricately woven strands humming with overtone energy.', category: 'materials', rarity: 'rare' },
    weaved_fragment_t4: { id: 'weaved_fragment_t4', name: 'Weaved Fragment (T4)', description: 'Masterfully woven fibers that resonate with deep harmonics.', category: 'materials', rarity: 'epic' },
    weaved_fragment_t5: { id: 'weaved_fragment_t5', name: 'Weaved Fragment (T5)', description: 'Legendary woven threads that shimmer with euphonic brilliance.', category: 'materials', rarity: 'legendary' },
    // Sundered Fragments (from Trombones)
    sundered_fragment_t1: { id: 'sundered_fragment_t1', name: 'Sundered Fragment (T1)', description: 'A cracked shard from a trombone\'s slide mechanism.', category: 'materials', rarity: 'common' },
    sundered_fragment_t2: { id: 'sundered_fragment_t2', name: 'Sundered Fragment (T2)', description: 'A fractured brass piece with jagged glissando marks.', category: 'materials', rarity: 'uncommon' },
    sundered_fragment_t3: { id: 'sundered_fragment_t3', name: 'Sundered Fragment (T3)', description: 'A shattered shard that crackles with sonic energy.', category: 'materials', rarity: 'rare' },
    sundered_fragment_t4: { id: 'sundered_fragment_t4', name: 'Sundered Fragment (T4)', description: 'A violently split fragment vibrating at impossible frequencies.', category: 'materials', rarity: 'epic' },
    sundered_fragment_t5: { id: 'sundered_fragment_t5', name: 'Sundered Fragment (T5)', description: 'A legendary fragment torn from reality itself by pure glissando force.', category: 'materials', rarity: 'legendary' },
    // Metallic Fragments (from Tubas)
    metallic_fragment_t1: { id: 'metallic_fragment_t1', name: 'Metallic Fragment (T1)', description: 'A heavy metal shard from a tuba\'s coils.', category: 'materials', rarity: 'common' },
    metallic_fragment_t2: { id: 'metallic_fragment_t2', name: 'Metallic Fragment (T2)', description: 'A dense metallic chunk with deep resonant properties.', category: 'materials', rarity: 'uncommon' },
    metallic_fragment_t3: { id: 'metallic_fragment_t3', name: 'Metallic Fragment (T3)', description: 'A weighty fragment that trembles with bass frequencies.', category: 'materials', rarity: 'rare' },
    metallic_fragment_t4: { id: 'metallic_fragment_t4', name: 'Metallic Fragment (T4)', description: 'An incredibly dense shard that distorts sound around it.', category: 'materials', rarity: 'epic' },
    metallic_fragment_t5: { id: 'metallic_fragment_t5', name: 'Metallic Fragment (T5)', description: 'A legendary metal core fragment, impossibly heavy and powerful.', category: 'materials', rarity: 'legendary' },
    // Corrupted Fragments (from French Horns)
    corrupted_fragment_t1: { id: 'corrupted_fragment_t1', name: 'Corrupted Fragment (T1)', description: 'A tarnished shard from a French horn\'s bell, darkened by use.', category: 'materials', rarity: 'common' },
    corrupted_fragment_t2: { id: 'corrupted_fragment_t2', name: 'Corrupted Fragment (T2)', description: 'A warped brass piece tinged with defensive energy.', category: 'materials', rarity: 'uncommon' },
    corrupted_fragment_t3: { id: 'corrupted_fragment_t3', name: 'Corrupted Fragment (T3)', description: 'A twisted fragment pulsing with closing bell residue.', category: 'materials', rarity: 'rare' },
    corrupted_fragment_t4: { id: 'corrupted_fragment_t4', name: 'Corrupted Fragment (T4)', description: 'A deeply corrupted shard that absorbs nearby sound.', category: 'materials', rarity: 'epic' },
    corrupted_fragment_t5: { id: 'corrupted_fragment_t5', name: 'Corrupted Fragment (T5)', description: 'A legendary corrupted core that devours all resonance around it.', category: 'materials', rarity: 'legendary' },

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

    // Cases - derived from CASE_DATA
    ...Object.fromEntries(CASE_DATA.map(c => [c.id, {
        id: c.id,
        name: c.name,
        description: c.description,
        category: 'accessories' as const,
        rarity: c.rarity,
    }])),

    // Enchantments - derived from ENCHANTMENT_DATA
    ...Object.fromEntries([
        ...Object.values(ENCHANTMENT_DATA.common).map(e => [e.id, {
            id: e.id,
            name: e.name,
            description: e.description,
            category: 'accessories' as const,
            rarity: e.rarity,
        }]),
        ...Object.values(ENCHANTMENT_DATA.infused).map(e => [e.id, {
            id: e.id,
            name: e.name,
            description: e.description,
            category: 'accessories' as const,
            rarity: e.rarity,
        }]),
        ...Object.values(ENCHANTMENT_DATA.arcane).map(e => [e.id, {
            id: e.id,
            name: e.name,
            description: e.description,
            category: 'accessories' as const,
            rarity: e.rarity,
        }]),
    ]),
} as Record<ItemId, ItemDefinition>;

// Initial inventory - uses config values for debug starting materials
import { GAME_CONFIG } from './config';

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
            // Case Fragments
            plated_fragment_t1: 0, plated_fragment_t2: 0, plated_fragment_t3: 0, plated_fragment_t4: 0, plated_fragment_t5: 0,
            weaved_fragment_t1: 0, weaved_fragment_t2: 0, weaved_fragment_t3: 0, weaved_fragment_t4: 0, weaved_fragment_t5: 0,
            sundered_fragment_t1: 0, sundered_fragment_t2: 0, sundered_fragment_t3: 0, sundered_fragment_t4: 0, sundered_fragment_t5: 0,
            metallic_fragment_t1: 0, metallic_fragment_t2: 0, metallic_fragment_t3: 0, metallic_fragment_t4: 0, metallic_fragment_t5: 0,
            corrupted_fragment_t1: 0, corrupted_fragment_t2: 0, corrupted_fragment_t3: 0, corrupted_fragment_t4: 0, corrupted_fragment_t5: 0,
        },
        // Derive reeds inventory from REED_DATA
        reeds: Object.fromEntries(REED_DATA.map(r => [r.strength, 0])) as Record<ReedStrength, number>,
        accessories: {},
        ligatures: [], // Empty array, ligatures are owned with levels
        mouthpieces: [], // Empty array, mouthpieces are owned with levels
        cases: [], // Empty array, cases are owned with levels
        enchantments: [], // Empty array, enchantments are owned
    };
}

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
    readonly itemId: ItemId;
    readonly quantity: number;
}

export interface Recipe {
    readonly id: string;
    readonly outputId: ItemId;
    readonly outputQuantity: number;
    readonly ingredients: readonly Ingredient[];
    readonly description?: string;
    readonly name?: string; // Optional override for UI
    readonly rarity?: string; // Optional override for UI
    readonly category?: 'materials' | 'reeds' | 'ligatures' | 'mouthpieces' | 'cases' | 'enchantments'; // For UI sub-tabs
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
    {
        id: 'reinforced_brass_ingot_craft',
        outputId: 'reinforced_brass_ingots',
        outputQuantity: 1,
        ingredients: [
            { itemId: 'brass_ingots', quantity: 5 },
            { itemId: 'sheet_music_fragments_rare', quantity: 1 }
        ],
        description: 'Forge brass ingots with rare sheet music fragments.',
        category: 'materials'
    },
    {
        id: 'infused_brass_ingot_craft',
        outputId: 'infused_brass_ingots',
        outputQuantity: 1,
        ingredients: [
            { itemId: 'reinforced_brass_ingots', quantity: 5 }
        ],
        description: 'Infuse reinforced brass ingots with musical energy.',
        category: 'materials'
    },
    {
        id: 'reinforced_valve_craft',
        outputId: 'reinforced_valves',
        outputQuantity: 1,
        ingredients: [
            { itemId: 'heavy_valves', quantity: 10 },
            { itemId: 'reinforced_brass_ingots', quantity: 5 }
        ],
        description: 'Forge reinforced valves from heavy valves and reinforced brass.',
        category: 'materials'
    },
    {
        id: 'infused_valve_craft',
        outputId: 'infused_valves',
        outputQuantity: 1,
        ingredients: [
            { itemId: 'heavy_valves', quantity: 40 },
            { itemId: 'infused_brass_ingots', quantity: 5 }
        ],
        description: 'Forge infused valves from heavy valves and infused brass.',
        category: 'materials'
    },
    // Material Breakdown Recipes
    {
        id: 'sheet_music_legendary_breakdown',
        outputId: 'sheet_music_fragments_rare',
        outputQuantity: 3,
        ingredients: [
            { itemId: 'sheet_music_fragments_legendary', quantity: 1 }
        ],
        description: 'Decompose 1 Legendary fragment into 3 Rare fragments.',
        category: 'materials'
    },
    {
        id: 'sheet_music_rare_breakdown',
        outputId: 'sheet_music_fragments_common',
        outputQuantity: 3,
        ingredients: [
            { itemId: 'sheet_music_fragments_rare', quantity: 1 }
        ],
        description: 'Decompose 1 Rare fragment into 3 Common fragments.',
        category: 'materials'
    }
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

// Generate ligature upgrade recipes (levels 2-200)
// Level N costs N times the base recipe
const LIGATURE_UPGRADE_RECIPES: Recipe[] = [];
for (const ligature of LIGATURE_DATA) {
    for (let level = 2; level <= 200; level++) {
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

// Generate mouthpiece base crafting recipes
const MOUTHPIECE_BASE_RECIPES: Recipe[] = MOUTHPIECE_DATA.map(m => ({
    id: `mouthpiece_${m.id}_craft`,
    outputId: m.id as ItemId,
    outputQuantity: 1,
    ingredients: m.recipe.map(ing => ({ itemId: ing.itemId as ItemId, quantity: ing.quantity })),
    description: `Craft a ${m.name}.`,
    category: 'mouthpieces' as const
}));

// Generate mouthpiece upgrade recipes (levels 2-200)
// Level N costs N times the base recipe
const MOUTHPIECE_UPGRADE_RECIPES: Recipe[] = [];
for (const mouthpiece of MOUTHPIECE_DATA) {
    for (let level = 2; level <= 200; level++) {
        MOUTHPIECE_UPGRADE_RECIPES.push({
            id: `mouthpiece_${mouthpiece.id}_upgrade_${level}`,
            outputId: mouthpiece.id as ItemId,
            outputQuantity: 1,
            ingredients: mouthpiece.recipe.map(ing => ({
                itemId: ing.itemId as ItemId,
                quantity: ing.quantity * level
            })),
            description: `Upgrade ${mouthpiece.name} to Level ${level}.`,
            category: 'mouthpieces' as const
        });
    }
}

// Generate case base crafting recipes
const CASE_BASE_RECIPES: Recipe[] = CASE_DATA.map(c => ({
    id: `case_${c.id}_craft`,
    outputId: c.id as ItemId,
    outputQuantity: 1,
    ingredients: c.recipe.map(ing => ({ itemId: ing.itemId as ItemId, quantity: ing.quantity })),
    description: `Craft a ${c.name}.`,
    category: 'cases' as const
}));

// Generate case upgrade recipes (levels 2-200)
// Level N costs N times the base recipe
const CASE_UPGRADE_RECIPES: Recipe[] = [];
for (const caseItem of CASE_DATA) {
    for (let level = 2; level <= 200; level++) {
        CASE_UPGRADE_RECIPES.push({
            id: `case_${caseItem.id}_upgrade_${level}`,
            outputId: caseItem.id as ItemId,
            outputQuantity: 1,
            ingredients: caseItem.recipe.map(ing => ({
                itemId: ing.itemId as ItemId,
                quantity: ing.quantity * level
            })),
            description: `Upgrade ${caseItem.name} to Level ${level}.`,
            category: 'cases' as const
        });
    }
}

// Generate enchantment crafting recipes
const ENCHANTMENT_RECIPES: Recipe[] = [
    // Common enchantments
    ...Object.values(ENCHANTMENT_DATA.common).map(e => ({
        id: `enchantment_${e.id}_craft`,
        outputId: e.id as ItemId,
        outputQuantity: 1,
        ingredients: e.recipe.map(ing => ({ itemId: ing.itemId as ItemId, quantity: ing.quantity })),
        description: `Craft ${e.name} enchantment.`,
        category: 'enchantments' as const
    })),
    // Infused enchantments
    ...Object.values(ENCHANTMENT_DATA.infused).map(e => ({
        id: `enchantment_${e.id}_craft`,
        outputId: e.id as ItemId,
        outputQuantity: 1,
        ingredients: e.recipe.map(ing => ({ itemId: ing.itemId as ItemId, quantity: ing.quantity })),
        description: `Craft ${e.name} enchantment.`,
        category: 'enchantments' as const
    })),
    // Arcane enchantments
    ...Object.values(ENCHANTMENT_DATA.arcane).map(e => ({
        id: `enchantment_${e.id}_craft`,
        outputId: e.id as ItemId,
        outputQuantity: 1,
        ingredients: e.recipe.map(ing => ({ itemId: ing.itemId as ItemId, quantity: ing.quantity })),
        description: `Craft ${e.name} enchantment.`,
        category: 'enchantments' as const
    }))
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
        description: `Craft ${r.name}.`,
        category: 'reeds' as const
    })),
    // Alternate recipes (materials & reeds)
    ...CRAFTING_RECIPES,
    // Ligature base crafting
    ...LIGATURE_BASE_RECIPES,
    // Ligature upgrades
    ...LIGATURE_UPGRADE_RECIPES,
    // Mouthpiece base crafting
    ...MOUTHPIECE_BASE_RECIPES,
    // Mouthpiece upgrades
    ...MOUTHPIECE_UPGRADE_RECIPES,
    // Case base crafting
    ...CASE_BASE_RECIPES,
    // Case upgrades
    ...CASE_UPGRADE_RECIPES,
    // Enchantment crafting
    ...ENCHANTMENT_RECIPES
];

