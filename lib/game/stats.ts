export interface LevelStats {
    health: number;
    damage: number;
}

// Stat increments per level range
// The user provided ranges like "1-10: +4", "11-20: +8"
// This implies that moving FROM level X to X+1 where X is in range gets the bonus.
// E.g. Level 1 -> 2 (X=1, in 1-10) gets +4.
const STAT_INCREMENTS = [
    { maxLevel: 10, hp: 4, dmg: 1 },
    { maxLevel: 20, hp: 8, dmg: 2 },
    { maxLevel: 30, hp: 10, dmg: 3 },
    { maxLevel: 40, hp: 14, dmg: 4 },
    { maxLevel: 50, hp: 18, dmg: 5 },
    { maxLevel: 60, hp: 24, dmg: 6 },
    { maxLevel: 70, hp: 30, dmg: 8 },
    { maxLevel: 80, hp: 36, dmg: 10 },
    { maxLevel: 90, hp: 42, dmg: 12 },
    { maxLevel: 100, hp: 51, dmg: 15 },
    { maxLevel: 110, hp: 60, dmg: 18 }, // "102-110", assuming coverage for 101-110 range effectively
    { maxLevel: 120, hp: 80, dmg: 21 },
    { maxLevel: 130, hp: 105, dmg: 24 },
    { maxLevel: 140, hp: 140, dmg: 28 },
    { maxLevel: 150, hp: 175, dmg: 33 },
    { maxLevel: 160, hp: 216, dmg: 39 },
    { maxLevel: 170, hp: 264, dmg: 45 },
    { maxLevel: 180, hp: 312, dmg: 51 },
    { maxLevel: 190, hp: 378, dmg: 59 },
    { maxLevel: 200, hp: 420, dmg: 66 },
    { maxLevel: 210, hp: 480, dmg: 73 },
    { maxLevel: 220, hp: 546, dmg: 81 },
    { maxLevel: 230, hp: 624, dmg: 90 },
    { maxLevel: 240, hp: 702, dmg: 100 },
    { maxLevel: 250, hp: 792, dmg: 112 },
    { maxLevel: 260, hp: 880, dmg: 126 },
    { maxLevel: 270, hp: 972, dmg: 144 },
    { maxLevel: 280, hp: 1080, dmg: 156 },
    { maxLevel: 290, hp: 1200, dmg: 168 },
    { maxLevel: 300, hp: 1320, dmg: 184 },
    { maxLevel: 310, hp: 1440, dmg: 208 },
    { maxLevel: 320, hp: 1560, dmg: 224 },
    { maxLevel: 330, hp: 1680, dmg: 246 },
    { maxLevel: 340, hp: 1800, dmg: 264 },
    { maxLevel: 350, hp: 2000, dmg: 288 },
    { maxLevel: 360, hp: 2240, dmg: 312 },
    { maxLevel: 370, hp: 2480, dmg: 336 },
    { maxLevel: 380, hp: 2720, dmg: 360 },
    { maxLevel: 390, hp: 2960, dmg: 384 },
    { maxLevel: 400, hp: 3200, dmg: 408 },
    { maxLevel: 410, hp: 3440, dmg: 432 },
    { maxLevel: 420, hp: 3680, dmg: 456 },
    { maxLevel: 430, hp: 3920, dmg: 492 },
    { maxLevel: 440, hp: 4160, dmg: 528 },
    { maxLevel: 450, hp: 4400, dmg: 552 },
    { maxLevel: 460, hp: 4640, dmg: 576 },
    { maxLevel: 470, hp: 4880, dmg: 600 },
    { maxLevel: 480, hp: 5120, dmg: 624 },
    { maxLevel: 490, hp: 5360, dmg: 648 },
    { maxLevel: 500, hp: 5600, dmg: 672 },
    { maxLevel: 510, hp: 6000, dmg: 696 },
    { maxLevel: 520, hp: 6400, dmg: 720 },
    { maxLevel: 530, hp: 6720, dmg: 744 },
    { maxLevel: 540, hp: 7040, dmg: 768 },
    { maxLevel: 550, hp: 7360, dmg: 792 },
    { maxLevel: 560, hp: 7680, dmg: 816 },
    { maxLevel: 570, hp: 8000, dmg: 840 },
    { maxLevel: 580, hp: 8320, dmg: 864 },
    { maxLevel: 590, hp: 8640, dmg: 888 },
    { maxLevel: 600, hp: 9120, dmg: 924 },
];

/**
 * Calculates Max Health and Damage for a given level
 */
export function getStatsForLevel(targetLevel: number): LevelStats {
    let health = 10;
    let damage = 1;

    // Level 1 has base stats. We loop from 1 to targetLevel - 1 to add increments.
    // i represents the current level we are at, moving to i+1.
    for (let i = 1; i < targetLevel; i++) {
        const increment = STAT_INCREMENTS.find((inc) => i < inc.maxLevel) || STAT_INCREMENTS[STAT_INCREMENTS.length - 1];
        health += increment.hp;
        damage += increment.dmg;
    }

    return { health, damage };
}

// Enemy HP multiplier bands - similar structure to STAT_INCREMENTS
// Each band defines maxLevel and the HP multiplier increment per level in that band
const ENEMY_HP_BANDS = [
    { maxLevel: 10, mult: 0 },
    { maxLevel: 20, mult: 0.015 },
    { maxLevel: 30, mult: 0.03 },
    { maxLevel: 40, mult: 0.045 },
    { maxLevel: 50, mult: 0.06 },
    { maxLevel: 60, mult: 0.075 },
    { maxLevel: 70, mult: 0.09 },
    { maxLevel: 80, mult: 0.105 },
    { maxLevel: 90, mult: 0.12 },
    { maxLevel: 100, mult: 0.125 },
    { maxLevel: 120, mult: 0.13 },
    { maxLevel: 150, mult: 0.135 },
    { maxLevel: 2000, mult: 0 },
];

/**
 * Piecewise linear HP multiplier for enemies based on level.
 * Uses ENEMY_HP_BANDS to calculate cumulative multiplier.
 */
export function getEnemyHpMultiplier(level: number): number {
    let multiplier = 1;
    let prevMaxLevel = 0;

    for (const band of ENEMY_HP_BANDS) {
        if (level <= prevMaxLevel) break;

        const levelsInBand = Math.min(level, band.maxLevel) - prevMaxLevel;
        multiplier += levelsInBand * band.mult;
        prevMaxLevel = band.maxLevel;
    }

    // Handle levels beyond the last defined band
    if (level > prevMaxLevel) {
        const lastBand = ENEMY_HP_BANDS[ENEMY_HP_BANDS.length - 1];
        multiplier += (level - prevMaxLevel) * lastBand.mult;
    }

    return multiplier;
}

/**
 * Calculates XP required to advance FROM currentLevel TO currentLevel + 1
 * Consolidates the user's specific loop logic.
 */
export function getXpRequiredForLevel(currentLevel: number): number {
    // Logic derived from user's snippet:
    // The user's loop calculates "XP to level X" which creates 'start'.
    // 'start' is the amount needed for that step.
    // We re-run the simulation up to the requested level.

    let start = 0;
    const hundred = 7560;
    const onezeroone = 75600;

    const bandone = [
        5, 10, 20, 30, 40, 60, 75, 120, 160, 200,
        2400, 3000, 3750, 4500, 5100, 5850, 6700, 7800, 9000, 10500,
        12000, 14000, 16500, 19500, 20400, 21600, 23800, 25200, 28800,
        30000, 32000, 33600, 36000, 37800, 39600, 41600, 43200, 44000,
        45600, 47800, 49500, 50400, 52800, 54600, 57600, 62400, 67800,
        71800, 75600, 79200, 84000, 89600, 92400, 97200, 103500, 112000,
        126000, 140000, 156000, 172000, 195000, 216000
    ];

    let simLevel = 1;

    // We simulate the exact loop structure
    for (const one of bandone) {
        for (let i = 0; i < 10; i++) {
            // Logic from snippet
            if (simLevel === 100) {
                start = hundred;
            } else if (simLevel === 101) {
                start = onezeroone;
            } else {
                start += one;
            }

            // If we found the XP needed for the requested level, return it
            if (simLevel === currentLevel) {
                return start;
            }

            simLevel++;
        }
    }

    // Fallback if level exceeds table (should be rare/impossible with this many entries ~550 levels)
    return start + 10000;
}
