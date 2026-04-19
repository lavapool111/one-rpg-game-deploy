import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import * as THREE from 'three';
import { useGameStore, usePlayerStore } from '@/lib/store';
import { applyEnemyMovement, shouldUpdateEnemyFrame, registerEnemyPosition, applySeparation, checkZoneLineOfSight } from '@/lib/enemies/enemyMovement';
import { applyOvertonePushback, applyLongToneDamage, updatePoisonDot } from '@/lib/enemies/abilityUtils';
import { useEnemyState } from './useEnemyState';
import { Pillar, checkLineOfSight } from '@/lib/game/pillars';
import { PoisonState } from './abilityUtils';

export interface EnemyFrameConfig {
    id: string;
    level: number;
    speed: number;
    bodyHeight: number;
    bodyRadius: number;
    // Attack logic
    attackRange: number;
    attackCooldown?: number;
    customAttack?: (clock: THREE.Clock) => boolean; // Returns true if attack was handled

    // Environment
    pillars: Pillar[];
    arenaCenter?: [number, number, number];
    arenaRadius?: number;
    teleportToCenterOnOOB?: boolean;
    sightRange?: number;

    // Callbacks
    onDeath?: (id: string) => void;
    takeDamage: (amount: number, type?: 'normal' | 'crit' | 'superCrit') => void;

    // Logic Overrides
    canMove?: boolean;
    onUpdate?: (delta: number, currentTime: number, distanceToPlayer: number, canSeePlayer: boolean) => void;

    // Confined logic (mostly for Tuba/Euphonium in prison cells)
    maxRangeFromSpawn?: number;
    worldSpawnPos?: Vector3 | React.MutableRefObject<Vector3>;
    isConfined?: boolean;
    worldPosReady?: React.MutableRefObject<boolean>;
}

/**
 * A centralized useFrame hook for all enemy types.
 * Handles performance culling, movement, collision, and basic damage types.
 */
export function useEnemyFrame(
    state: ReturnType<typeof useEnemyState>,
    config: EnemyFrameConfig,
    groupRef: React.RefObject<Group | null>,
    healthBarRef?: React.RefObject<Group | null>
) {
    const { camera } = useThree();
    const gameState = useGameStore(s => s.gameState);
    const currentLocation = useGameStore(s => s.currentLocation);

    useFrame((threeState, delta) => {
        // 1. Basic Guards & Delta Capping
        const cappedDelta = Math.min(delta, 0.1);
        if (!groupRef.current || !state.isAlive || gameState !== 'playing') return;

        // 2. Kill Floor Check
        if (state.enemyPos.current.y < -500) {
            if (state.rewardGranted.current) return;
            state.rewardGranted.current = true;
            state.setIsAlive(false);
            config.onDeath?.(config.id);
            return;
        }

        // 3. Overtone Shield Pushback
        if (applyOvertonePushback(state.enemyPos.current, groupRef.current, config.bodyHeight, cappedDelta)) {
            state.playerPos.current.fromArray(usePlayerStore.getState().position);
            return;
        }

        const currentTime = threeState.clock.elapsedTime;
        camera.getWorldPosition(state.playerPos.current);

        // 4. Position & Distance Calculation
        const getPoint = (p: Vector3 | React.MutableRefObject<Vector3>) => {
            return (p as React.MutableRefObject<Vector3>).current || (p as Vector3);
        };

        const effectivePos = config.isConfined && config.worldSpawnPos
            ? getPoint(config.worldSpawnPos)
            : state.enemyPos.current;

        // Safety for confined enemies: if worldPos not ready, try to capture or skip
        if (config.isConfined && config.worldPosReady && !config.worldPosReady.current && config.worldSpawnPos) {
            groupRef.current.updateMatrixWorld(true);
            const target = getPoint(config.worldSpawnPos);
            groupRef.current.getWorldPosition(target);
            // Check if it's actually different from [0,0,0] or local initial
            if (target.lengthSq() > 0.1) {
                config.worldPosReady.current = true;
            } else {
                return; // Wait for scene graph
            }
        }

        const distanceToPlayer = effectivePos.distanceTo(state.playerPos.current);
        state.playerDistanceRef.current = distanceToPlayer;

        // 5. Hard Distance Culling (Max 400ft)
        if (distanceToPlayer > 400) return;

        // 6. Tiered Frame Skip Optimization
        state.frameCounter.current++;
        state.accumulatedDelta.current += cappedDelta;

        if (!shouldUpdateEnemyFrame(distanceToPlayer, state.frameCounter.current)) {
            // Only sync visual position if not confined (confined positions are static)
            if (!config.isConfined) {
                groupRef.current.position.copy(state.enemyPos.current);
            }
            return;
        }

        const effectiveDelta = state.accumulatedDelta.current;
        state.accumulatedDelta.current = 0;

        // 7. Aggro & Sight Logic
        const hasZoneLOS = checkZoneLineOfSight(effectivePos, state.playerPos.current);
        const sightRange = config.sightRange || (currentLocation === 'backstage_halls' ? 60 : 100);
        const canSeePlayer = distanceToPlayer <= sightRange && (currentLocation !== 'backstage_halls' || hasZoneLOS);

        // Update Health Bar Visibility
        if (healthBarRef?.current) {
            healthBarRef.current.visible = state.currentHealth < state.healthRef.current || canSeePlayer;
        }

        // Face / Direction toward player
        state.direction.current.copy(state.playerPos.current).sub(effectivePos);
        state.direction.current.y = 0;
        state.direction.current.normalize();

        // 8. Custom Update Callback (for unique enemy animations/state)
        config.onUpdate?.(effectiveDelta, currentTime, distanceToPlayer, canSeePlayer);

        // 9. Movement Logic
        if (config.canMove !== false && !state.isAttacking) {
            if (canSeePlayer && distanceToPlayer > config.attackRange) {
                // Aggro Move
                const moveDist = config.speed * effectiveDelta;
                applyEnemyMovement({
                    currentPos: state.enemyPos.current,
                    moveDirection: state.direction.current,
                    moveDistance: moveDist,
                    currentLocation,
                    bodyHeight: config.bodyHeight,
                    bodyRadius: config.bodyRadius,
                    pillars: config.pillars,
                    arenaCenter: config.arenaCenter || [0, 0, 0],
                    arenaRadius: config.arenaRadius || 375,
                    teleportToCenterOnOOB: config.teleportToCenterOnOOB
                });
            } else if (!canSeePlayer) {
                // Idle Wander
                const WANDER_CHANGE_INTERVAL = 3 + Math.random() * 2;
                if (currentTime - state.lastWanderChange.current > WANDER_CHANGE_INTERVAL) {
                    state.wanderDirection.current.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                    state.lastWanderChange.current = currentTime;
                }

                const wanderSpeed = (config.speed * 0.6) * effectiveDelta;
                const { didCollide } = applyEnemyMovement({
                    currentPos: state.enemyPos.current,
                    moveDirection: state.wanderDirection.current,
                    moveDistance: wanderSpeed,
                    currentLocation,
                    bodyHeight: config.bodyHeight,
                    bodyRadius: config.bodyRadius,
                    pillars: config.pillars,
                    arenaCenter: config.arenaCenter || [0, 0, 0],
                    arenaRadius: config.arenaRadius || 375,
                    teleportToCenterOnOOB: config.teleportToCenterOnOOB
                });

                if (didCollide) {
                    state.wanderDirection.current.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                }
            }
        }

        // 10. Sync Visuals (Position & Rotation)
        if (!config.isConfined) {
            applySeparation(config.id, state.enemyPos.current, config.id.split('-')[0] as any);
            registerEnemyPosition(config.id, state.enemyPos.current.x, state.enemyPos.current.z, config.id.split('-')[0] as any);
            groupRef.current.position.copy(state.enemyPos.current);
        }

        // Rotation: face player if aggroed, else face wander direction
        if (canSeePlayer && state.direction.current.lengthSq() > 0.001) {
            const angle = Math.atan2(state.direction.current.x, state.direction.current.z);
            groupRef.current.rotation.y = angle;
        } else if (!canSeePlayer && state.wanderDirection.current.lengthSq() > 0.001) {
            const angle = Math.atan2(state.wanderDirection.current.x, state.wanderDirection.current.z);
            groupRef.current.rotation.y = angle;
        }

        // 11. Attack Logic
        if (canSeePlayer && distanceToPlayer <= config.attackRange && currentTime - state.lastAttackTime.current >= (config.attackCooldown || 3.0)) {
            const hasLOS = config.pillars.length === 0 || checkLineOfSight(
                { x: effectivePos.x, z: effectivePos.z },
                { x: state.playerPos.current.x, z: state.playerPos.current.z },
                config.pillars
            );

            if (hasLOS) {
                if (config.customAttack) {
                    const handled = config.customAttack(threeState.clock);
                    if (handled) {
                        state.lastAttackTime.current = currentTime;
                    }
                } else {
                    // Default basic attack
                    state.setIsAttacking(true);
                    state.lastAttackTime.current = currentTime;
                    setTimeout(() => {
                        const baseDmg = 10; // Default fallback
                        const enemyType = config.id.split('-')[0] as "trumpet" | "trombone" | "tuba" | "french_horn" | "euphonium";
                        state.playerTakeDamage(baseDmg, enemyType);
                        state.setIsAttacking(false);
                    }, 500);
                }
            }
        }

        // 12. Incoming Status Effects (Poison, Long Tone)
        updatePoisonDot(currentTime, state.poisonState, state.lastTickTime, config.takeDamage);
        applyLongToneDamage(
            effectivePos,
            state.playerPos.current,
            state.isLongToneActive,
            state.lastTickTime,
            currentTime,
            config.takeDamage,
            state.poisonState,
            config.pillars,
            state.direction.current
        );
    });
}
