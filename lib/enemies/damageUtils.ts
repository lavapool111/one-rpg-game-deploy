import { useAccessoryStore } from '@/lib/store/accessoryStore';
import { DamageTextType } from '@/components/enemies/EnemyHealthBar';

export interface DamageResult {
    damage: number;
    type: DamageTextType;
    isCrit: boolean;
    isSuperCrit: boolean;
    critMult: number;
}

/**
 * Shared crit logic for basic attacks and abilities.
 */
export function calculateCritStats(
    baseCritChance: number,
    baseCritFactor: number,
    bonusCritChance: number = 0,
    bonusCritFactor: number = 0
): { critMult: number, type: DamageTextType, isCrit: boolean, isSuperCrit: boolean } {
    const totalCritChance = baseCritChance + bonusCritChance;
    const isCrit = Math.random() < totalCritChance;

    let isSuperCrit = false;
    if (totalCritChance > 1.0) {
        const superCritChance = Math.min(1.0, (totalCritChance - 1.0) / 10);
        if (Math.random() < superCritChance) {
            isSuperCrit = true;
        }
    }

    const baseMult = isCrit ? baseCritFactor : 1.0;

    let finalCritMult = isCrit && bonusCritFactor > 0
        ? baseMult * bonusCritFactor
        : baseMult;

    if (isSuperCrit) {
        finalCritMult = finalCritMult * finalCritMult;
    }

    const type: DamageTextType = isSuperCrit ? 'superCrit' : isCrit ? 'crit' : 'normal';

    return { critMult: finalCritMult, type, isCrit, isSuperCrit };
}

/**
 * Calculates Basic Attack damage (like clicking on an enemy)
 */
export function calculateBasicAttackDamage(
    baseDamage: number,
    critChance: number,
    critFactor: number,
    additionalMultiplier: number = 1.0
): DamageResult {
    const { critMult, type, isCrit, isSuperCrit } = calculateCritStats(critChance, critFactor);

    const damage = baseDamage * critMult * additionalMultiplier;

    return { damage, type, isCrit, isSuperCrit, critMult };
}

/**
 * Calculates Ability damage (like Long Tone)
 * @param playerDamage Base player damage
 * @param abilityStats The current ability upgrade stats
 * @param abilityMultiplier 0.15 for Long Tone by default
 */
export function calculateAbilityDamage(
    playerDamage: number,
    critChance: number,
    critFactor: number,
    abilityStats: any,
    abilityMultiplier: number = 0.15,
    weaponBonus: number = 0
): DamageResult {
    const { critMult, type, isCrit, isSuperCrit } = calculateCritStats(
        critChance,
        critFactor,
        abilityStats.critChance || 0,
        abilityStats.critFactor || 0
    );

    const baseAbilityDamage = playerDamage * (abilityMultiplier + weaponBonus);
    const damageWithMultiplier = baseAbilityDamage * (abilityStats.damageMultiplier || 1.0);
    const totalBaseBonus = (abilityStats.baseDamageBonus || 0) + (abilityStats.impactBonus || 0) * 0.05;

    const damageWithBaseBonus = damageWithMultiplier * (1 + totalBaseBonus);
    const rawDamage = damageWithBaseBonus * critMult;
    const damage = Math.max(0, rawDamage); // Note: Defense reduction is usually handled inside takeDamage

    return { damage, type, isCrit, isSuperCrit, critMult };
}

/**
 * Applies defense reduction to incoming damage.
 * @param amount Raw incoming damage
 * @param defenseMultiplier 0.0 means 0% defense, 1.0 means 100% defense
 */
export function applyDefenseMultiplier(amount: number, defenseMultiplier: number): number {
    let alina = Math.min(0.999, defenseMultiplier)
    return Math.max(0, amount * (1.0 - alina));
}

/**
 * Applies flat defense reduction to incoming damage.
 * @param amount Raw incoming damage
 * @param defensePoints Direct points to subtract
 * @param penetration Decimal 0.0-1.0 to bypass defense
 */
export function applyFlatDefense(amount: number, defensePoints: number, penetration: number = 0): number {
    const effectiveDefense = Math.max(0, defensePoints * (1 - penetration));
    return Math.max(1, amount - effectiveDefense);
}

/**
 * Calculates current damage multiplier for a specific enemy type based on accessories.
 */
export function getEnemyDamageMultiplier(userData: any, accStore: any): number {
    let multiplier = 1.0;
    if (!userData) return multiplier;

    const type = userData.enemyType || "";
    const id = (userData.id || "").toLowerCase();

    // 1. Trumpet Enchantment Multiplier (e.g. Brass Edge)
    if (type === 'trumpet' || id.includes('trumpet')) {
        multiplier = accStore.getEnchantmentBonus().trumpetDamageMultiplier;
    }
    // 2. Tuba Ligature Multiplier (e.g. Leather Ligature)
    else if (type === 'tuba' || id.includes('tuba')) {
        const tubaBonus = accStore.getLigatureBonus().tubaDamageBonus;
        multiplier = 1 + tubaBonus;
    }

    return multiplier;
}
