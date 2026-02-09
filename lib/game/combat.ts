/**
 * Combat System
 * Handles damage calculation, attack patterns, and combat mechanics
 */

export interface AttackResult {
    damage: number;
    critical: boolean;
    combo: number;
}

export interface CombatState {
    inCombat: boolean;
    currentCombo: number;
    lastHitTime: number;
}

/**
 * Calculate damage based on attack power, combo, and phase
 */
export function calculateDamage(
    baseDamage: number,
    combo: number,
    phase: number,
    isCritical: boolean = false
): number {
    const comboMultiplier = 1 + (combo * 0.1);
    const phaseMultiplier = 1 + ((phase - 1) * 0.25);
    const critMultiplier = isCritical ? 2 : 1;

    return Math.floor(baseDamage * comboMultiplier * phaseMultiplier * critMultiplier);
}

/**
 * Check if an attack is a critical hit
 */
export function rollCritical(critChance: number = 0.1): boolean {
    return Math.random() < critChance;
}

/**
 * Process a player attack
 */
export function processAttack(
    baseDamage: number,
    currentCombo: number,
    phase: number,
    critChance: number = 0.1
): AttackResult {
    const critical = rollCritical(critChance);
    const damage = calculateDamage(baseDamage, currentCombo, phase, critical);

    return {
        damage,
        critical,
        combo: currentCombo + 1,
    };
}
