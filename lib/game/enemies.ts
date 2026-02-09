/**
 * Enemy System
 * Enemy types, spawning, and behavior patterns
 */

export type EnemyType = 'basic' | 'ranged' | 'tank' | 'boss';

export interface EnemyConfig {
    type: EnemyType;
    health: number;
    damage: number;
    speed: number;
    points: number;
}

/**
 * Base enemy configurations
 */
export const ENEMY_CONFIGS: Record<EnemyType, EnemyConfig> = {
    basic: {
        type: 'basic',
        health: 50,
        damage: 10,
        speed: 2,
        points: 100,
    },
    ranged: {
        type: 'ranged',
        health: 30,
        damage: 15,
        speed: 1.5,
        points: 150,
    },
    tank: {
        type: 'tank',
        health: 150,
        damage: 20,
        speed: 1,
        points: 250,
    },
    boss: {
        type: 'boss',
        health: 500,
        damage: 30,
        speed: 1.5,
        points: 1000,
    },
};

/**
 * Get scaled enemy config based on phase
 */
export function getScaledEnemyConfig(
    type: EnemyType,
    phase: number
): EnemyConfig {
    const base = ENEMY_CONFIGS[type];
    const phaseMultiplier = 1 + ((phase - 1) * 0.5);

    return {
        ...base,
        health: Math.floor(base.health * phaseMultiplier),
        damage: Math.floor(base.damage * phaseMultiplier),
        points: Math.floor(base.points * phaseMultiplier),
    };
}

/**
 * Generate spawn positions around the arena
 */
export function generateSpawnPosition(arenaRadius: number = 15): [number, number, number] {
    const angle = Math.random() * Math.PI * 2;
    const distance = arenaRadius * 0.8 + Math.random() * arenaRadius * 0.2;

    return [
        Math.cos(angle) * distance,
        0,
        Math.sin(angle) * distance,
    ];
}
