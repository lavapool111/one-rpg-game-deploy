'use client';

import { useRef, useState, useEffect, useMemo, createContext, useContext, memo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group } from 'three';
import * as THREE from 'three';
import { usePlayerStore, useGameStore } from '@/lib/store';
import { Merged } from '@react-three/drei';
import { EnemyHealthBar } from './EnemyHealthBar';
import { getStatsForLevel, getEnemyHpMultiplier, getEnemyDefense } from '@/lib/game/stats';
import { calculateBasicAttackDamage, calculateAbilityDamage, applyDefenseMultiplier, applyFlatDefense } from '@/lib/enemies/damageUtils';
import { applyEnemyMovement, shouldUpdateEnemyFrame, checkZoneLineOfSight, registerEnemyPosition, unregisterEnemyPosition, applySeparation, RectangleBoundary } from '@/lib/enemies/enemyMovement';
import { getTromboneDrops } from '@/lib/enemies/enemyDrops';
import { useEnemyState } from '@/lib/enemies/useEnemyState';
import { roundToTenths, processEnemyDeath, calculateEnemyHealth } from '@/lib/enemies/enemyUtils';
import { hitboxMat } from '@/lib/enemies/enemyMaterials';
import { Pillar, checkLineOfSight } from '@/lib/game/pillars';
import { applyOvertonePushback, applyLongToneDamage, updatePoisonDot } from '@/lib/enemies/abilityUtils';

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



/**
 * Calculate Trombone stats for a given level
 * Uses same base stats as player from getStatsForLevel(), then applies enemy multipliers
 */
function getTromboneStats(level: number): { health: number; damage: number; } {
    const health = calculateEnemyHealth(level, 3); // 3x base health

    // Damage: use base stats damage directly (scaled in attack logic)
    const baseStats = getStatsForLevel(level);
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
    /** Rectangular boundary for corridors */
    rectangleBoundary?: RectangleBoundary;
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

export const Trombone = memo(function Trombone({ id, initialPosition, level = 1, onDeath, pillars = [], arenaRadius = 375, arenaCenter = [0, 0, 0], rectangleBoundary, teleportToCenterOnOOB = false, models: propModels }: TromboneProps) {
    const contextModels = useContext(TromboneContext);
    const models = propModels || contextModels;
    const groupRef = useRef<Group>(null);
    const slideRef = useRef<Group>(null);
    const { camera } = useThree();
    // gameState is now provided by useEnemyState

    const stats = getTromboneStats(level);
    const MAX_HEALTH = stats.health;
    // We store base damage to apply multipliers dynamically
    const BASE_DAMAGE = stats.damage;

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
    } = useEnemyState(initialPosition, MAX_HEALTH);

    // Trombone-specific Cooldowns
    const lastGlissandoTime = useRef(0);
    const lastSlideTime = useRef(0);
    const glissandoStartTime = useRef(0);

    // Trombone-specific Attack states
    const [isGlissandoActive, setIsGlissandoActive] = useState(false);
    const [isSlideAttacking, setIsSlideAttacking] = useState(false);
    const [isSlideCharging, setIsSlideCharging] = useState(false); // 3s warning before poke
    const slideChargeStartTime = useRef(0);
    const SLIDE_CHARGE_DURATION = 3; // 3 seconds of warning
    const WANDER_CHANGE_INTERVAL = 3 + Math.random() * 2;

    // Despawn timer for high-level enemies (> player level + 20)
    if (!id.includes("wave")) {
        useEffect(() => {
            const playerLevel = usePlayerStore.getState().level;
            const levelThreshold = Math.max(playerLevel + 20, playerLevel * 2.15);

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

        if (!groupRef.current || !isAlive || !simulationActive) return;

        // Kill floor check: if enemy fell to a catch floor (Y=-1000), instantly kill
        if (enemyPos.current.y < -500) {
            if (rewardGranted.current) return;
            rewardGranted.current = true;
            setIsAlive(false);
            onDeath?.(id);
            return;
        }

        // --- Overtone Shield Pushback Logic ---
        if (applyOvertonePushback(enemyPos.current, groupRef.current, BODY_HEIGHT, cappedDelta)) {
            playerPos.current.fromArray(usePlayerStore.getState().position);
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
                    rectangleBoundary,
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
                rectangleBoundary,
                teleportToCenterOnOOB
            });

            if (didCollide) {
                wanderDirection.current.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
            }
        }

        // Always sync group position to enemyPos
        applySeparation(id, enemyPos.current, 'trombone');
        registerEnemyPosition(id, enemyPos.current.x, enemyPos.current.z, 'trombone', takeDamage);
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
            direction.current,
            'trombone',
            id
        );
    });

    // Handle death - checked in takeDamage instead of useEffect to avoid useState dependency
    const handleDeath = () => {
        if (rewardGranted.current) return;
        rewardGranted.current = true;
        setIsAlive(false);
        processEnemyDeath({
            id,
            level,
            baseXpMultiplier: 1.5,
            embouchureXp: 35,
            goldFormula: (lvl) => Math.floor(6 * (1 + lvl / 150)),
            getDrops: getTromboneDrops,
            onDeath,
        });
    };

    const takeDamage = (amount: number, type: 'normal' | 'crit' | 'superCrit' = 'normal') => {
        // Calculate and apply piecewise flat defense
        const defensePoints = getEnemyDefense(level);
        const reducedAmount = applyFlatDefense(amount, defensePoints, 0);

        const newHealth = Math.max(0, healthRef.current - reducedAmount);
        healthRef.current = newHealth;
        damageNumberRef.current = { value: Number(reducedAmount.toFixed(2)), time: Date.now(), type };

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

    // Visuals
    const isBuffing = isGlissandoActive;

    if (!isReady) return null;

    return (
        <group ref={groupRef} position={initialPosition}>
            {isAlive && isReady && (
                <group>
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
                        ref={(m) => {
                            if (m) {
                                m.userData.onHit = (dmg: number, type: any) => takeDamage(dmg, type);
                                m.userData.type = 'enemy';
                                m.userData.enemyType = 'trombone';
                                m.userData.id = id;
                            }
                        }}
                        visible={true}
                        geometry={hitboxGeo}
                        material={hitboxMat}
                    />
                </group>
            )}

            {/* Health Bar UI */}
            <EnemyHealthBar
                healthRef={healthRef}
                maxHealth={MAX_HEALTH}
                level={level}
                playerDistanceRef={playerDistanceRef}
                enemyType="trombone"
                damageTextRef={damageNumberRef}
                enemyPosRef={enemyPos}
                yOffset={3}
                visible={gameState === 'playing' && isAlive && isReady}
            />
        </group>
    );
});

export default Trombone;
