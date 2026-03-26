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
import { getTromboneDrops } from '@/lib/game/enemyDrops';
import { Pillar, checkLineOfSight } from '@/lib/game/pillars';
import { getFloorHeightAt } from '@/lib/game/stairCollision';

/**
 * Trombone Enemy Component
 * 
 * A larger brass enemy with unique attacks:
 * 1. Blasting Glissandos: AOE buff + DoT (5s duration, 20s CD)
 * 2. Trombone Slide Poking: Melee attack (Lvl 25+, 5x dmg, 20s CD)
 * 
 * Dimensions: Longer than trumpet
 * Speed: 2.5 ft/s
 * Health: 1.5x player scaling
 * XP: 1.5x trumpet XP
 */

// Constants
const TROMBONE_SPEED = 2.5; // ft/s
const ATTACK_RANGE_GLISSANDO = 20; // feet (ranged attack)
const ATTACK_RANGE_SLIDE = 4; // feet (melee poke) - reduced from 8
const SIGHT_RANGE = 100; // feet
const GLISSANDO_DURATION = 5; // seconds
const GLISSANDO_COOLDOWN = 20; // seconds
const SLIDE_COOLDOWN = 20; // seconds

// Dimensions in feet
const BODY_LENGTH = 5; // Longer than trumpet (3)
const BODY_HEIGHT = 2;
const BODY_DEPTH = 2;

// Trombone damage scaling factor (base for Glissando)
const GLISSANDO_SCALE_F = 0.08;
const GLISSANDO_SCALE_FF = 0.12;
const GLISSANDO_SCALE_FFF = 0.15;
const SLIDE_SCALE = 1.5;
const BASE_TICK_RATE = 0.5;

function roundToTenths(value: number): number {
    return Math.round(value * 10) / 10;
}

/**
 * Calculate Trombone stats for a given level
 * Uses same base stats as player from getStatsForLevel(), then applies enemy multipliers
 */
function getTromboneStats(level: number): { health: number; damage: number; } {
    const baseStats = getStatsForLevel(level);

    // Health: base stats * 3x enemy multiplier * HP scaling
    const hpMultiplier = getEnemyHpMultiplier(level);
    const health = roundToTenths(baseStats.health * 3 * hpMultiplier);

    // Damage: use base stats damage directly (scaled in attack logic)
    const damage = baseStats.damage;

    return { health, damage };
}

interface TromboneProps {
    id: string;
    initialPosition: [number, number, number];
    level?: number;
    onDeath?: (id: string) => void;
    pillars?: Pillar[];
    arenaRadius?: number;
    arenaCenter?: [number, number, number];
    teleportToCenterOnOOB?: boolean;
    models?: any;
}

const brassColor = '#B8860B';

// Geometries
const slideGeo = new THREE.CylinderGeometry(0.08, 0.08, 3, 8);
const mainBodyGeo = new THREE.CylinderGeometry(0.15, 0.3, 4, 12);
const bellGeo = new THREE.CylinderGeometry(0.6, 0.1, 1, 16);
const hitboxGeo = new THREE.BoxGeometry(1, 2, 6);

// Materials
const slideMat = new THREE.MeshStandardMaterial({
    color: brassColor,
    emissive: brassColor,
    emissiveIntensity: 0.05
});
const slideMatCharging = new THREE.MeshStandardMaterial({
    color: '#ff3333',
    emissive: '#ff0000',
    emissiveIntensity: 0.8
});

const mainBodyMat = new THREE.MeshStandardMaterial({
    color: brassColor,
    emissive: brassColor,
    emissiveIntensity: 0.15
});
const mainBodyMatBuffing = new THREE.MeshStandardMaterial({
    color: brassColor,
    emissive: "gold",
    emissiveIntensity: 0.5
});

const bellMat = new THREE.MeshStandardMaterial({
    color: brassColor,
    emissive: brassColor,
    emissiveIntensity: 0.03
});
const bellMatAttacking = new THREE.MeshStandardMaterial({
    color: brassColor,
    emissive: "red",
    emissiveIntensity: 0.5
});

const hitboxMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0
});

export const TromboneContext = createContext<any>(null);

export function TromboneInstances({ children }: { children: React.ReactNode }) {
    const meshes = useMemo(() => {
        return {
            slide: new THREE.Mesh(slideGeo, slideMat),
            slideCharging: new THREE.Mesh(slideGeo, slideMatCharging),
            mainBody: new THREE.Mesh(mainBodyGeo, mainBodyMat),
            mainBodyBuffing: new THREE.Mesh(mainBodyGeo, mainBodyMatBuffing),
            bell: new THREE.Mesh(bellGeo, bellMat),
            bellAttacking: new THREE.Mesh(bellGeo, bellMatAttacking),
        };
    }, []);

    return (
        <Merged castShadow receiveShadow frustumCulled={false} meshes={meshes}>
            {(instances) => (
                <TromboneContext.Provider value={instances}>
                    {children}
                </TromboneContext.Provider>
            )}
        </Merged>
    );
}

export function Trombone({ id, initialPosition, level = 1, onDeath, pillars = [], arenaRadius = 375, arenaCenter = [0, 0, 0], teleportToCenterOnOOB = false, models: propModels }: TromboneProps) {
    const contextModels = useContext(TromboneContext);
    const models = propModels || contextModels;
    const groupRef = useRef<Group>(null);
    const slideRef = useRef<Group>(null);
    const healthBarRef = useRef<Group>(null);
    const { camera } = useThree();
    const gameState = useGameStore((state) => state.gameState);

    const stats = getTromboneStats(level);
    const MAX_HEALTH = stats.health;
    // We store base damage to apply multipliers dynamically
    const BASE_DAMAGE = stats.damage;

    // Enemy state - use refs to avoid re-renders on damage
    const healthRef = useRef(MAX_HEALTH);
    const [currentHealth, setCurrentHealth] = useState(MAX_HEALTH);
    const [isAlive, setIsAlive] = useState(true);
    const rewardGranted = useRef(false);

    // Poison DOT state
    const poisonState = useRef<{ isActive: boolean; endTime: number; damagePerSecond: number }>({
        isActive: false,
        endTime: 0,
        damagePerSecond: 0
    });

    // Cooldowns
    const lastGlissandoTime = useRef(0);
    const lastSlideTime = useRef(0);
    const glissandoStartTime = useRef(0);

    // Damage logic state - use selective subscriptions to avoid mass re-renders
    const isLongToneActive = usePlayerStore((state) => state.isLongToneActive);
    const basicAttackDamage = usePlayerStore((state) => state.basicAttackDamage);
    const damageNumberRef = useRef<{ value: number, time: number, type?: 'normal' | 'crit' | 'superCrit' } | null>(null);

    // Movement vectors
    const enemyPos = useRef(new Vector3(...initialPosition));
    const playerPos = useRef(new Vector3());
    const direction = useRef(new Vector3());
    const playerDistanceRef = useRef(0); // For health bar visibility
    const frameCounter = useRef(0); // For tiered frame skip
    const accumulatedDelta = useRef(0);

    // Attack states
    const [isGlissandoActive, setIsGlissandoActive] = useState(false);
    const [isSlideAttacking, setIsSlideAttacking] = useState(false);
    const [isSlideCharging, setIsSlideCharging] = useState(false); // 3s warning before poke
    const slideChargeStartTime = useRef(0);
    const SLIDE_CHARGE_DURATION = 3; // 3 seconds of warning

    // Wander state (when not aggroed)
    const wanderDirection = useRef(new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize());
    const lastWanderChange = useRef(0);
    const WANDER_CHANGE_INTERVAL = 3 + Math.random() * 2;

    const playerTakeDamage = usePlayerStore((state) => state.takeDamage);

    // Despawn timer for high-level enemies (> player level + 20)
    if (!id.includes("wave")) {
        useEffect(() => {
            const playerLevel = usePlayerStore.getState().level;
            const levelThreshold = Math.max(playerLevel + 20, playerLevel * 1.65);

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

        const currentTime = state.clock.elapsedTime;
        camera.getWorldPosition(playerPos.current);
        const distanceToPlayer = enemyPos.current.distanceTo(playerPos.current);
        playerDistanceRef.current = distanceToPlayer; // Update for health bar visibility

        // PERF: Hard sleep for very distant enemies — skip entire frame
        if (distanceToPlayer > 400) return;

        const gameStoreState = useGameStore.getState();
        const currentLocation = gameStoreState.currentLocation;

        if (healthBarRef.current) {
            healthBarRef.current.visible = currentHealth < MAX_HEALTH || distanceToPlayer <= SIGHT_RANGE;
        }

        // Removed DOM update


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

        // Direction always updates for facing
        direction.current.copy(playerPos.current).sub(enemyPos.current);
        direction.current.y = 0;
        direction.current.normalize();

        const canSeePlayer = distanceToPlayer <= SIGHT_RANGE;

        // --- ATTACK LOGIC ---

        // 1. Slide Poke (High Priority, Melee, Lvl 25+)
        // Check if currently charging - complete the attack after 3s
        if (isSlideCharging) {
            const chargeTime = currentTime - slideChargeStartTime.current;
            if (chargeTime >= SLIDE_CHARGE_DURATION) {
                // Charge complete - deal damage!
                setIsSlideCharging(false);
                setIsSlideAttacking(true);

                const playerState = usePlayerStore.getState();
                const rawPokeDmg = BASE_DAMAGE * SLIDE_SCALE;
                const maxPokeDmg = playerState.maxHealth * 0.25; // Hard cap at 25% max HP to prevent one-shots
                const pokeDmg = Math.min(rawPokeDmg, maxPokeDmg);

                playerTakeDamage(roundToTenths(pokeDmg));

                // Reset animation after 1s
                setTimeout(() => setIsSlideAttacking(false), 1000);
            }
            return; // Stop movement while charging
        }

        // Start charging if conditions are met
        if (canSeePlayer && level >= 25 && !isSlideAttacking && !isSlideCharging && !isGlissandoActive) {
            if (distanceToPlayer <= ATTACK_RANGE_SLIDE && currentTime - lastSlideTime.current >= SLIDE_COOLDOWN) {
                // Check LOS
                const hasLOS = pillars.length === 0 || checkLineOfSight(
                    { x: enemyPos.current.x, z: enemyPos.current.z },
                    { x: playerPos.current.x, z: playerPos.current.z },
                    pillars
                );

                if (hasLOS) {
                    // Start 3-second charge warning
                    setIsSlideCharging(true);
                    slideChargeStartTime.current = currentTime;
                    lastSlideTime.current = currentTime;
                }
            }
        }

        // 2. Blasting Glissando (Ranged, AOE Buff)
        if (canSeePlayer && !isSlideAttacking && !isGlissandoActive) {
            if (distanceToPlayer <= ATTACK_RANGE_GLISSANDO && currentTime - lastGlissandoTime.current >= GLISSANDO_COOLDOWN) {
                const hasLOS = pillars.length === 0 || checkLineOfSight(
                    { x: enemyPos.current.x, z: enemyPos.current.z },
                    { x: playerPos.current.x, z: playerPos.current.z },
                    pillars
                );

                if (hasLOS) {
                    setIsGlissandoActive(true);
                    glissandoStartTime.current = currentTime;
                    lastGlissandoTime.current = currentTime;
                }
            }
        }

        // Glissando Effect (Active for 5s)
        if (isGlissandoActive) {
            const duration = currentTime - glissandoStartTime.current;
            if (duration > GLISSANDO_DURATION) {
                setIsGlissandoActive(false);
            } else {
                // Apply DOT based on duration (intensity curve)
                // 0-2s: p (0.15x), 2-4s: ff (0.2x), 4-5s: fff (0.3x)
                let multiplier = GLISSANDO_SCALE_F;
                if (duration > 4) multiplier = GLISSANDO_SCALE_FFF;
                else if (duration > 2) multiplier = GLISSANDO_SCALE_FF;

                // Apply damage every frame (scaled by delta)
                const dps = BASE_DAMAGE * multiplier;
                // Only if in range and LOS
                const hasLOS = pillars.length === 0 || checkLineOfSight(
                    { x: enemyPos.current.x, z: enemyPos.current.z },
                    { x: playerPos.current.x, z: playerPos.current.z },
                    pillars
                );

                if (distanceToPlayer <= ATTACK_RANGE_GLISSANDO && hasLOS) {
                    playerTakeDamage(dps * delta); // DoT
                }
            }
        }

        // --- MOVEMENT ---
        // Move if not attacking (Slide Poke freezes movement, Glissando allows slow movement?)
        // Let's say Glissando stops movement to channel.
        if (!isSlideAttacking && !isGlissandoActive) {
            if (canSeePlayer && distanceToPlayer > ATTACK_RANGE_SLIDE) {
                // Move towards player to get into slide range if high level, otherwise keep distance?
                // Simple AI: Move towards player.
                const moveDistance = TROMBONE_SPEED * effectiveDelta;
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
            }
        } else if (!canSeePlayer && !isSlideAttacking && !isGlissandoActive) {
            // Idle wander at 2/3 speed
            if (currentTime - lastWanderChange.current > WANDER_CHANGE_INTERVAL) {
                wanderDirection.current.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                lastWanderChange.current = currentTime;
            }

            const wanderSpeed = (TROMBONE_SPEED * 2 / 3) * effectiveDelta;

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
        }

        // Always sync group position to enemyPos
        groupRef.current.position.copy(enemyPos.current);

        // Rotation - face player if aggroed, else face wander direction
        if (canSeePlayer && direction.current.length() > 0.01) {
            const angle = Math.atan2(direction.current.x, direction.current.z);
            groupRef.current.rotation.y = angle;
        } else if (!canSeePlayer && wanderDirection.current.length() > 0.01) {
            const angle = Math.atan2(wanderDirection.current.x, wanderDirection.current.z);
            groupRef.current.rotation.y = angle;
        }

        // Slide Animation
        if (slideRef.current) {
            if (isSlideCharging) {
                // Charging: gradually extend slide over 3 seconds with pulsing
                const chargeProgress = Math.min(1, (currentTime - slideChargeStartTime.current) / SLIDE_CHARGE_DURATION);
                const pulseEffect = Math.sin(currentTime * 15) * 0.1 * chargeProgress; // Fast pulse
                slideRef.current.position.z = 1 + chargeProgress * 1.5 + pulseEffect; // Extend from 1 to 2.5
            } else if (isSlideAttacking) {
                // Poke out drastically
                slideRef.current.position.z = 2.5; // Extend
            } else if (isGlissandoActive) {
                // Move back and forth
                slideRef.current.position.z = 1 + Math.sin(currentTime * 10) * 0.5;
            } else {
                // Resting
                slideRef.current.position.z = 1;
            }
        }

        // --- INCOMING DAMAGE (Long Tone) ---
        // (Similar to Trumpet)
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
                } else if (now - lastGlissandoTime.current >= 0.5) {
                    // Apply poison DOT damage
                    const dotDamage = poisonState.current.damagePerSecond * 0.5;
                    if (dotDamage > 0) {
                        takeDamage(dotDamage);
                        lastGlissandoTime.current = now;
                    }
                }
            }

            // Handle Long Tone damage
            if (isLongToneActive && now - lastGlissandoTime.current > 0.5) {
                const dist = groupRef.current.position.distanceTo(playerPos.current);

                // Get ability upgrade stats
                const playerState = usePlayerStore.getState();
                const abilityStats = playerState.getAbilityUpgradeStats();
                const baseRange = 20; // Base 20 feet range
                const effectiveRange = baseRange + (abilityStats.rangeBonus || 0);

                if (dist < effectiveRange) {
                    // Formula: (Damage * 0.15 * damageMultiplier * (1 + baseDamageBonus)) - Defense
                    const playerDamage = playerState.damage;
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

                        lastGlissandoTime.current = now;

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
    });

    // Handle death - checked in takeDamage instead of useEffect to avoid useState dependency
    const handleDeath = () => {
        if (rewardGranted.current) return;
        rewardGranted.current = true;
        setIsAlive(false);
        const playerStore = usePlayerStore.getState();
        // Use registerKill for Tempo system (handles XP with bonus)
        let one = 1.5
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
        playerStore.registerKill(level, one); // Trombone gives 1.5x XP
        useAccessoryStore.getState().addEmbouchureXp(35);

        // Drops Logic
        const gameStore = useGameStore.getState();
        const currentLocation = gameStore.currentLocation;
        if (currentLocation === 'backstage_halls') {
            gameStore.collectGold(Math.floor(6 * (1 + level / 150)));
        }

        const drops = getTromboneDrops(level, currentLocation);

        if (Object.keys(drops).length > 0) {
            if (drops.echoes) { playerStore.collectEchoes(drops.echoes); delete drops.echoes; }
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

    // Visuals
    const isBuffing = isGlissandoActive;

    return (
        <group ref={groupRef} position={initialPosition}>
            {/* Slide Part (animated) - glows red when charging */}
            <group ref={slideRef} position={[0, BODY_HEIGHT / 2, 1]}>
                {models ? (
                    isSlideCharging ? (
                        <models.slideCharging rotation={[Math.PI / 2, 0, 0]} />
                    ) : (
                        <models.slide rotation={[Math.PI / 2, 0, 0]} />
                    )
                ) : (
                    <mesh rotation={[Math.PI / 2, 0, 0]} geometry={slideGeo} material={isSlideCharging ? slideMatCharging : slideMat} />
                )}
            </group>

            {/* Main Body */}
            {models ? (
                isBuffing ? (
                    <models.mainBodyBuffing position={[0, BODY_HEIGHT / 2, -0.5]} rotation={[Math.PI / 2, 0, 0]} />
                ) : (
                    <models.mainBody position={[0, BODY_HEIGHT / 2, -0.5]} rotation={[Math.PI / 2, 0, 0]} />
                )
            ) : (
                <mesh position={[0, BODY_HEIGHT / 2, -0.5]} rotation={[Math.PI / 2, 0, 0]} geometry={mainBodyGeo} material={isBuffing ? mainBodyMatBuffing : mainBodyMat} />
            )}

            {/* Bell */}
            {models ? (
                isSlideAttacking ? (
                    <models.bellAttacking position={[0, BODY_HEIGHT / 2, 2]} rotation={[-Math.PI / 2, 0, 0]} />
                ) : (
                    <models.bell position={[0, BODY_HEIGHT / 2, 2]} rotation={[-Math.PI / 2, 0, 0]} />
                )
            ) : (
                <mesh position={[0, BODY_HEIGHT / 2, 2]} rotation={[-Math.PI / 2, 0, 0]} geometry={bellGeo} material={isSlideAttacking ? bellMatAttacking : bellMat} />
            )}

            {/* Hitbox */}
            <mesh
                onClick={(e) => {
                    e.stopPropagation();

                    // Range Check (Clarinet Range: 30ft)
                    const dist = enemyPos.current.distanceTo(playerPos.current);
                    if (dist > 30) return;

                    const hasLOS = pillars.length === 0 || checkLineOfSight(
                        { x: playerPos.current.x, z: playerPos.current.z },
                        { x: enemyPos.current.x, z: enemyPos.current.z },
                        pillars
                    );
                    if (hasLOS) {
                        // NERF: Basic attack deals 50% damage
                        const { damage: dmg, type: dmgType, isCrit, isSuperCrit } = calculateBasicAttackDamage(basicAttackDamage);
                        if (isCrit) console.log(isSuperCrit ? "SUPER-CRITICAL HIT on Trombone!" : "CRITICAL HIT on Trombone!");
                        takeDamage(dmg, dmgType);
                    }
                }}
                visible={false}
                geometry={hitboxGeo}
                material={hitboxMat}
            />

            {/* Health Bar UI */}
            {gameState === 'playing' && (
                <group position={[0, BODY_HEIGHT + 1, 0]} ref={healthBarRef}>
                    <EnemyHealthBar
                        health={currentHealth}
                        maxHealth={MAX_HEALTH}
                        level={level}
                        visible={currentHealth < MAX_HEALTH || playerDistanceRef.current <= SIGHT_RANGE}
                        enemyType="trombone"
                        damageTextValue={damageNumberRef.current?.value}
                        damageTextTime={damageNumberRef.current?.time}
                        damageTextType={damageNumberRef.current?.type}
                    />
                </group>
            )}
        </group>
    );
}

export default Trombone;
