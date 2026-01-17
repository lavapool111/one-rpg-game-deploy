/**
 * Difficulty Scaling System
 * Manages phase progression and difficulty scaling
 */

export interface PhaseConfig {
    phase: number;
    name: string;
    enemyMultiplier: number;
    spawnRate: number;
    requiredScore: number;
}

/**
 * Phase configurations
 */
export const PHASE_CONFIGS: PhaseConfig[] = [
    {
        phase: 1,
        name: 'Intro',
        enemyMultiplier: 1.0,
        spawnRate: 3000, // ms between spawns
        requiredScore: 0,
    },
    {
        phase: 2,
        name: 'Rising',
        enemyMultiplier: 1.5,
        spawnRate: 2000,
        requiredScore: 5000,
    },
    {
        phase: 3,
        name: 'Climax',
        enemyMultiplier: 2.0,
        spawnRate: 1500,
        requiredScore: 15000,
    },
];

/**
 * Get current phase based on score
 */
export function getCurrentPhase(score: number): PhaseConfig {
    for (let i = PHASE_CONFIGS.length - 1; i >= 0; i--) {
        if (score >= PHASE_CONFIGS[i].requiredScore) {
            return PHASE_CONFIGS[i];
        }
    }
    return PHASE_CONFIGS[0];
}

/**
 * Calculate phase meter progress (0-1)
 */
export function getPhaseProgress(score: number): number {
    const currentPhase = getCurrentPhase(score);
    const nextPhaseIndex = PHASE_CONFIGS.findIndex(p => p.phase === currentPhase.phase) + 1;

    if (nextPhaseIndex >= PHASE_CONFIGS.length) {
        return 1; // Max phase reached
    }

    const nextPhase = PHASE_CONFIGS[nextPhaseIndex];
    const progressInPhase = score - currentPhase.requiredScore;
    const phaseRange = nextPhase.requiredScore - currentPhase.requiredScore;

    return progressInPhase / phaseRange;
}
