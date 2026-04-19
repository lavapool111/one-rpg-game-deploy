/**
 * Crafting XP Configuration
 * Centralized XP values for easy tweaking and balancing.
 */

import { MaterialItemId, ReedStrength } from './inventory';

// Individual material XP values
export const MATERIAL_XP_VALUES: Record<string, number> = {
    // Basic Materials
    valves: 2,
    heavy_valves: 5,
    reinforced_valves: 40,
    infused_valves: 120,
    trombone_slides: 8,
    brass_ingots: 4,
    reinforced_brass_ingots: 15,
    infused_brass_ingots: 60,
    moonlight_azarite: 250,
    valve_oil: 5,
    cork_grease: 5,
    spit_valve_liquid: 0.2,

    // Fragments
    sheet_music_fragments_common: 3,
    sheet_music_fragments_rare: 10,
    sheet_music_fragments_legendary: 35,

    // Specific Fragment Types (for melding)
    plated_fragment_t1: 5,
    plated_fragment_t2: 20,
    plated_fragment_t3: 80,
    plated_fragment_t4: 300,
    plated_fragment_t5: 1200,

    weaved_fragment_t1: 5,
    weaved_fragment_t2: 20,
    weaved_fragment_t3: 80,
    weaved_fragment_t4: 300,
    weaved_fragment_t5: 1200,

    sundered_fragment_t1: 5,
    sundered_fragment_t2: 20,
    sundered_fragment_t3: 80,
    sundered_fragment_t4: 300,
    sundered_fragment_t5: 1200,

    metallic_fragment_t1: 5,
    metallic_fragment_t2: 20,
    metallic_fragment_t3: 80,
    metallic_fragment_t4: 300,
    metallic_fragment_t5: 1200,

    corrupted_fragment_t1: 5,
    corrupted_fragment_t2: 20,
    corrupted_fragment_t3: 80,
    corrupted_fragment_t4: 300,
    corrupted_fragment_t5: 1200,
};

// XP value for virtual items / currencies
export const CURRENCY_XP_VALUES: Record<string, number> = {
    echoes: 0.5, // 2 echoes = 1 XP
};

// Base XP for specific actions
export const ACTION_XP_BASE = {
    CRAFT_ACCESSORY: 100,
    UPGRADE_ACCESSORY: 50,
    UPGRADE_DUNGEON_TIME: 100,
    UPGRADE_ABILITY: 100,
};

// Multipliers
export const XP_MULTIPLIERS = {
    UPGRADE_LEVEL_FACTOR: 25, // XP = ActionBase + (Level * Factor)
};

/**
 * Calculate XP based on input ingredients.
 * Sums the value of each material/currency used.
 */
export function calculateIngredientsXp(ingredients: Array<{ itemId: string; quantity: number }> | ReadonlyArray<{ itemId: string; quantity: number }>): number {
    let totalXp = 0;

    for (const ing of ingredients) {
        if (ing.itemId in CURRENCY_XP_VALUES) {
            totalXp += ing.quantity * CURRENCY_XP_VALUES[ing.itemId];
        } else if (ing.itemId in MATERIAL_XP_VALUES) {
            totalXp += ing.quantity * MATERIAL_XP_VALUES[ing.itemId];
        } else {
            // Reeds used as ingredients - award based on strength formula?
            // For now, assume a base value for unknown items
            totalXp += ing.quantity * 10;
        }
    }

    return Math.floor(totalXp);
}

/**
 * Calculate XP gained from killing an enemy.
 * 
 * Formula factors:
 * - Enemy Level (Linear scaling + Exponential bonus)
 * - Tempo Combo (Multiplier)
 * - Environment/Type Multiplier (Altar waves, enemy type bonuses)
 * - High Level Bonus (Scaling for 100+)
 */
export function calculateKillXp(enemyLevel: number, tempo: number, xpMultiplier: number = 1): number {
    const xpMultFromTempo = 1 + Math.floor(tempo / 2) * 0.1;

    let alina = 5;
    const alinalevel = Math.min(enemyLevel, 1000);

    if (enemyLevel >= 500) {
        alina = 5 + Math.floor((alinalevel - 500) / 300);
    }

    const alinalevel_div_alina = Math.floor(alinalevel / alina);
    const alinatwo = alinalevel_div_alina * Math.max(Math.log(alinalevel / 200), 1);

    const linearXp = 1 + (enemyLevel - 1) * 0.25;
    let expBonus = 0;
    if (enemyLevel <= 1000) {
        expBonus = Math.pow(1.025, alinatwo) - 1;
    } else {
        const exp = Math.min((alinatwo + ((enemyLevel - 1000) / 25)), 1000);
        expBonus = Math.pow(1.025, exp) - 1;
    }

    let HighLevelMult = 1;
    if (enemyLevel >= 100) {
        HighLevelMult = 1 + (enemyLevel - 100) * 0.015;
    }

    const basexp = (linearXp + expBonus) * HighLevelMult;
    return Math.floor(basexp * xpMultFromTempo * xpMultiplier);
}

/**
 * Get the visual rating string based on current tempo combo.
 */
export function getTempoRating(tempo: number): string {
    if (tempo >= 10001) return 'Ω∞';
    if (tempo >= 5001) return 'Ω!';
    if (tempo >= 3001) return 'Ω?';
    if (tempo >= 2001) return '+Ω';
    if (tempo >= 1501) return 'Ω';
    if (tempo >= 1001) return 'Z++';
    if (tempo >= 501) return 'Z+';
    if (tempo >= 301) return 'Z';
    if (tempo >= 201) return 'Y';
    if (tempo >= 101) return 'X';
    if (tempo >= 71) return 'SSS';
    if (tempo >= 41) return 'SS';
    if (tempo >= 21) return 'S';
    if (tempo >= 11) return 'A';
    if (tempo >= 6) return 'B';
    if (tempo >= 3) return 'C';
    if (tempo >= 1) return 'D';
    return 'F';
}
