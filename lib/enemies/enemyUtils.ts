import { usePlayerStore, useGameStore, useAccessoryStore, useInventoryStore } from '@/lib/store';
import { unregisterEnemyPosition } from '@/lib/enemies/enemyMovement';
import { getStatsForLevel, getEnemyHpMultiplier } from '@/lib/game/stats';

/**
 * Round a number to the tenths place to avoid floating point display issues.
 * Shared across all enemy types.
 */
export function roundToTenths(value: number): number {
    return Math.round(value * 10) / 10;
}

/**
 * Calculates max health for an enemy based on its level and specific health scaling multiplier.
 */
export function calculateEnemyHealth(level: number, healthMultiplier: number): number {
    const baseStats = getStatsForLevel(level);
    const hpScaling = getEnemyHpMultiplier(level);
    return roundToTenths(baseStats.health * healthMultiplier * hpScaling);
}

/**
 * Calculate the wave XP multiplier based on enemy ID.
 * Wave enemies (spawned in altar rooms) get progressively higher XP.
 *
 * @param id - Enemy instance ID (e.g. "wave-enemy-3-abc")
 * @param baseMultiplier - Base XP multiplier for this enemy type (e.g. 1 for Trumpet, 5 for Tuba)
 * @returns Final XP multiplier with wave scaling applied
 */
export function getWaveXpMultiplier(id: string, baseMultiplier: number): number {
    let mult = baseMultiplier;
    if (id.includes('wave-')) {
        if (id.includes('wave-enemy-1')) {
            mult *= 1.5;
        } else if (id.includes('wave-enemy-2')) {
            mult *= 2;
        } else if (id.includes('wave-enemy-3')) {
            mult *= 3;
        } else if (id.includes('wave-enemy-4')) {
            mult *= 4;
        } else if (id.includes('wave-enemy-5')) {
            mult *= 5;
        }
    }
    return mult;
}

/**
 * Process item drops from an enemy death.
 * Handles echoes separately (goes to player store) and materials (goes to inventory).
 */
export function processDrops(
    drops: Record<string, any>,
): void {
    if (Object.keys(drops).length > 0) {
        if (drops.echoes) {
            usePlayerStore.getState().collectEchoes(drops.echoes);
            delete drops.echoes;
        }
        if (Object.keys(drops).length > 0) {
            useInventoryStore.getState().addMaterials(drops);
        }
    }
}

export interface EnemyDeathConfig {
    /** Enemy instance ID */
    id: string;
    /** Enemy level */
    level: number;
    /** Base XP multiplier for this enemy type (e.g. 1 for Trumpet, 5 for Tuba) */
    baseXpMultiplier: number;
    /** Embouchure XP to grant on death */
    embouchureXp: number;
    /** Gold formula for backstage_halls: receives level, returns gold amount */
    goldFormula: (level: number) => number;
    /** Drop function: receives (level, location), returns drops record */
    getDrops: (level: number, location: string) => Record<string, any>;
    /** Optional callback after all rewards are processed */
    onDeath?: (id: string) => void;
}

/**
 * Process all rewards and cleanup for an enemy death.
 * Handles: position unregister, XP (with wave scaling), embouchure XP,
 * gold (backstage only), drops, and onDeath callback.
 *
 * Callers are responsible for:
 * - Guarding with `rewardGranted.current`
 * - Setting `setIsAlive(false)`
 * - Any enemy-specific pre-death hooks (e.g. Euphonium shield cleanup)
 */
export function processEnemyDeath(config: EnemyDeathConfig): void {
    const { id, level, baseXpMultiplier, embouchureXp, goldFormula, getDrops, onDeath } = config;

    // XP with wave scaling
    const xpMult = getWaveXpMultiplier(id, baseXpMultiplier);
    const playerStore = usePlayerStore.getState();
    playerStore.registerKill(level, xpMult);

    // Embouchure XP
    useAccessoryStore.getState().addEmbouchureXp(embouchureXp);

    // Gold (backstage halls only)
    const gameStore = useGameStore.getState();
    const currentLocation = gameStore.currentLocation;
    if (currentLocation === 'backstage_halls') {
        gameStore.collectGold(goldFormula(level));
    }

    // Drops
    const drops = getDrops(level, currentLocation);
    processDrops(drops);

    // DEFER LIGHTWEIGHT CLEANUP AND SPANWER UPDATES
    // This spreads the CPU spike of unmounting and spatial registry updates
    // over subsequent frames, maintaining target FPS during the kill frame.
    requestAnimationFrame(() => {
        // Unregister from spatial registry
        unregisterEnemyPosition(id);

        // Callback (triggers spawner re-render/unmount)
        onDeath?.(id);
    });
}
