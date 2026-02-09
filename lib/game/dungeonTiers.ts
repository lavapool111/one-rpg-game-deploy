/**
 * Dungeon Tier System
 * 
 * Calculates tier ranking based on gold collected and
 * generates rewards for each tier.
 */

export type DungeonTier =
    | 'pianissimo_possibile'  // Failed run
    | 'pianissimo'            // 0-199
    | 'piano'                 // 200-499
    | 'mezzo_piano'           // 500-999
    | 'mezzo_forte'           // 1000-1999
    | 'forte'                 // 2000-3499
    | 'fortissimo'            // 3500-6999
    | 'fortissimo_plus'       // 7000-11999
    | 'fortissimo_possibile'; // 12000+

export const TIER_DISPLAY_NAMES: Record<DungeonTier, string> = {
    pianissimo_possibile: 'Pianissimo Possibile',
    pianissimo: 'Pianissimo',
    piano: 'Piano',
    mezzo_piano: 'Mezzo-Piano',
    mezzo_forte: 'Mezzo-Forte',
    forte: 'Forte',
    fortissimo: 'Fortissimo',
    fortissimo_plus: 'Fortissimo+',
    fortissimo_possibile: 'Fortissimo Possibile',
};

export const TIER_COLORS: Record<DungeonTier, string> = {
    pianissimo_possibile: '#666666',  // Gray (failed)
    pianissimo: '#888888',            // Light gray
    piano: '#aaaaaa',                 // Silver
    mezzo_piano: '#55aa55',           // Green
    mezzo_forte: '#5555ff',           // Blue
    forte: '#aa55aa',                 // Purple
    fortissimo: '#ffaa00',            // Orange
    fortissimo_plus: '#ff5555',       // Red
    fortissimo_possibile: '#ffdd00',  // Gold
};

/**
 * Get tier from gold amount
 */
export function getTierFromGold(gold: number, failed: boolean): DungeonTier {
    if (failed) return 'pianissimo_possibile';
    if (gold >= 12000) return 'fortissimo_possibile';
    if (gold >= 7000) return 'fortissimo_plus';
    if (gold >= 3500) return 'fortissimo';
    if (gold >= 2000) return 'forte';
    if (gold >= 1000) return 'mezzo_forte';
    if (gold >= 500) return 'mezzo_piano';
    if (gold >= 200) return 'piano';
    return 'pianissimo';
}

// Helper: random int in range [min, max]
function randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: percentage chance
function chance(percent: number): boolean {
    return Math.random() * 100 < percent;
}

// Reed strength type (1.0, 1.5, 2.0, etc.)
type ReedStrength = '1.0' | '1.5' | '2.0' | '2.5' | '3.0' | '3.5' | '4.0';

function randomReed(minStrength: number, maxStrength: number): ReedStrength {
    const strengths: ReedStrength[] = ['1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0'];
    const validStrengths = strengths.filter(s => {
        const val = parseFloat(s);
        return val >= minStrength && val <= maxStrength;
    });
    return validStrengths[randInt(0, validStrengths.length - 1)];
}

export interface DungeonRewards {
    echoes: number;
    reeds: ReedStrength[];
    valves: number;
    heavyValves: number;
    corkGrease: number;
    valveOil: number;
    slides: number;
    brassIngots: number;
    reinforcedIngots: number;
    infusedIngots: number;
    moonlightAzarite: number;
    commonAccessory: boolean;
    rareAccessory: boolean;
}

/**
 * Generate rewards for a given tier
 */
export function generateTierRewards(tier: DungeonTier): DungeonRewards {
    const rewards: DungeonRewards = {
        echoes: 0,
        reeds: [],
        valves: 0,
        heavyValves: 0,
        corkGrease: 0,
        valveOil: 0,
        slides: 0,
        brassIngots: 0,
        reinforcedIngots: 0,
        infusedIngots: 0,
        moonlightAzarite: 0,
        commonAccessory: false,
        rareAccessory: false,
    };

    switch (tier) {
        case 'pianissimo_possibile':
            // Failed run - no rewards
            break;

        case 'pianissimo':
            rewards.echoes = randInt(0, 5);
            rewards.valves = 1;
            break;

        case 'piano':
            rewards.echoes = randInt(4, 12);
            if (chance(50)) rewards.reeds.push(randomReed(1.0, 1.5));
            rewards.valves = randInt(1, 3);
            break;

        case 'mezzo_piano':
            rewards.echoes = randInt(4, 26);
            for (let i = 0; i < randInt(0, 2); i++) rewards.reeds.push(randomReed(1.0, 2.0));
            rewards.valves = 3;
            if (chance(30)) rewards.corkGrease = 1;
            break;

        case 'mezzo_forte':
            rewards.echoes = randInt(15, 45);
            for (let i = 0; i < randInt(1, 2); i++) rewards.reeds.push(randomReed(1.0, 2.5));
            rewards.valves = randInt(4, 5);
            if (chance(45)) rewards.corkGrease = 1;
            if (chance(90)) rewards.valveOil = randInt(1, 2);
            rewards.slides = randInt(1, 2);
            if (chance(50)) rewards.brassIngots = 1;
            break;

        case 'forte':
            rewards.echoes = randInt(35, 60);
            for (let i = 0; i < randInt(1, 3); i++) rewards.reeds.push(randomReed(1.0, 2.5));
            if (chance(84)) rewards.corkGrease = 1;
            rewards.valves = randInt(6, 10);
            if (chance(90)) rewards.valveOil = randInt(1, 3);
            rewards.brassIngots = 1;
            rewards.slides = randInt(1, 4);
            if (chance(9)) rewards.moonlightAzarite = 1;
            break;

        case 'fortissimo':
            rewards.echoes = randInt(58, 105);
            for (let i = 0; i < randInt(2, 4); i++) rewards.reeds.push(randomReed(1.5, 3.0));
            rewards.corkGrease = randInt(1, 2);
            rewards.valves = randInt(11, 20);
            rewards.valveOil = randInt(2, 3);
            rewards.brassIngots = randInt(2, 4);
            rewards.slides = randInt(2, 6);
            if (chance(30)) rewards.moonlightAzarite = 1;
            if (chance(4)) rewards.commonAccessory = true;
            break;

        case 'fortissimo_plus':
            rewards.echoes = randInt(90, 216);
            for (let i = 0; i < randInt(4, 5); i++) rewards.reeds.push(randomReed(1.5, 3.5));
            rewards.corkGrease = randInt(1, 3);
            rewards.valves = randInt(16, 29);
            rewards.valveOil = randInt(2, 5);
            rewards.brassIngots = randInt(4, 10);
            if (chance(45)) rewards.reinforcedIngots = 1;
            rewards.slides = randInt(9, 12);
            if (chance(73)) rewards.moonlightAzarite = randInt(1, 3);
            if (chance(15)) rewards.commonAccessory = true;
            break;

        case 'fortissimo_possibile':
            rewards.echoes = randInt(145, 264);
            for (let i = 0; i < randInt(4, 5); i++) rewards.reeds.push(randomReed(1.5, 4.0));
            rewards.corkGrease = randInt(2, 3);
            rewards.valves = randInt(25, 40);
            rewards.valveOil = randInt(4, 6);
            rewards.brassIngots = randInt(7, 16);
            rewards.reinforcedIngots = randInt(1, 2);
            if (chance(10)) rewards.infusedIngots = 1;
            rewards.slides = randInt(10, 16);
            rewards.moonlightAzarite = randInt(2, 4);
            if (chance(30)) rewards.commonAccessory = true;
            if (chance(5)) rewards.rareAccessory = true;
            break;
    }

    // 5% chance for each valve to be upgraded to a heavy valve
    let upgradedValves = 0;
    for (let i = 0; i < rewards.valves; i++) {
        if (chance(5)) {
            upgradedValves++;
        }
    }
    if (upgradedValves > 0) {
        rewards.valves -= upgradedValves;
        rewards.heavyValves += upgradedValves;
    }

    return rewards;
}
