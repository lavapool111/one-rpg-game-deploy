'use client';

import { useRef, useState, useEffect, useMemo, createContext, useContext, memo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import * as THREE from 'three';
import { usePlayerStore, useGameStore, useAccessoryStore } from '@/lib/store';
import { roundToTenths, processEnemyDeath, calculateEnemyHealth } from '@/lib/enemies/enemyUtils';
import { hitboxMat } from '@/lib/enemies/enemyMaterials';
import { Merged } from '@react-three/drei';
import { EnemyHealthBar } from './EnemyHealthBar';
import { getStatsForLevel } from '@/lib/game/stats';
import { applyEnemyMovement, shouldUpdateEnemyFrame, registerEnemyPosition, unregisterEnemyPosition, applySeparation } from '@/lib/enemies/enemyMovement';
import { getTrumpetDrops } from '@/lib/enemies/enemyDrops';
import { useEnemyState } from '@/lib/enemies/useEnemyState';
import { Pillar, checkLineOfSight } from '@/lib/game/pillars';
import { getFloorHeightAt } from '@/lib/game/stairCollision';
import { applyOvertonePushback, applyLongToneDamage, updatePoisonDot, PoisonState } from '@/lib/enemies/abilityUtils';

/**
 * Trumpet Enemy Component
 * 
 * A brass enemy that chases the player and fires "Loud Fanfares"
 * 
 * Dimensions: 3 × 2 × 2 feet
 * Speed: 4 ft/s
 * Health: Scales with player level (1.0x HP scaling)
 * Attack: Scales at 0.5x player damage scaling, every 2.5 seconds at 10ft range
 * XP: 1 + (level - 1) * 0.1
 */

// Constants
const TRUMPET_SPEED = 4; // ft/s
const ATTACK_RANGE = 10; // feet
const ATTACK_COOLDOWN = 2.5; // seconds
const SIGHT_RANGE = 100; // feet - enemies can only see player from this distance

// Dimensions in feet
const BODY_LENGTH = 3;
const BODY_HEIGHT = 2;
const BODY_DEPTH = 2;

// Trumpet damage scaling factor (20% of player damage increments)
const TRUMPET_DAMAGE_SCALE = 0.2;

/**
 * Calculate Trumpet stats for a given level
 * Uses same base stats as player from getStatsForLevel(), then applies enemy multipliers
 */
function getTrumpetStats(level: number): { health: number; damage: number } {
    const health = calculateEnemyHealth(level, 2); // 2x base health

    // Damage: base stats * 0.2x for basic attacks
    const baseStats = getStatsForLevel(level);
    const damage = roundToTenths(baseStats.damage * TRUMPET_DAMAGE_SCALE);

    return { health, damage };
}

interface TrumpetProps {
    id: string;
    initialPosition: [number, number, number];
    level?: number;
    onDeath?: (id: string) => void;
    /** Pillar data for collision and LOS */
    pillars?: Pillar[];
    /** Arena radius for boundary */
    arenaRadius?: number;
    /** Center of the boundary (defaults to 0,0,0) */
    arenaCenter?: [number, number, number];
    /** If true, teleport to center when out of bounds */
    teleportToCenterOnOOB?: boolean;
    /** Optional models from Merged for instancing */
    models?: any;
}

const brassColor = '#B8860B'; // Dark goldenrod
const brassHighlight = '#DAA520'; // Goldenrod
const valveColor = '#CD853F'; // Peru

// Geometries
const mainBodyGeo = new THREE.CylinderGeometry(BODY_DEPTH / 4, BODY_DEPTH / 4, BODY_LENGTH * 0.6, 12);
const bellGeo = new THREE.CylinderGeometry(BODY_HEIGHT / 2, BODY_DEPTH / 4, 0.8, 16);
const mouthpieceGeo = new THREE.CylinderGeometry(BODY_DEPTH / 8, BODY_DEPTH / 6, 0.4, 8);
const valveGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.4, 8);
const valveCapGeo = new THREE.SphereGeometry(0.1, 8, 8);
const tubingGeo = new THREE.TorusGeometry(0.3, 0.08, 8, 16, Math.PI);
const hitboxGeo = new THREE.BoxGeometry(BODY_LENGTH, BODY_HEIGHT, BODY_DEPTH);

// Materials
const mainBodyMat = new THREE.MeshStandardMaterial({
    color: brassColor,
    roughness: 0.3,
    metalness: 0.8,
    emissive: brassColor,
    emissiveIntensity: 0.05
});
const bellMat = new THREE.MeshStandardMaterial({
    color: brassHighlight,
    roughness: 0.2,
    metalness: 0.9,
    emissive: brassHighlight,
    emissiveIntensity: 0.03
});
const bellMatAttacking = new THREE.MeshStandardMaterial({
    color: brassHighlight,
    roughness: 0.2,
    metalness: 0.9,
    emissive: '#FF6600',
    emissiveIntensity: 0.5
});
const mouthpieceMat = new THREE.MeshStandardMaterial({
    color: brassHighlight,
    roughness: 0.25,
    metalness: 0.85
});
const valveMat = new THREE.MeshStandardMaterial({
    color: valveColor,
    roughness: 0.4,
    metalness: 0.7
});
const valveCapMat = new THREE.MeshStandardMaterial({
    color: brassHighlight,
    roughness: 0.2,
    metalness: 0.9
});
const tubingMat = new THREE.MeshStandardMaterial({
    color: brassColor,
    roughness: 0.3,
    metalness: 0.8,
    emissive: brassColor,
    emissiveIntensity: 0.05
});


export const TrumpetContext = createContext<any>(null);

export function TrumpetInstances({ children }: { children: React.ReactNode }) {
    const meshes = useMemo(() => {
        return {
            mainBody: new THREE.Mesh(mainBodyGeo, mainBodyMat),
            bell: new THREE.Mesh(bellGeo, bellMat),
            bellAttacking: new THREE.Mesh(bellGeo, bellMatAttacking),
            mouthpiece: new THREE.Mesh(mouthpieceGeo, mouthpieceMat),
            valve: new THREE.Mesh(valveGeo, valveMat),
            valveCap: new THREE.Mesh(valveCapGeo, valveCapMat),
            tubing: new THREE.Mesh(tubingGeo, tubingMat),
        };
    }, []);

    return (
        <Merged castShadow receiveShadow frustumCulled={false} meshes={meshes}>
            {(instances) => (
                <TrumpetContext.Provider value={instances}>
                    {children}
                </TrumpetContext.Provider>
            )}
        </Merged>
    );
}

export const Trumpet = memo(function Trumpet({ id, initialPosition, level = 1, onDeath, pillars = [], arenaRadius = 375, arenaCenter = [0, 0, 0], teleportToCenterOnOOB = false, models: propModels }: TrumpetProps) {
    const contextModels = useContext(TrumpetContext);
    const models = propModels || contextModels;
    const groupRef = useRef<Group>(null);
    const { camera } = useThree();
    // gameState is now provided by useEnemyState

    // Calculate stats based on level (half damage scaling)
    const stats = getTrumpetStats(level);
    const TRUMPET_HEALTH = stats.health;
    const TRUMPET_DAMAGE = stats.damage;

    const {
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
    } = useEnemyState(initialPosition, TRUMPET_HEALTH);

    const WANDER_CHANGE_INTERVAL = 3 + Math.random() * 2; // 3-5 seconds

    // Despawn timer for high-level enemies (> player level + 20)
    if (!id.includes("wave")) {
        useEffect(() => {
            const playerLevel = usePlayerStore.getState().level;
            const levelThreshold = Math.max(playerLevel + 20, playerLevel * 2.5);

            // Only set despawn timer if enemy level exceeds player level + 20
            if (level > levelThreshold) {
                console.log(`High-level enemy spawned (LV ${level} vs player ${playerLevel}). Despawning in 30s if not killed...`);
                const despawnTimer = setTimeout(() => {
                    if (isAlive && !rewardGranted.current) {
                        rewardGranted.current = true;
                        console.log(`High-level enemy (LV ${level}) despawning after 30 seconds`);
                        setIsAlive(false);
                        onDeath?.(id);
                    }
                }, 30000); // 30 seconds

                return () => clearTimeout(despawnTimer);
            }
        }, [id, level, isAlive, onDeath]);
    }

    const lastHitByOvertone = useRef(0);
    const overtoneStunEndTime = useRef(0);

    // Main game loop
    useFrame((state, delta) => {
        // Cap delta to prevent huge jumps after frame stalls (e.g., shader compilation)
        const cappedDelta = Math.min(delta, 0.1);

        if (!groupRef.current || !isAlive || !simulationActive) return;

        // Kill floor check: if enemy fell to a catch floor (Y=-1000), instantly kill
        if (enemyPos.current.y < -500) {
            if (rewardGranted.current) return;
            rewardGranted.current = true;
            setIsAlive(false);
            onDeath?.(id);
            return;
        }

        // Get player position from camera
        if (!isAlive || !playerPos.current) return;

        // --- Overtone Shield Pushback Logic ---
        if (applyOvertonePushback(enemyPos.current, groupRef.current, BODY_HEIGHT, cappedDelta)) {
            playerPos.current.fromArray(usePlayerStore.getState().position);
            return;
        }

        camera.getWorldPosition(playerPos.current);

        // Only calculate distance if not stunned to player
        const distanceToPlayer = enemyPos.current.distanceTo(playerPos.current);
        playerDistanceRef.current = distanceToPlayer; // Update for health bar visibility

        // PERF: Hard sleep for very distant enemies — skip entire frame
        if (distanceToPlayer > 400) return;

        const gameStoreState = useGameStore.getState();
        const currentLocation = gameStoreState.currentLocation;

        // Removed explicit HTML DOM modification


        // Tiered frame skip based on distance (aggressive thresholds):
        frameCounter.current++;
        accumulatedDelta.current += cappedDelta;

        if (!shouldUpdateEnemyFrame(distanceToPlayer, frameCounter.current)) {
            // Always sync position for rendering, but skip expensive calculations
            groupRef.current.position.copy(enemyPos.current);
            return;
        }

        const effectiveDelta = accumulatedDelta.current;
        accumulatedDelta.current = 0;

        // Calculate direction to player (only on XZ plane)
        direction.current.copy(playerPos.current).sub(enemyPos.current);
        direction.current.y = 0; // Keep on ground
        direction.current.normalize();

        // Only act if player is within sight range
        const canSeePlayer = distanceToPlayer <= SIGHT_RANGE;
        const currentTime = state.clock.elapsedTime;

        // Move toward player if within sight range and outside attack range
        if (canSeePlayer && distanceToPlayer > ATTACK_RANGE) {
            const moveDistance = TRUMPET_SPEED * effectiveDelta;
            applyEnemyMovement({
                currentPos: enemyPos.current,
                moveDirection: direction.current,
                moveDistance,
                currentLocation,
                bodyHeight: BODY_HEIGHT,
                bodyRadius: BODY_LENGTH / 2,
                pillars,
                arenaCenter,
                arenaRadius,
                teleportToCenterOnOOB
            });

            groupRef.current.position.copy(enemyPos.current);
        } else if (!canSeePlayer) {
            // Idle wander at 2/3 speed
            // Change wander direction periodically
            if (currentTime - lastWanderChange.current > WANDER_CHANGE_INTERVAL) {
                wanderDirection.current.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                lastWanderChange.current = currentTime;
            }

            const wanderSpeed = (TRUMPET_SPEED * 2 / 3) * effectiveDelta;

            const { didCollide } = applyEnemyMovement({
                currentPos: enemyPos.current,
                moveDirection: wanderDirection.current,
                moveDistance: wanderSpeed,
                currentLocation,
                bodyHeight: BODY_HEIGHT,
                bodyRadius: BODY_LENGTH / 2,
                pillars,
                arenaCenter,
                arenaRadius,
                teleportToCenterOnOOB
            });

            if (didCollide) {
                wanderDirection.current.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
            }

            groupRef.current.position.copy(enemyPos.current);

            // Face wander direction
            if (wanderDirection.current.length() > 0.01) {
                const angle = Math.atan2(wanderDirection.current.x, wanderDirection.current.z);
                groupRef.current.rotation.y = angle;
            }
        }

        // Apply same-type separation (push apart if within 3ft)
        applySeparation(id, enemyPos.current, 'trumpet');
        if (id.includes('wave-enemy') && Math.random() < 0.001) {
            console.log(`[Trumpet] Registering ${id} at (${enemyPos.current.x.toFixed(1)}, ${enemyPos.current.z.toFixed(1)}) with takeDamage defined: ${!!takeDamage}`);
        }
        registerEnemyPosition(id, enemyPos.current.x, enemyPos.current.z, 'trumpet', takeDamage);
        groupRef.current.position.copy(enemyPos.current);

        // Face the player (only if can see them)
        if (canSeePlayer && direction.current.length() > 0.01) {
            const angle = Math.atan2(direction.current.x, direction.current.z);
            groupRef.current.rotation.y = angle;
        }

        // Attack logic - check LOS before attacking
        if (distanceToPlayer <= ATTACK_RANGE && currentTime - lastAttackTime.current >= ATTACK_COOLDOWN) {
            // Check line of sight before attacking
            const hasLOS = pillars.length === 0 || checkLineOfSight(
                { x: enemyPos.current.x, z: enemyPos.current.z },
                { x: playerPos.current.x, z: playerPos.current.z },
                pillars
            );

            if (hasLOS) {
                // Fire Loud Fanfares attack
                lastAttackTime.current = currentTime;
                setIsAttacking(true);

                // Deal damage to player (scaled by level)
                playerTakeDamage(TRUMPET_DAMAGE);

                // End attack animation after 0.3s
                setTimeout(() => setIsAttacking(false), 300);
            }
        }

        // --- INCOMING DAMAGE (Long Tone & Poison) ---
        updatePoisonDot(currentTime, poisonState, lastTickTime, takeDamage);
        applyLongToneDamage(
            enemyPos.current,
            playerPos.current,
            isLongToneActive,
            lastTickTime,
            currentTime,
            takeDamage,
            poisonState,
            pillars,
            direction.current
        );

        // Attack animation - scale up when attacking
        if (isAttacking) {
            groupRef.current.scale.setScalar(1.15);
        } else {
            groupRef.current.scale.lerp(unitScale.current, 0.1);
        }
    });

    // Handle death - checked in takeDamage instead of useEffect to avoid useState dependency
    const handleDeath = () => {
        if (rewardGranted.current) return;
        rewardGranted.current = true;
        setIsAlive(false);
        processEnemyDeath({
            id,
            level,
            baseXpMultiplier: 1,
            embouchureXp: 20,
            goldFormula: (lvl) => Math.floor(4 * (1 + lvl / 200)),
            getDrops: getTrumpetDrops,
            onDeath,
        });
    };

    const takeDamage = (amount: number, type: 'normal' | 'crit' | 'superCrit' = 'normal') => {
        const newHealth = Math.max(0, healthRef.current - amount);
        healthRef.current = newHealth;
        damageNumberRef.current = { value: Number(amount.toFixed(2)), time: Date.now(), type };

        // Check for death
        if (newHealth <= 0 && isAlive) {
            handleDeath();
        }
    };

    // Fade in health bar to prevent ghosting - minimal delay (1 frame)
    const [isReady, setIsReady] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setIsReady(true), 50);
        return () => {
            clearTimeout(t);
            unregisterEnemyPosition(id);
        };
    }, [id]);

    if (!isReady) return null;

    return (
        <group ref={groupRef} position={initialPosition}>
            {isAlive && isReady && (
                <group>
                    {/* Main body tube - horizontal cylinder */}
                    {models ? (
                        <models.mainBody position={[0, BODY_HEIGHT / 2, 0]} rotation={[0, 0, Math.PI / 2]} />
                    ) : (
                        <mesh position={[0, BODY_HEIGHT / 2, 0]} rotation={[0, 0, Math.PI / 2]} geometry={mainBodyGeo} material={mainBodyMat} />
                    )}

                    {/* Bell (flared end) */}
                    {models ? (
                        isAttacking ? (
                            <models.bellAttacking position={[BODY_LENGTH / 2 - 0.3, BODY_HEIGHT / 2, 0]} rotation={[0, 0, -Math.PI / 2]} />
                        ) : (
                            <models.bell position={[BODY_LENGTH / 2 - 0.3, BODY_HEIGHT / 2, 0]} rotation={[0, 0, -Math.PI / 2]} />
                        )
                    ) : (
                        <mesh position={[BODY_LENGTH / 2 - 0.3, BODY_HEIGHT / 2, 0]} rotation={[0, 0, -Math.PI / 2]} geometry={bellGeo} material={isAttacking ? bellMatAttacking : bellMat} />
                    )}

                    {/* Mouthpiece (narrow end) */}
                    {models ? (
                        <models.mouthpiece position={[-BODY_LENGTH / 2 + 0.3, BODY_HEIGHT / 2, 0]} rotation={[0, 0, Math.PI / 2]} />
                    ) : (
                        <mesh position={[-BODY_LENGTH / 2 + 0.3, BODY_HEIGHT / 2, 0]} rotation={[0, 0, Math.PI / 2]} geometry={mouthpieceGeo} material={mouthpieceMat} />
                    )}

                    {/* Hitbox */}
                    <mesh
                        ref={(m) => {
                            if (m) {
                                m.userData.onHit = (dmg: number, type: any) => takeDamage(dmg, type);
                                m.userData.type = 'enemy';
                                m.userData.enemyType = 'trumpet';
                                m.userData.id = id;
                            }
                        }}
                        visible={true}
                        geometry={hitboxGeo}
                        material={hitboxMat}
                    />

                    {/* Valve section */}
                    <group position={[0, BODY_HEIGHT / 2 + 0.3, 0]}>
                        {/* Three valves */}
                        {[-0.3, 0, 0.3].map((xOffset, i) => (
                            models ? (
                                <models.valve key={i} position={[xOffset, 0, 0]} />
                            ) : (
                                <mesh key={i} position={[xOffset, 0, 0]} geometry={valveGeo} material={valveMat} />
                            )
                        ))}

                        {/* Valve caps */}
                        {[-0.3, 0, 0.3].map((xOffset, i) => (
                            models ? (
                                <models.valveCap key={`cap-${i}`} position={[xOffset, 0.25, 0]} />
                            ) : (
                                <mesh key={`cap-${i}`} position={[xOffset, 0.25, 0]} geometry={valveCapGeo} material={valveCapMat} />
                            )
                        ))}
                    </group>

                    {/* Tubing curves (simplified) */}
                    {models ? (
                        <models.tubing position={[0, BODY_HEIGHT / 2 - 0.4, 0]} rotation={[Math.PI / 2, 0, 0]} />
                    ) : (
                        <mesh position={[0, BODY_HEIGHT / 2 - 0.4, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={tubingGeo} material={tubingMat} />
                    )}
                </group>
            )}

            {/* Health Bar */}
            <EnemyHealthBar
                healthRef={healthRef}
                maxHealth={TRUMPET_HEALTH}
                level={level}
                playerDistanceRef={playerDistanceRef}
                enemyType="trumpet"
                damageTextRef={damageNumberRef}
                enemyPosRef={enemyPos}
                yOffset={2.7}
                visible={gameState === 'playing' && isAlive && isReady}
            />
        </group>
    );
});

export default Trumpet;
