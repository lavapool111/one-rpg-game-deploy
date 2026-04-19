import { Vector3, Group } from 'three';
import { usePlayerStore, useInventoryStore, useGameStore } from '@/lib/store';
import { calculateAbilityDamage } from '@/lib/enemies/damageUtils';
import { checkLineOfSight } from '@/lib/game/pillars';
import { getFloorHeightAt } from '@/lib/game/stairCollision';
import { Pillar } from '@/lib/game/pillars';

// --- Static Reusable Vectors for Zero-Allocation Math ---
const _playerPos = new Vector3();
const _pushDir = new Vector3();
const _knockbackDir = new Vector3();

/**
 * Shared Poison State Interface
 */
export interface PoisonState {
    isActive: boolean;
    endTime: number;
    damagePerSecond: number;
}

export const BASE_TICK_RATE = 0.5;

/**
 * Handles Overtone Shield pushback logic for an enemy.
 * Pushes the enemy away if they are within 15ft of the player while Overtone is active.
 * Returns true if the enemy was pushed (allowing the caller to skip normal AI).
 */
export function applyOvertonePushback(
    enemyPos: Vector3,
    group: Group | null,
    bodyHeight: number,
    cappedDelta: number
): boolean {
    const playerState = usePlayerStore.getState();
    if (!playerState.isOvertoneActive || !group) return false;

    const pPos = _playerPos.set(...playerState.position);
    const distToPlayerSq = pPos.distanceToSquared(enemyPos);

    if (distToPlayerSq <= 225.0 && distToPlayerSq > 0.01) { // 15ft squared
        const distance = Math.sqrt(distToPlayerSq);
        // Push enemy away from player
        _pushDir.subVectors(enemyPos, pPos).normalize();
        _pushDir.y = 0; // Keep push horizontal
        const pushSpeed = 30; // ft/s
        enemyPos.add(_pushDir.multiplyScalar(pushSpeed * cappedDelta));

        const currentLocation = useGameStore.getState().currentLocation;
        const floorY = getFloorHeightAt(enemyPos.x, enemyPos.z, enemyPos.y, 0.3, currentLocation);
        enemyPos.y = floorY + (bodyHeight / 2);
        group.position.copy(enemyPos);
        return true; // Skip normal AI while being pushed
    }

    return false;
}

/**
 * Handles Long Tone damage application including range checks, LOS, DOT application, and knockback.
 */
export function applyLongToneDamage(
    enemyPos: Vector3,
    playerPos: Vector3,
    isLongToneActive: boolean,
    lastTickTimeRef: { current: number },
    currentTime: number,
    takeDamage: (amount: number, type?: 'normal' | 'crit' | 'superCrit') => void,
    poisonStateRef: { current: PoisonState },
    pillars: Pillar[],
    faceDirection?: Vector3
) {
    if (!isLongToneActive) return;

    const playerState = usePlayerStore.getState();
    const abilityStats = playerState.getAbilityUpgradeStats();
    const tickSpeedMultiplier = 1 + (abilityStats.tickSpeedBonus || 0);
    const effectiveTickRate = BASE_TICK_RATE / tickSpeedMultiplier;

    if (currentTime - lastTickTimeRef.current >= effectiveTickRate) {
        const distSq = enemyPos.distanceToSquared(playerPos);
        const baseRange = 20; // Base 20 feet range
        const effectiveRange = baseRange + (abilityStats.rangeBonus || 0);

        if (distSq < effectiveRange * effectiveRange) {
            // Check LOS before applying damage
            const hasLOS = pillars.length === 0 || checkLineOfSight(
                { x: playerPos.x, z: playerPos.z },
                { x: enemyPos.x, z: enemyPos.z },
                pillars
            );

            if (hasLOS) {
                const accStore = require('@/lib/store/accessoryStore').useAccessoryStore.getState();
                const { damage: rawDamage, type: dmgType } = calculateAbilityDamage(
                    playerState.damage,
                    playerState.critChance,
                    accStore.critFactor,
                    abilityStats
                );
                const finalDamage = Math.max(0, rawDamage);

                if (finalDamage > 0) {
                    takeDamage(finalDamage, dmgType);
                    lastTickTimeRef.current = currentTime;

                    // Apply knockback from impactBonus (Tier 2 Brute Force stat) - 1 foot per impact point
                    const knockbackDistance = abilityStats.impactBonus || 0;
                    if (knockbackDistance > 0 && faceDirection && faceDirection.lengthSq() > 0.001) {
                        _knockbackDir.copy(faceDirection).normalize().negate();
                        enemyPos.addScaledVector(_knockbackDir, knockbackDistance);
                    }

                    // Apply Poison DOT if player has poison upgrades
                    if (abilityStats.dotDamagePerSecond > 0 && abilityStats.dotDuration > 0) {
                        poisonStateRef.current = {
                            isActive: true,
                            endTime: currentTime + abilityStats.dotDuration,
                            damagePerSecond: abilityStats.dotDamagePerSecond * playerState.damage * 0.15
                        };
                    }

                    // Brass Essence drop (2% chance per enemy hit by ability damage)
                    if (Math.random() < 0.02) {
                        useInventoryStore.getState().addMaterial('brass_essence', 1);
                    }
                }
            }
        }
    }
}

/**
 * Handles poison DOT (Damage Over Time) ticks.
 * Can be called independently of Long Tone active state.
 */
export function updatePoisonDot(
    currentTime: number,
    poisonStateRef: { current: PoisonState },
    lastTickTimeRef: { current: number },
    takeDamage: (amount: number) => void
) {
    if (!poisonStateRef.current.isActive) return;

    // Throttle state read: only read if applying damage
    const now = currentTime;
    if (now - lastTickTimeRef.current < 0.1) return; // Basic throttle for the check itself

    if (now >= poisonStateRef.current.endTime) {
        // Poison expired
        poisonStateRef.current.isActive = false;
        return;
    }

    const playerState = usePlayerStore.getState();
    const abilityStats = playerState.getAbilityUpgradeStats();
    const tickSpeedMultiplier = 1 + (abilityStats.tickSpeedBonus || 0);
    const effectiveTickRate = BASE_TICK_RATE / tickSpeedMultiplier;

    if (now - lastTickTimeRef.current >= effectiveTickRate) {
        // Apply poison DOT damage
        const dotDamage = poisonStateRef.current.damagePerSecond * effectiveTickRate;
        if (dotDamage > 0) {
            takeDamage(dotDamage);
            lastTickTimeRef.current = now;
        }
    }
}
