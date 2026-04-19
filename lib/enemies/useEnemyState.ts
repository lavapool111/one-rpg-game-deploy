import { useRef, useState } from 'react';
import { Vector3 } from 'three';
import { usePlayerStore, useGameStore } from '@/lib/store';
import { PoisonState } from '@/lib/enemies/abilityUtils';

/**
 * A shared hook that provides the standard state, refs, and store subscriptions
 * necessary for every enemy component. This drastically reduces boilerplate.
 */
export function useEnemyState(initialPosition: [number, number, number], maxHealth: number) {
    const healthRef = useRef(maxHealth);
    const [currentHealth, setCurrentHealth] = useState(maxHealth);
    const [isAlive, setIsAlive] = useState(true);

    const lastTickTime = useRef(0);
    const lastAttackTime = useRef(0);
    const rewardGranted = useRef(false);

    // Poison DOT state
    const poisonState = useRef<PoisonState>({
        isActive: false,
        endTime: 0,
        damagePerSecond: 0
    });

    // Store subscriptions
    const isLongToneActive = usePlayerStore((state) => state.isLongToneActive);
    const playerDamage = usePlayerStore((state) => state.damage);
    const basicAttackDamage = usePlayerStore((state) => state.basicAttackDamage);
    const playerTakeDamage = usePlayerStore((state) => state.takeDamage);
    const simulationActive = useGameStore((state) => state.simulationActive);
    const gameState = useGameStore((state) => state.gameState);

    // Visuals
    const damageNumberRef = useRef<{ value: number, time: number, type?: 'normal' | 'crit' | 'superCrit' } | null>(null);

    // Reusable vectors for physics/movement
    const enemyPos = useRef(new Vector3(...initialPosition));
    const playerPos = useRef(new Vector3());
    const direction = useRef(new Vector3());
    const playerDistanceRef = useRef(0); // For health bar visibility

    // Engine optimization refs
    const frameCounter = useRef(0); // For tiered frame skip
    const accumulatedDelta = useRef(0);
    const unitScale = useRef(new Vector3(1, 1, 1));

    // Attack State
    const [isAttacking, setIsAttacking] = useState(false);

    // Wander state (when not aggroed)
    const wanderDirection = useRef(new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize());
    const lastWanderChange = useRef(0);

    return {
        healthRef, currentHealth, setCurrentHealth,
        isAlive, setIsAlive,
        lastTickTime, lastAttackTime, rewardGranted, poisonState,
        isLongToneActive, playerDamage, basicAttackDamage, playerTakeDamage,
        simulationActive, gameState,
        damageNumberRef,
        enemyPos, playerPos, direction, playerDistanceRef,
        frameCounter, accumulatedDelta, unitScale,
        isAttacking, setIsAttacking,
        wanderDirection, lastWanderChange
    };
}
