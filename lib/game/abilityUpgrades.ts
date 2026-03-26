/**
 * Ability Upgrade System
 * Defines upgrade paths and costs for Long Tone and Sustained Bow abilities
 */

import { MaterialItemId } from './inventory';

// Upgrade paths available at Tier 1
export type AbilityUpgradePath = 'crits' | 'brute_force' | 'poison';

// Individual upgrade level definition
export interface AbilityUpgradeLevel {
  level: number;
  cost: number;
  costMaterial: MaterialItemId;
  // Stat bonuses based on chosen path
  critChanceBonus?: number;      // For Crits path (percentage, e.g., 0.05 = 5%)
  critFactorBonus?: number;      // For Crits path (multiplier, e.g., 1.5 = 1.5x)
  baseDamageBonus?: number;      // For Brute Force path (percentage, e.g., 0.05 = +5%)
  dotDamageBonus?: number;       // For Poison path (percentage per second, e.g., 0.05 = 5% base damage/sec)
  dotDurationBonus?: number;      // For Poison path (seconds)
  // Generic damage multiplier (applies to all paths)
  damageMultiplierBonus?: number; // Percentage bonus to ability damage (e.g., 0.03 = +3%)
  // Range bonus (only at level 10)
  rangeBonus?: number;           // Feet added to ability range
  // Tier 2 stats
  tickSpeedBonus?: number;       // +% tick speed (levels 11-25)
  impactBonus?: number;          // +Impact stat for Brute Force path
  cooldownReduction?: number;    // % cooldown reduction
  durationBonus?: number;        // +seconds duration (for all paths)
}

// For upgrades that vary by path but share level/cost
export interface PathSpecificUpgrade {
  level: number;
  cost: number;
  costMaterial: MaterialItemId;
  paths: Record<AbilityUpgradePath, Omit<AbilityUpgradeLevel, 'level' | 'cost' | 'costMaterial'>>;
}

export type AnyAbilityUpgrade = AbilityUpgradeLevel | PathSpecificUpgrade;

// The ability upgrade state for a player
export interface AbilityUpgrades {
  // Which path was chosen at level 1 (null if not chosen yet)
  chosenPath: AbilityUpgradePath | null;
  // Current upgrade level (0-10, where 0 means no upgrades purchased)
  currentLevel: number;
  // Whether upgrades are unlocked (requires level 30)
  unlocked: boolean;
}

// Upgrade 1: Choose your path (3 Brass Essence)
const UPGRADE_1: PathSpecificUpgrade = {
  level: 1,
  cost: 3,
  costMaterial: 'brass_essence',
  paths: {
    crits: {
      critChanceBonus: 0.05,  // 5% crit chance
      critFactorBonus: 1.5,   // 1.5x crit factor
    },
    brute_force: {
      baseDamageBonus: 0.05,  // +5% base damage
    },
    poison: {
      dotDamageBonus: 0.05,   // 5% base damage per second
      dotDurationBonus: 5,    // 5 seconds duration
    },
  }
};

// Upgrade 2: Small stat increase (2 Brass Essence)
const UPGRADE_2: PathSpecificUpgrade = {
  level: 2,
  cost: 2,
  costMaterial: 'brass_essence',
  paths: {
    crits: {
      critChanceBonus: 0.007, // +0.7% crit chance
    },
    brute_force: {
      baseDamageBonus: 0.03,  // +3% base damage
    },
    poison: {
      dotDamageBonus: 0.03,   // +3% base damage per second
    },
  }
};

// Upgrade 3: Small stat increase (3 Brass Essence)
const UPGRADE_3: PathSpecificUpgrade = {
  level: 3,
  cost: 3,
  costMaterial: 'brass_essence',
  paths: {
    crits: {
      critChanceBonus: 0.008, // +0.8% crit chance
    },
    brute_force: {
      baseDamageBonus: 0.04,  // +4% base damage
    },
    poison: {
      dotDamageBonus: 0.04,   // +4% base damage per second
    },
  }
};

// Upgrade 4: Small stat increase (4 Brass Essence)
const UPGRADE_4: PathSpecificUpgrade = {
  level: 4,
  cost: 4,
  costMaterial: 'brass_essence',
  paths: {
    crits: {
      critChanceBonus: 0.009, // +0.9% crit chance
    },
    brute_force: {
      baseDamageBonus: 0.05,  // +5% base damage
    },
    poison: {
      dotDamageBonus: 0.05,   // +5% base damage per second
    },
  }
};

// Upgrade 5: Damage multiplier (6 Brass Essence) - applies to all paths
const UPGRADE_5: AbilityUpgradeLevel = {
  level: 5,
  cost: 6,
  costMaterial: 'brass_essence',
  damageMultiplierBonus: 0.03, // +3% damage multiplier
};

// Upgrade 6: Small stat increase (3 Brass Essence)
const UPGRADE_6: PathSpecificUpgrade = {
  level: 6,
  cost: 3,
  costMaterial: 'brass_essence',
  paths: {
    crits: {
      critChanceBonus: 0.008, // +0.8% crit chance
    },
    brute_force: {
      baseDamageBonus: 0.04,  // +4% base damage
    },
    poison: {
      dotDamageBonus: 0.04,   // +4% base damage per second
    },
  }
};

// Upgrade 7: Small stat increase (4 Brass Essence)
const UPGRADE_7: PathSpecificUpgrade = {
  level: 7,
  cost: 4,
  costMaterial: 'brass_essence',
  paths: {
    crits: {
      critChanceBonus: 0.009, // +0.9% crit chance
    },
    brute_force: {
      baseDamageBonus: 0.05,  // +5% base damage
    },
    poison: {
      dotDamageBonus: 0.05,   // +5% base damage per second
    },
  }
};

// Upgrade 8: Small stat increase (5 Brass Essence)
const UPGRADE_8: PathSpecificUpgrade = {
  level: 8,
  cost: 5,
  costMaterial: 'brass_essence',
  paths: {
    crits: {
      critChanceBonus: 0.01,  // +1% crit chance
    },
    brute_force: {
      baseDamageBonus: 0.06,  // +6% base damage
    },
    poison: {
      dotDamageBonus: 0.06,   // +6% base damage per second
    },
  }
};

// Upgrade 9: Damage multiplier (8 Brass Essence) - applies to all paths
const UPGRADE_9: AbilityUpgradeLevel = {
  level: 9,
  cost: 8,
  costMaterial: 'brass_essence',
  damageMultiplierBonus: 0.04, // +4% damage multiplier
};

// Upgrade 10: Range increase (10 Brass Essence) - applies to all paths
const UPGRADE_10: AbilityUpgradeLevel = {
  level: 10,
  cost: 10,
  costMaterial: 'brass_essence',
  rangeBonus: 2.5, // +2.5 feet range
};

// Tier 2 Upgrade 11: Tick speed boost (5 Brass Essence)
const UPGRADE_11: AbilityUpgradeLevel = {
  level: 11,
  cost: 5,
  costMaterial: 'brass_essence',
  tickSpeedBonus: 0.20, // +20% tick speed
};

// Tier 2 Upgrade 12: Path-specific stat boost (8 Brass Essence)
const UPGRADE_12: PathSpecificUpgrade = {
  level: 12,
  cost: 8,
  costMaterial: 'brass_essence',
  paths: {
    crits: {
      critFactorBonus: 0.2, // +0.2 crit factor
    },
    brute_force: {
      impactBonus: 0.5, // +0.5 Impact
    },
    poison: {
      tickSpeedBonus: 0.02, // +2% tick speed
    },
  }
};

// Tier 2 Upgrade 13: Path-specific stat boost (9 Brass Essence)
const UPGRADE_13: PathSpecificUpgrade = {
  level: 13,
  cost: 9,
  costMaterial: 'brass_essence',
  paths: {
    crits: {
      critChanceBonus: 0.012, // +1.2% crit chance
    },
    brute_force: {
      impactBonus: 0.6, // +0.6 Impact
    },
    poison: {
      dotDurationBonus: 0.5, // +0.5s duration
    },
  }
};

// Tier 2 Upgrade 14: Path-specific stat boost (10 Brass Essence)
const UPGRADE_14: PathSpecificUpgrade = {
  level: 14,
  cost: 10,
  costMaterial: 'brass_essence',
  paths: {
    crits: {
      critFactorBonus: 0.3, // +0.3 crit factor
    },
    brute_force: {
      impactBonus: 0.7, // +0.7 Impact
    },
    poison: {
      tickSpeedBonus: 0.025, // +2.5% tick speed
    },
  }
};

// Tier 2 Upgrade 15: Range increase (12 Brass Essence)
const UPGRADE_15: AbilityUpgradeLevel = {
  level: 15,
  cost: 12,
  costMaterial: 'brass_essence',
  rangeBonus: 1.5, // +1.5 feet range
};

// Tier 2 Upgrade 16: Path-specific stat boost (11 Brass Essence)
const UPGRADE_16: PathSpecificUpgrade = {
  level: 16,
  cost: 11,
  costMaterial: 'brass_essence',
  paths: {
    crits: {
      critFactorBonus: 0.3, // +0.3 crit factor
    },
    brute_force: {
      impactBonus: 0.6, // +0.6 Impact
    },
    poison: {
      tickSpeedBonus: 0.03, // +3% tick speed
    },
  }
};

// Tier 2 Upgrade 17: Path-specific stat boost (12 Brass Essence)
const UPGRADE_17: PathSpecificUpgrade = {
  level: 17,
  cost: 12,
  costMaterial: 'brass_essence',
  paths: {
    crits: {
      critChanceBonus: 0.016, // +1.6% crit chance
    },
    brute_force: {
      impactBonus: 0.7, // +0.7 Impact
    },
    poison: {
      dotDurationBonus: 0.5, // +0.5s duration
    },
  }
};

// Tier 2 Upgrade 18: Path-specific stat boost (13 Brass Essence)
const UPGRADE_18: PathSpecificUpgrade = {
  level: 18,
  cost: 13,
  costMaterial: 'brass_essence',
  paths: {
    crits: {
      critFactorBonus: 0.4, // +0.4 crit factor
    },
    brute_force: {
      impactBonus: 0.8, // +0.8 Impact
    },
    poison: {
      tickSpeedBonus: 0.035, // +3.5% tick speed
    },
  }
};

// Tier 2 Upgrade 19: Path-specific stat boost (15 Brass Essence)
const UPGRADE_19: PathSpecificUpgrade = {
  level: 19,
  cost: 15,
  costMaterial: 'brass_essence',
  paths: {
    crits: {
      critFactorBonus: 0.5, // +0.5 crit factor
    },
    brute_force: {
      impactBonus: 0.8, // +0.8 Impact
    },
    poison: {
      tickSpeedBonus: 0.035, // +3.5% tick speed
    },
  }
};

// Tier 2 Upgrade 20: Duration increase (20 Brass Essence)
const UPGRADE_20: AbilityUpgradeLevel = {
  level: 20,
  cost: 20,
  costMaterial: 'brass_essence',
  durationBonus: 2.5, // +2.5 seconds duration
};

// Tier 2 Upgrade 21: Path-specific stat boost (14 Brass Essence)
const UPGRADE_21: PathSpecificUpgrade = {
  level: 21,
  cost: 14,
  costMaterial: 'brass_essence',
  paths: {
    crits: {
      critFactorBonus: 0.35, // +0.35 crit factor
    },
    brute_force: {
      impactBonus: 0.9, // +0.9 Impact
    },
    poison: {
      tickSpeedBonus: 0.04, // +4% tick speed
    },
  }
};

// Tier 2 Upgrade 22: Path-specific stat boost (16 Brass Essence)
const UPGRADE_22: PathSpecificUpgrade = {
  level: 22,
  cost: 16,
  costMaterial: 'brass_essence',
  paths: {
    crits: {
      critChanceBonus: 0.025, // +2.5% crit chance
    },
    brute_force: {
      impactBonus: 1.0, // +1 Impact
    },
    poison: {
      dotDurationBonus: 0.5, // +0.5s duration
    },
  }
};

// Tier 2 Upgrade 23: Path-specific stat boost (18 Brass Essence)
const UPGRADE_23: PathSpecificUpgrade = {
  level: 23,
  cost: 18,
  costMaterial: 'brass_essence',
  paths: {
    crits: {
      critFactorBonus: 0.4, // +0.4 crit factor
    },
    brute_force: {
      impactBonus: 1.1, // +1.1 Impact
    },
    poison: {
      tickSpeedBonus: 0.045, // +4.5% tick speed
    },
  }
};

// Tier 2 Upgrade 24: Path-specific stat boost (21 Brass Essence)
const UPGRADE_24: PathSpecificUpgrade = {
  level: 24,
  cost: 21,
  costMaterial: 'brass_essence',
  paths: {
    crits: {
      critFactorBonus: 0.75, // +0.75 crit factor
    },
    brute_force: {
      impactBonus: 1.8, // +1.8 Impact
    },
    poison: {
      tickSpeedBonus: 0.06, // +6% tick speed
    },
  }
};

// Tier 2 Upgrade 25: Cooldown reduction (25 Brass Essence)
const UPGRADE_25: AbilityUpgradeLevel = {
  level: 25,
  cost: 25,
  costMaterial: 'brass_essence',
  cooldownReduction: 0.10, // 10% less cooldown
};

// All Tier 1 upgrades in order
export const ABILITY_UPGRADES_TIER_1 = [
  UPGRADE_1,
  UPGRADE_2,
  UPGRADE_3,
  UPGRADE_4,
  UPGRADE_5,
  UPGRADE_6,
  UPGRADE_7,
  UPGRADE_8,
  UPGRADE_9,
  UPGRADE_10,
];

// All Tier 2 upgrades in order (levels 11-25)
export const ABILITY_UPGRADES_TIER_2 = [
  UPGRADE_11,
  UPGRADE_12,
  UPGRADE_13,
  UPGRADE_14,
  UPGRADE_15,
  UPGRADE_16,
  UPGRADE_17,
  UPGRADE_18,
  UPGRADE_19,
  UPGRADE_20,
  UPGRADE_21,
  UPGRADE_22,
  UPGRADE_23,
  UPGRADE_24,
  UPGRADE_25,
];

// Combined all upgrades
export const ALL_ABILITY_UPGRADES = [
  ...ABILITY_UPGRADES_TIER_1,
  ...ABILITY_UPGRADES_TIER_2,
];

// Unlock level requirement
export const ABILITY_UPGRADES_UNLOCK_LEVEL = 30;

// Tier 2 unlock level requirement
export const ABILITY_UPGRADES_TIER_2_UNLOCK_LEVEL = 50;

// Helper to get the next upgrade for a given path and level
export function getNextUpgrade(currentLevel: number, path: AbilityUpgradePath | null): AbilityUpgradeLevel | null {
  // Max level is 25 (10 tier 1 + 15 tier 2)
  if (currentLevel >= 25) return null;

  const nextUpgrade = ALL_ABILITY_UPGRADES[currentLevel];
  if (!nextUpgrade) return null;

  // For level 1, we need to choose a path
  if (currentLevel === 0 && !path) {
    // Return a generic version showing the choice options
    return {
      level: 1,
      cost: 3,
      costMaterial: 'brass_essence',
    };
  }

  // Is this a path-specific upgrade?
  if ('paths' in nextUpgrade) {
    if (!path) return null; // Shouldn't happen if they are past level 0, but just in case
    const pathBits = nextUpgrade.paths[path];
    return {
      level: nextUpgrade.level,
      cost: nextUpgrade.cost,
      costMaterial: nextUpgrade.costMaterial,
      ...pathBits
    } as AbilityUpgradeLevel;
  }

  // For universal upgrades
  return nextUpgrade as AbilityUpgradeLevel;
}

// Helper to calculate total stats from upgrades
export function calculateAbilityUpgradeStats(upgrades: AbilityUpgrades) {
  const stats = {
    critChance: 0,
    critFactor: 0,
    baseDamageBonus: 0,
    dotDamagePerSecond: 0,
    dotDuration: 0,
    damageMultiplier: 1.0,
    rangeBonus: 0,
    // Tier 2 stats
    tickSpeedBonus: 0,
    impactBonus: 0,
    cooldownReduction: 0,
    durationBonus: 0,
  };

  if (!upgrades.chosenPath || upgrades.currentLevel === 0) {
    return stats;
  }

  const path = upgrades.chosenPath;

  // Apply upgrades up to current level
  for (let i = 0; i < upgrades.currentLevel; i++) {
    const upgrade = ALL_ABILITY_UPGRADES[i];

    if (i === 0) {
      // Level 1 - path specific
      const pathSpecific = upgrade as PathSpecificUpgrade;
      const pathUpgrade = pathSpecific.paths[path];
      if (pathUpgrade.critChanceBonus) stats.critChance += pathUpgrade.critChanceBonus;
      if (pathUpgrade.critFactorBonus) stats.critFactor = pathUpgrade.critFactorBonus; // Base crit factor
      if (pathUpgrade.baseDamageBonus) stats.baseDamageBonus += pathUpgrade.baseDamageBonus;
      if (pathUpgrade.dotDamageBonus) stats.dotDamagePerSecond += pathUpgrade.dotDamageBonus;
      if (pathUpgrade.dotDurationBonus) stats.dotDuration += pathUpgrade.dotDurationBonus;
    } else if (i === 4 || i === 8) {
      // Level 5 and 9 - universal damage multiplier
      const universalUpgrade = upgrade as AbilityUpgradeLevel;
      if (universalUpgrade.damageMultiplierBonus) {
        stats.damageMultiplier += universalUpgrade.damageMultiplierBonus;
      }
    } else if (i === 9) {
      // Level 10 - universal range bonus (tier 1)
      const universalUpgrade = upgrade as AbilityUpgradeLevel;
      if (universalUpgrade.rangeBonus) {
        stats.rangeBonus += universalUpgrade.rangeBonus;
      }
    } else if (i === 14) {
      // Level 15 - universal range bonus (tier 2)
      const universalUpgrade = upgrade as AbilityUpgradeLevel;
      if (universalUpgrade.rangeBonus) {
        stats.rangeBonus += universalUpgrade.rangeBonus;
      }
    } else if (i === 19) {
      // Level 20 - universal duration bonus
      const universalUpgrade = upgrade as AbilityUpgradeLevel;
      if (universalUpgrade.durationBonus) {
        stats.durationBonus += universalUpgrade.durationBonus;
      }
    } else if (i === 24) {
      // Level 25 - universal cooldown reduction
      const universalUpgrade = upgrade as AbilityUpgradeLevel;
      if (universalUpgrade.cooldownReduction) {
        stats.cooldownReduction += universalUpgrade.cooldownReduction;
      }
    } else {
      // Path-specific upgrades
      const pathSpecific = upgrade as PathSpecificUpgrade;
      const pathUpgrade = pathSpecific.paths ? pathSpecific.paths[path] : undefined;
      if (pathUpgrade) {
        if (pathUpgrade.critChanceBonus) stats.critChance += pathUpgrade.critChanceBonus;
        if (pathUpgrade.critFactorBonus) stats.critFactor += pathUpgrade.critFactorBonus;
        if (pathUpgrade.baseDamageBonus) stats.baseDamageBonus += pathUpgrade.baseDamageBonus;
        if (pathUpgrade.dotDamageBonus) stats.dotDamagePerSecond += pathUpgrade.dotDamageBonus;
        if (pathUpgrade.dotDurationBonus) stats.dotDuration += pathUpgrade.dotDurationBonus;
        // Tier 2 stats
        if (pathUpgrade.tickSpeedBonus) stats.tickSpeedBonus += pathUpgrade.tickSpeedBonus;
        if (pathUpgrade.impactBonus) stats.impactBonus += pathUpgrade.impactBonus;
      }
    }

    // Universal tick speed bonuses (level 11, and poison path levels)
    const universalUpgrade = upgrade as AbilityUpgradeLevel;
    if (universalUpgrade.tickSpeedBonus) {
      stats.tickSpeedBonus += universalUpgrade.tickSpeedBonus;
    }
  }

  return stats;
}

// Helper to get total Brass Essence cost for all upgrades
export function getTotalUpgradeCost(currentLevel: number, path: AbilityUpgradePath | null): number {
  let total = 0;

  // Max level is 25 (10 tier 1 + 15 tier 2)
  for (let i = currentLevel; i < 25; i++) {
    const upgrade = ALL_ABILITY_UPGRADES[i];
    if (!upgrade) continue;

    if ('paths' in upgrade) {
      if (i === 0 && !path) {
        // Haven't chosen path yet, assume cost of 3
        total += 3;
      } else {
        total += upgrade.cost;
      }
    } else {
      total += (upgrade as AbilityUpgradeLevel).cost;
    }
  }

  return total;
}
