export interface LevelStats {
    health: number;
    damage: number;
}

// Stat increments per level range
// The user provided ranges like "1-10: +4", "11-20: +8"
// This implies that moving FROM level X to X+1 where X is in range gets the bonus.
// E.g. Level 1 -> 2 (X=1, in 1-10) gets +4.
// Most people shouldn't push past 1000.

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
    { maxLevel: 610, hp: 9600, dmg: 972 },
    { maxLevel: 620, hp: 10240, dmg: 1008 },
    { maxLevel: 630, hp: 10800, dmg: 1056 },
    { maxLevel: 640, hp: 11520, dmg: 1104 },
    { maxLevel: 650, hp: 12240, dmg: 1152 },
    { maxLevel: 660, hp: 12960, dmg: 1200 },
    { maxLevel: 670, hp: 13680, dmg: 1248 },
    { maxLevel: 680, hp: 14400, dmg: 1296 },
    { maxLevel: 690, hp: 15120, dmg: 1344 },
    { maxLevel: 700, hp: 16500, dmg: 1440 },
    { maxLevel: 710, hp: 17280, dmg: 1488 },
    { maxLevel: 720, hp: 18000, dmg: 1536 },
    { maxLevel: 730, hp: 18720, dmg: 1584 },
    { maxLevel: 740, hp: 19500, dmg: 1632 },
    { maxLevel: 750, hp: 20280, dmg: 1680 },
    { maxLevel: 760, hp: 21120, dmg: 1728 },
    { maxLevel: 770, hp: 21960, dmg: 1776 },
    { maxLevel: 780, hp: 22800, dmg: 1824 },
    { maxLevel: 790, hp: 23640, dmg: 1872 },
    { maxLevel: 800, hp: 24480, dmg: 1920 },
    { maxLevel: 810, hp: 25200, dmg: 1968 },
    { maxLevel: 820, hp: 26420, dmg: 2016 },
    { maxLevel: 830, hp: 27640, dmg: 2064 },
    { maxLevel: 840, hp: 28800, dmg: 2160 },
    { maxLevel: 850, hp: 30120, dmg: 2208 },
    { maxLevel: 860, hp: 31560, dmg: 2256 },
    { maxLevel: 870, hp: 33000, dmg: 2304 },
    { maxLevel: 880, hp: 34560, dmg: 2352 },
    { maxLevel: 890, hp: 36000, dmg: 2460 },
    { maxLevel: 900, hp: 37500, dmg: 2520 },
    { maxLevel: 910, hp: 39000, dmg: 2642 },
    { maxLevel: 920, hp: 40500, dmg: 2880 },
    { maxLevel: 930, hp: 42000, dmg: 3012 },
    { maxLevel: 940, hp: 43500, dmg: 3240 },
    { maxLevel: 950, hp: 45000, dmg: 3456 },
    { maxLevel: 960, hp: 46500, dmg: 3600 },
    { maxLevel: 970, hp: 48000, dmg: 3960 },
    { maxLevel: 980, hp: 49500, dmg: 4200 },
    { maxLevel: 990, hp: 51000, dmg: 4440 },
    { maxLevel: 1000, hp: 52500, dmg: 4680 },
    { maxLevel: 10000, hp: 105000, dmg: 9360 },
];

/**
 * Calculates Max Health and Damage for a given level
 * Uses lazy-evaluation caching to ensure O(1) lookups after initial calculation.
 */
const STATS_CACHE: LevelStats[] = [
    { health: 0, damage: 0 }, // index 0 unused
    { health: 10, damage: 1 }, // Level 1
];

export function getStatsForLevel(targetLevel: number): LevelStats {
    while (targetLevel >= STATS_CACHE.length) {
        const i = STATS_CACHE.length - 1;
        const prev = STATS_CACHE[i];

        // Find increment (loop backwards for speed or use simple find)
        let increment = STAT_INCREMENTS[STAT_INCREMENTS.length - 1];
        for (const inc of STAT_INCREMENTS) {
            if (i < inc.maxLevel) {
                increment = inc;
                break;
            }
        }

        STATS_CACHE.push({
            health: prev.health + increment.hp,
            damage: prev.damage + increment.dmg,
        });
    }
    return STATS_CACHE[targetLevel];
}

// Enemy HP multiplier bands - similar structure to STAT_INCREMENTS
// Each band defines maxLevel and the HP multiplier increment per level in that band
const ENEMY_HP_BANDS = [
    { maxLevel: 10, mult: 0 },
    { maxLevel: 20, mult: 0.015 },
    { maxLevel: 30, mult: 0.03 },
    { maxLevel: 40, mult: -0.015 },
    { maxLevel: 50, mult: 0.04 },
    { maxLevel: 60, mult: -0.015 },
    { maxLevel: 70, mult: 0.05 },
    { maxLevel: 80, mult: -0.015 },
    { maxLevel: 90, mult: 0.06 },
    { maxLevel: 100, mult: -0.015 },
    { maxLevel: 120, mult: 0.07 },
    { maxLevel: 150, mult: 0 },
    { maxLevel: 180, mult: 0.08 },
    { maxLevel: 210, mult: -0.015 },
    { maxLevel: 240, mult: 0.09 },
    { maxLevel: 270, mult: -0.015 },
    { maxLevel: 300, mult: 0.10 },
    { maxLevel: 330, mult: -0.015 },
    { maxLevel: 360, mult: 0.11 },
    { maxLevel: 390, mult: -0.015 },
    { maxLevel: 420, mult: 0.12 },
    { maxLevel: 450, mult: -0.015 },
    { maxLevel: 480, mult: 0.13 },
    { maxLevel: 540, mult: -0.0015 },
    { maxLevel: 600, mult: 0.015 },
    { maxLevel: 2000, mult: 0.0001 },
];

/**
 * Piecewise linear HP multiplier for enemies based on level.
 * Uses cached lazy-evaluation.
 */
const ENEMY_HP_MUL_CACHE: number[] = [0, 1]; // level 1 = 1x

// Enemy Defense bands - Piecewise linear points per level
const ENEMY_DEFENSE_BANDS = [
    { maxLevel: 300, points: 0 },
    { maxLevel: 400, points: 10 },
    { maxLevel: 500, points: 20 },
    { maxLevel: 600, points: 30 },
    { maxLevel: 700, points: 45 },
    { maxLevel: 800, points: 60 },
    { maxLevel: 900, points: 90 },
    { maxLevel: 1000, points: 120 },
    { maxLevel: 1200, points: 150 },
    { maxLevel: 10000, points: 300 },
];

/**
 * Piecewise linear Defense Points for enemies based on level.
 * Uses cached lazy-evaluation.
 */
const ENEMY_DEFENSE_CACHE: number[] = [0]; // level 0 = 0

export function getEnemyDefense(level: number): number {
    while (level >= ENEMY_DEFENSE_CACHE.length) {
        const i = ENEMY_DEFENSE_CACHE.length;

        let points = 0;
        let prevMaxLevel = 0;

        for (const band of ENEMY_DEFENSE_BANDS) {
            if (i <= prevMaxLevel) break;
            const levelsInBand = Math.min(i, band.maxLevel) - prevMaxLevel;
            points += levelsInBand * band.points;
            prevMaxLevel = band.maxLevel;
        }

        if (i > prevMaxLevel) {
            const lastBand = ENEMY_DEFENSE_BANDS[ENEMY_DEFENSE_BANDS.length - 1];
            points += (i - prevMaxLevel) * lastBand.points;
        }

        ENEMY_DEFENSE_CACHE.push(points);
    }
    return ENEMY_DEFENSE_CACHE[level];
}

export function getEnemyHpMultiplier(level: number): number {
    while (level >= ENEMY_HP_MUL_CACHE.length) {
        const i = ENEMY_HP_MUL_CACHE.length;

        let multiplier = 1;
        let prevMaxLevel = 0;

        for (const band of ENEMY_HP_BANDS) {
            if (i <= prevMaxLevel) break;
            const levelsInBand = Math.min(i, band.maxLevel) - prevMaxLevel;
            multiplier += levelsInBand * band.mult;
            prevMaxLevel = band.maxLevel;
        }

        if (i > prevMaxLevel) {
            const lastBand = ENEMY_HP_BANDS[ENEMY_HP_BANDS.length - 1];
            multiplier += (i - prevMaxLevel) * lastBand.mult;
        }

        ENEMY_HP_MUL_CACHE.push(multiplier);
    }
    return ENEMY_HP_MUL_CACHE[level];
}

const hundred = 7560;
const onezeroone = 15120;

const bandone = [
    5, 10, 20, 30, 40, 60, 75, 120, 160, 200, 600, 750, 900, 1050, 1200, 1350, 1500, 1800, 2100,
    2400, 2700, 3000, 3300, 3750, 4200, 4600, 5100, 5600, 6000, 6600, 7200, 7800, 8400, 9000, 9750, 10500,
    12000, 13000, 14000, 15000, 16500, 18000, 19500, 20400, 21600, 23800, 25200, 27200, 28800,
    30000, 32000, 33600, 36000, 37800, 39600, 41600, 43200, 44000,
    45600, 47800, 49500, 50400, 52800, 54600, 57600, 62400, 67800,
    71800, 75600, 79200, 84000, 89600, 92400, 97200, 103500, 112000,
    126000, 140000, 156000, 172000, 195000, 216000, 234000, 252000,
    288000, 324000, 356000, 378000, 396000, 432000, 456000, 480000,
    528000, 552000, 594000, 660000, 720000, 792000, 864000, 972000,
    1080000, 1200000, 1320000, 1440000, 1560000, 1680000, 1840000, 2000000, 2160000,
    3240000, 4320000, 5400000, 6720000, 7560000, 9240000, 12000000, 15600000, 20000000,
    25200000, 32400000, 43200000, 48000000, 54000000, 64000000, 75600000, 86400000, 92400000, 105600000, 126000000,
];

// Precompute the entire XP table on startup!
const xplookup: number[] = [0]; // Index 0 is 0
(function initXpLookupTable() {
    let start = 0;
    let level = 1;
    let alina = 10;

    for (const one of bandone) {
        for (let i = 0; i < alina; i++) {
            if (level === 100) {
                start = hundred;
            } else if (level === 101) {
                start = onezeroone;
            } else {
                start += one;
            }

            if (level > 1000) {
                alina = 100;
            }

            xplookup[level] = start;
            level++;
        }
    }
})();

/**
 * Calculates XP required to advance FROM currentLevel TO currentLevel + 1
 * Uses fully precomputed O(1) lookup table.
 */
export function getXpRequiredForLevel(currentLevel: number): number {
    if (currentLevel < xplookup.length) {
        return xplookup[currentLevel];
    }
    // Fallback if level exceeds table
    // User logic previously appended simple additions, so we just return last element + something large
    return xplookup[xplookup.length - 1] + (currentLevel * 10000);
}


