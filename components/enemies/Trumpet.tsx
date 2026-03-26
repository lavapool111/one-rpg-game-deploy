'use client';

import { useRef, useState, useEffect, useMemo, createContext, useContext } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import * as THREE from 'three';
import { usePlayerStore, useGameStore, useAccessoryStore, useInventoryStore } from '@/lib/store';
import { Merged } from '@react-three/drei';
import { EnemyHealthBar } from './EnemyHealthBar';
import { getStatsForLevel, getEnemyHpMultiplier } from '@/lib/game/stats';
import { calculateBasicAttackDamage, calculateAbilityDamage } from '@/lib/game/damageUtils';
import { applyEnemyMovement, shouldUpdateEnemyFrame } from '@/lib/game/enemyMovement';
import { getTrumpetDrops } from '@/lib/game/enemyDrops';
import { Pillar, checkLineOfSight } from '@/lib/game/pillars';
import { getFloorHeightAt } from '@/lib/game/stairCollision';

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
 * Round a number to the tenths place to avoid floating point errors
 */
function roundToTenths(value: number): number {
    return Math.round(value * 10) / 10;
}

/**
 * Calculate Trumpet stats for a given level
 * Uses same base stats as player from getStatsForLevel(), then applies enemy multipliers
 */
function getTrumpetStats(level: number): { health: number; damage: number; xp: number } {
    const baseStats = getStatsForLevel(level);

    // Health: base stats * 2x enemy multiplier * HP scaling
    const hpMultiplier = getEnemyHpMultiplier(level);
    const health = roundToTenths(baseStats.health * 2 * hpMultiplier);

    // Damage: base stats * 0.2x for basic attacks
    const damage = roundToTenths(baseStats.damage * TRUMPET_DAMAGE_SCALE);

    // XP formula: 1 + (level - 1) * 0.1
    const xp = 1 + (level - 1) * 0.1;

    return { health, damage, xp };
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
const hitboxMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0
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

export function Trumpet({ id, initialPosition, level = 1, onDeath, pillars = [], arenaRadius = 375, arenaCenter = [0, 0, 0], teleportToCenterOnOOB = false, models: propModels }: TrumpetProps) {
    const contextModels = useContext(TrumpetContext);
    const models = propModels || contextModels;
    const groupRef = useRef<Group>(null);
    const healthBarRef = useRef<Group>(null);
    const { camera } = useThree();
    const gameState = useGameStore((state) => state.gameState);

    // Calculate stats based on level (half damage scaling)
    const stats = getTrumpetStats(level);
    const TRUMPET_HEALTH = stats.health;
    const TRUMPET_DAMAGE = stats.damage;
    const TRUMPET_XP = stats.xp;

    // Enemy state - use refs to avoid re-renders on damage
    const healthRef = useRef(TRUMPET_HEALTH);
    const [currentHealth, setCurrentHealth] = useState(TRUMPET_HEALTH);
    const [isAlive, setIsAlive] = useState(true);
    const lastAttackTime = useRef(0);
    const rewardGranted = useRef(false);

    // Poison DOT state
    const poisonState = useRef<{ isActive: boolean; endTime: number; damagePerSecond: number }>({
        isActive: false,
        endTime: 0,
        damagePerSecond: 0
    });

    // Damage logic state - use selective subscriptions to avoid mass re-renders
    const isLongToneActive = usePlayerStore((state) => state.isLongToneActive);
    const playerDamage = usePlayerStore((state) => state.damage);
    const basicAttackDamage = usePlayerStore((state) => state.basicAttackDamage);
    const lastTickTime = useRef(0);
    const BASE_TICK_RATE = 0.5;
    const damageNumberRef = useRef<{ value: number, time: number, type?: 'normal' | 'crit' | 'superCrit' } | null>(null);




    // Reusable vectors
    const enemyPos = useRef(new Vector3(...initialPosition));
    const playerPos = useRef(new Vector3());
    const direction = useRef(new Vector3());
    const playerDistanceRef = useRef(0); // For health bar visibility
    const frameCounter = useRef(0); // For tiered frame skip
    const accumulatedDelta = useRef(0);
    const unitScale = useRef(new Vector3(1, 1, 1));

    // Attack animation state
    const [isAttacking, setIsAttacking] = useState(false);

    // Wander state (when not aggroed)
    const wanderDirection = useRef(new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize());
    const lastWanderChange = useRef(0);
    const WANDER_CHANGE_INTERVAL = 3 + Math.random() * 2; // 3-5 seconds

    // Get player damage function
    const playerTakeDamage = usePlayerStore((state) => state.takeDamage);

    // Despawn timer for high-level enemies (> player level + 20)
    if (!id.includes("wave")) {
        useEffect(() => {
            const playerLevel = usePlayerStore.getState().level;
            const levelThreshold = Math.max(playerLevel + 20, playerLevel * 1.5);

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

        if (!groupRef.current || !isAlive || gameState !== 'playing') return;

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

        // --- Overtone Stun Logic ---
        const stateObj = usePlayerStore.getState();
        if (stateObj.lastOvertoneCastTime > lastHitByOvertone.current) {
            lastHitByOvertone.current = stateObj.lastOvertoneCastTime;
            const pPos = new Vector3(...stateObj.position);
            if (pPos.distanceTo(enemyPos.current) <= 10.0) {
                overtoneStunEndTime.current = Date.now() + 2000;
            }
        }

        const isStunnedByOvertone = Date.now() < overtoneStunEndTime.current;
        if (isStunnedByOvertone) {
            const gameStoreState = useGameStore.getState();
            const currentLocation = gameStoreState.currentLocation;
            const floorY = getFloorHeightAt(enemyPos.current.x, enemyPos.current.z, enemyPos.current.y, 0.3, currentLocation);
            enemyPos.current.y = floorY + (BODY_HEIGHT / 2);
            groupRef.current.position.copy(enemyPos.current);
            playerPos.current.fromArray(stateObj.position);
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

        if (healthBarRef.current) {
            healthBarRef.current.visible = currentHealth < TRUMPET_HEALTH || distanceToPlayer <= SIGHT_RANGE;
        }

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

        // --- INCOMING DAMAGE LOGIC (Long Tone) ---
        if (isLongToneActive || poisonState.current.isActive) {
            const now = state.clock.elapsedTime;

            // Get ability upgrade stats for Tier 2 bonuses
            const playerState = usePlayerStore.getState();
            const abilityStats = playerState.getAbilityUpgradeStats();
            const tickSpeedMultiplier = 1 + (abilityStats.tickSpeedBonus || 0);
            const effectiveTickRate = BASE_TICK_RATE / tickSpeedMultiplier;

            // Handle Poison DOT (applies even if Long Tone is not active)
            if (poisonState.current.isActive) {
                if (now >= poisonState.current.endTime) {
                    // Poison expired
                    poisonState.current.isActive = false;
                } else if (now - lastTickTime.current >= effectiveTickRate) {
                    // Apply poison DOT damage
                    const dotDamage = poisonState.current.damagePerSecond * effectiveTickRate;
                    if (dotDamage > 0) {
                        takeDamage(dotDamage);
                        lastTickTime.current = now;
                    }
                }
            }

            // Handle Long Tone damage
            if (isLongToneActive && now - lastTickTime.current >= effectiveTickRate) {
                const dist = groupRef.current.position.distanceTo(playerPos.current);

                // Get ability upgrade stats
                const playerState = usePlayerStore.getState();
                const abilityStats = playerState.getAbilityUpgradeStats();
                const baseRange = 20; // Base 20 feet range
                const effectiveRange = baseRange + (abilityStats.rangeBonus || 0);

                if (dist < effectiveRange) { // Range with upgrade bonus
                    // Check LOS before applying Long Tone damage
                    const hasLOS = pillars.length === 0 || checkLineOfSight(
                        { x: playerPos.current.x, z: playerPos.current.z },
                        { x: enemyPos.current.x, z: enemyPos.current.z },
                        pillars
                    );

                    if (hasLOS) {
                        // Formula: (Damage * 0.15 * damageMultiplier * (1 + baseDamageBonus)) - Defense
                        const { damage: rawDamage, type: dmgType } = calculateAbilityDamage(playerDamage, abilityStats);
                        const finalDamage = Math.max(0, rawDamage); // Defense 0

                        if (finalDamage > 0) {
                            takeDamage(finalDamage, dmgType);

                            // Apply knockback from impactBonus (Tier 2 Brute Force stat) - 1 foot per impact point
                            const knockbackDistance = abilityStats.impactBonus || 0;
                            if (knockbackDistance > 0 && direction.current.length() > 0.01) {
                                const knockbackDir = direction.current.clone().normalize().negate();
                                enemyPos.current.addScaledVector(knockbackDir, knockbackDistance);
                            }

                            lastTickTime.current = now;

                            // Apply Poison DOT if player has poison upgrades
                            if (abilityStats.dotDamagePerSecond > 0 && abilityStats.dotDuration > 0) {
                                poisonState.current = {
                                    isActive: true,
                                    endTime: now + abilityStats.dotDuration,
                                    damagePerSecond: abilityStats.dotDamagePerSecond * playerDamage * 0.15
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
        // Grant Rewards via Tempo system (handles XP bonus calculation)
        let one = 1
        if (id.includes('wave-')) {
            if (id.includes('wave-enemy-1')) {
                one *= 1.5
            } else if (id.includes('wave-enemy-2')) {
                one *= 2
            } else if (id.includes('wave-enemy-3')) {
                one *= 3
            } else if (id.includes('wave-enemy-4')) {
                one *= 4
            } else if (id.includes('wave-enemy-5')) {
                one *= 5
            }
        }
        const playerStore = usePlayerStore.getState();
        playerStore.registerKill(level, one);
        useAccessoryStore.getState().addEmbouchureXp(20);

        // Drops Logic
        const gameStore = useGameStore.getState();
        const currentLocation = gameStore.currentLocation;
        if (currentLocation === 'backstage_halls') {
            // Backstage Halls: Gold only
            gameStore.collectGold(Math.floor(4 * (1 + level / 200)));
        }

        const drops = getTrumpetDrops(level, currentLocation);

        // Single batched store update for all drops
        if (Object.keys(drops).length > 0) {
            if (drops.echoes) {
                playerStore.collectEchoes(drops.echoes);
                delete drops.echoes;
            }
            if (Object.keys(drops).length > 0) useInventoryStore.getState().addMaterials(drops);
        }

        onDeath?.(id);
    };

    const takeDamage = (amount: number, type: 'normal' | 'crit' | 'superCrit' = 'normal') => {
        const newHealth = Math.max(0, healthRef.current - amount);
        healthRef.current = newHealth;
        setCurrentHealth(newHealth);
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
        return () => clearTimeout(t);
    }, []);

    if (!isAlive || !isReady) return null;

    return (
        <group ref={groupRef} position={initialPosition}>
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

            {/* Click Hitbox (Invisible shell for easy clicking) */}
            <mesh
                onClick={(e) => {
                    e.stopPropagation();

                    // Range Check (Clarinet Range: 30ft)
                    const dist = enemyPos.current.distanceTo(playerPos.current);
                    if (dist > 30) return;

                    // Check LOS before applying click damage
                    const hasLOS = pillars.length === 0 || checkLineOfSight(
                        { x: playerPos.current.x, z: playerPos.current.z },
                        { x: enemyPos.current.x, z: enemyPos.current.z },
                        pillars
                    );

                    if (hasLOS) {
                        // Basic Attack Damage
                        const enchantmentBonus = useAccessoryStore.getState().getEnchantmentBonus();

                        // basicAttackDamage is already half of full damage
                        // Apply trumpet damage multiplier from enchantments (Brass Edge/Metallic Edge)
                        const { damage: dmg, type: dmgType, isCrit, isSuperCrit } = calculateBasicAttackDamage(
                            basicAttackDamage,
                            enchantmentBonus.trumpetDamageMultiplier
                        );

                        if (isCrit) console.log(isSuperCrit ? "SUPER-CRITICAL HIT on Trumpet!" : "CRITICAL HIT on Trumpet!");
                        takeDamage(dmg, dmgType);
                    }
                }}
                visible={false}
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

            {/* Health bar above enemy */}
            {gameState === 'playing' && (
                <group position={[0, BODY_HEIGHT + 0.4, 0]} ref={healthBarRef}>
                    <EnemyHealthBar
                        health={currentHealth}
                        maxHealth={TRUMPET_HEALTH}
                        level={level}
                        visible={currentHealth < TRUMPET_HEALTH || playerDistanceRef.current <= SIGHT_RANGE}
                        enemyType="trumpet"
                        damageTextValue={damageNumberRef.current?.value}
                        damageTextTime={damageNumberRef.current?.time}
                        damageTextType={damageNumberRef.current?.type}
                    />
                </group>
            )}
        </group>
    );
}

export default Trumpet;
