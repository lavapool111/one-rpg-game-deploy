'use client';

import { useRef, useState, useEffect, useMemo, createContext, useContext, memo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import * as THREE from 'three';
import { usePlayerStore, useGameStore, useAccessoryStore } from '@/lib/store';
import { Merged } from '@react-three/drei';
import { EnemyHealthBar } from './EnemyHealthBar';
import { getStatsForLevel, getEnemyHpMultiplier } from '@/lib/game/stats';
import { calculateBasicAttackDamage, calculateAbilityDamage, applyDefenseMultiplier } from '@/lib/enemies/damageUtils';
import { applyEnemyMovement, shouldUpdateEnemyFrame, checkZoneLineOfSight, registerEnemyPosition, unregisterEnemyPosition, applySeparation } from '@/lib/enemies/enemyMovement';
import { getEuphoniumDrops } from '@/lib/enemies/enemyDrops';
import { useEnemyState } from '@/lib/enemies/useEnemyState';
import { roundToTenths, processEnemyDeath, calculateEnemyHealth } from '@/lib/enemies/enemyUtils';
import { hitboxMat, silverMat } from '@/lib/enemies/enemyMaterials';
import { Pillar, checkLineOfSight } from '@/lib/game/pillars';
import { getFloorHeightAt } from '@/lib/game/stairCollision';
import { applyOvertonePushback, applyLongToneDamage, updatePoisonDot, PoisonState } from '@/lib/enemies/abilityUtils';

/**
 * Euphonium Enemy Component
 * 
 * A smaller brass enemy related to the Tuba.
 * 
 * Health: 3.5x level scaling
 * Attack: Resonant Barrage (1.5x dmg, Ranged 45ft, 3s reload)
 * Ability: Overtone Shield (90% Resistance, Buffs Tubas 1.2x dmg)
 * Dimensions: 4x3x2
 * Speed: 2.25 ft/s
 */

// Dimensions
const BODY_WIDTH = 4;
const BODY_HEIGHT = 3;
const BODY_DEPTH = 2;

// Base stats
const BASE_SPEED = 2.25;
const SPEED_PER_LEVEL = 0.005;

// Attack Config
const BARRAGE_COOLDOWN = 3.0; // 3 seconds
const BARRAGE_RANGE = 40; // 40 feet (reduced from 45)
const BARRAGE_DAMAGE_SCALE = 0.3;
const _PROJECTILE_SPEED = 60; // ft/s projectile speed

// Shield Config
const SHIELD_UNLOCK_LEVEL = 25;
const SHIELD_COOLDOWN = 9.0;
const SHIELD_BASE_DURATION = 2.0;
const SHIELD_DURATION_PER_LEVEL = 0.1;
const SHIELD_MAX_DURATION = 4.0;
const SHIELD_RESISTANCE = 0.9; // 90% resistance
const _TUBA_BUFF_MULTIPLIER = 1.2;

const SIGHT_RANGE_ARENA = 140;
const SIGHT_RANGE_DUNGEON = 60;



/**
 * Calculate Euphonium stats for a given level
 */
function getEuphoniumStats(level: number) {
    const health = calculateEnemyHealth(level, 3.5); // 3.5x level scaling

    // Speed: 2.25 base + 0.005 per level
    const speed = BASE_SPEED + (level - 1) * SPEED_PER_LEVEL;

    // Range: Fixed at 40ft for all levels (shorter than before)
    const range = BARRAGE_RANGE;

    // Shield Duration
    let shieldDuration = 0;
    if (level >= SHIELD_UNLOCK_LEVEL) {
        shieldDuration = Math.min(SHIELD_MAX_DURATION, SHIELD_BASE_DURATION + (level - SHIELD_UNLOCK_LEVEL) * SHIELD_DURATION_PER_LEVEL);
    }

    return { health, speed, range, shieldDuration };
}

interface EuphoniumProps {
    id: string;
    initialPosition: [number, number, number];
    level?: number;
    onDeath?: (id: string) => void;
    pillars?: Pillar[];
    arenaRadius?: number;
    arenaCenter?: [number, number, number];
    /** Maximum distance this Euphonium can move from spawn point (for confined enemies) */
    maxRangeFromSpawn?: number;
    teleportToCenterOnOOB?: boolean;
    models?: any;
}

// Colors
const brassColor = '#CD7F32'; // Classic Brass
const shieldColor = '#4169E1'; // Royal Blue for shield effect

// Geometries (Scaled down Tuba)
const bodyGeo = new THREE.CylinderGeometry(0.5, 0.4, 3, 16);
const uBendGeo = new THREE.TorusGeometry(0.5, 0.4, 16, 32, Math.PI);
const secondTubeGeo = new THREE.CylinderGeometry(0.4, 0.4, 3.5, 16);
const bellGeo = new THREE.CylinderGeometry(1.4, 0.4, 1.4, 32, 1, true);
const mouthpieceGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.5, 8);
const valveGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.0, 8);
const coilGeo = new THREE.TorusGeometry(1.1, 0.2, 16, 48);
const hitboxGeo = new THREE.BoxGeometry(BODY_WIDTH, BODY_HEIGHT * 2, BODY_DEPTH); // Taller lightbox

// Materials
const brassMat = new THREE.MeshStandardMaterial({
    color: brassColor,
    roughness: 0.25,
    metalness: 0.85,
    emissive: '#8B5A2B',
    emissiveIntensity: 0.08
});
const bellMat = new THREE.MeshStandardMaterial({
    color: '#D4A043', // Polished Brass
    side: 2,
    metalness: 0.9,
    roughness: 0.15,
    emissive: '#8B6914',
    emissiveIntensity: 0.08
});
const shieldMat = new THREE.MeshStandardMaterial({
    color: shieldColor,
    transparent: true,
    opacity: 0.4,
    emissive: shieldColor,
    emissiveIntensity: 0.5,
    side: THREE.DoubleSide
});


export const EuphoniumContext = createContext<any>(null);

export function EuphoniumInstances({ children }: { children: React.ReactNode }) {
    const meshes = useMemo(() => {
        return {
            body: new THREE.Mesh(bodyGeo, brassMat),
            uBend: new THREE.Mesh(uBendGeo, brassMat),
            secondTube: new THREE.Mesh(secondTubeGeo, brassMat),
            bell: new THREE.Mesh(bellGeo, bellMat),
            mouthpiece: new THREE.Mesh(mouthpieceGeo, silverMat),
            valve: new THREE.Mesh(valveGeo, silverMat),
            coil: new THREE.Mesh(coilGeo, brassMat),
        };
    }, []);

    return (
        <Merged castShadow receiveShadow frustumCulled={false} meshes={meshes}>
            {(instances) => (
                <EuphoniumContext.Provider value={instances}>
                    {children}
                </EuphoniumContext.Provider>
            )}
        </Merged>
    );
}

export const Euphonium = memo(({ id, initialPosition, level = 1, onDeath, pillars = [], arenaRadius = 375, arenaCenter = [0, 0, 0], maxRangeFromSpawn, teleportToCenterOnOOB = false, models: propModels }: EuphoniumProps) => {
    const contextModels = useContext(EuphoniumContext);
    const models = propModels || contextModels;
    const groupRef = useRef<Group>(null);
    const shieldRef = useRef<THREE.Mesh>(null);
    const projectileRef = useRef<THREE.Mesh>(null);
    const { camera } = useThree();
    // gameState provided by useEnemyState
    const currentLocation = useGameStore((state) => state.currentLocation);
    const addEuphoniumShield = useGameStore((state) => state.addEuphoniumShield);
    const removeEuphoniumShield = useGameStore((state) => state.removeEuphoniumShield);

    const stats = getEuphoniumStats(level);
    const MAX_HEALTH = stats.health;
    const MOVE_SPEED = stats.speed;
    const ATTACK_RANGE_CALC = stats.range;

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

    const [isReady, setIsReady] = useState(false);

    // Euphonium-specific Combat State
    const [isShieldActive, setIsShieldActive] = useState(false);
    const lastShieldTime = useRef(0);
    const shieldEndTime = useRef(0);

    // Euphonium-specific vectors
    const worldSpawnPos = useRef(new Vector3(...initialPosition));
    const tempVec3 = useRef(new Vector3());
    const bellOffsetVec = useRef(new Vector3());
    const windupMeshRef = useRef<THREE.Mesh>(null);
    const WANDER_CHANGE_INTERVAL = 3 + Math.random() * 2;
    const BASE_TICK_RATE = 0.5;

    // Attack windup tracking
    const ATTACK_WINDUP_DURATION = 1.8; // 1.8 seconds of warning before attack (increased from 1.2)
    const [isWindingUp, setIsWindingUp] = useState(false);
    const windupStartTime = useRef(0);

    // Projectile state
    const [projectile, setProjectile] = useState<{ start: Vector3; end: Vector3; startTime: number } | null>(null);
    const PROJECTILE_DURATION = 0.3; // seconds to fly to target

    // Init
    useEffect(() => {
        // console.log(`[Euphonium] Mounted at ${initialPosition.join(', ')} with Level ${level}`);
        // For Euphoniums, initialPosition is already in world space since they are spawned directly
        // Make sure groupRef has the initial position set immediately
        if (groupRef.current) {
            groupRef.current.position.set(...initialPosition);
        }
        const t = setTimeout(() => {
            setIsReady(true);
        }, 50);
        return () => {
            clearTimeout(t);
            unregisterEnemyPosition(id);
        };
    }, [id, initialPosition, level]);

    // Clean up shield on unmount/death
    useEffect(() => {
        return () => {
            if (isShieldActive) {
                removeEuphoniumShield();
            }
        };
    }, [isShieldActive, removeEuphoniumShield]);

    // Despawn timer for high-level enemies (> player level + 20)
    if (!id.includes("wave")) {
        useEffect(() => {
            const playerLevel = usePlayerStore.getState().level;
            const levelThreshold = Math.max(playerLevel + 20, playerLevel * 1.85);

            // Only set despawn timer if enemy level exceeds player level + 20
            if (level > levelThreshold) {
                // console.log(`High-level enemy spawned (LV ${level} vs player ${playerLevel}). Despawning in 30s if not killed...`);
                const despawnTimer = setTimeout(() => {
                    if (isAlive && !rewardGranted.current) {
                        rewardGranted.current = true;
                        // console.log(`High-level enemy (LV ${level}) despawning after 30 seconds`);
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
        const cappedDelta = Math.min(delta, 0.1);
        if (!groupRef.current || !isAlive || !isReady || !simulationActive) return;

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
        playerDistanceRef.current = distanceToPlayer;

        // PERF: Hard sleep for very distant enemies — skip entire frame
        if (distanceToPlayer > 400) return;

        // Frame Skip based on distance
        frameCounter.current++;
        accumulatedDelta.current += cappedDelta;

        if (!shouldUpdateEnemyFrame(distanceToPlayer, frameCounter.current)) {
            // Always sync position for rendering, but skip expensive calculations
            groupRef.current.position.copy(enemyPos.current);
            return;
        }

        const effectiveDelta = accumulatedDelta.current;
        accumulatedDelta.current = 0;

        // Check Zone LOS to prevent aggro through walls
        const hasZoneLOS = checkZoneLineOfSight(enemyPos.current, playerPos.current);

        const effectiveSightRange = currentLocation === 'backstage_halls' ? SIGHT_RANGE_DUNGEON : SIGHT_RANGE_ARENA;
        const canSeePlayer = distanceToPlayer <= effectiveSightRange && (currentLocation !== 'backstage_halls' || hasZoneLOS);

        // Removed DOM update


        direction.current.copy(playerPos.current).sub(enemyPos.current);
        direction.current.y = 0;
        direction.current.normalize();

        // --- SHIELD LOGIC ---
        if (level >= SHIELD_UNLOCK_LEVEL) {
            // Activate Shield if not active, cooldown ready, and in combat (can see player)
            if (!isShieldActive && canSeePlayer && currentTime - lastShieldTime.current >= SHIELD_COOLDOWN) {
                // Activate
                setIsShieldActive(true);
                addEuphoniumShield();
                lastShieldTime.current = currentTime;
                shieldEndTime.current = currentTime + stats.shieldDuration;
            }

            // Deactivate Shield
            if (isShieldActive && currentTime >= shieldEndTime.current) {
                setIsShieldActive(false);
                removeEuphoniumShield();
            }
        }

        // --- ATTACK LOGIC ---
        // Windup phase - show visual cue BEFORE damage
        if (canSeePlayer && distanceToPlayer <= ATTACK_RANGE_CALC && !isWindingUp && !isAttacking && currentTime - lastAttackTime.current >= BARRAGE_COOLDOWN) {
            const hasLOS = pillars.length === 0 || checkLineOfSight(
                { x: enemyPos.current.x, z: enemyPos.current.z },
                { x: playerPos.current.x, z: playerPos.current.z },
                pillars
            );

            if (hasLOS) {
                // Start windup phase - visual warning
                setIsWindingUp(true);
                windupStartTime.current = currentTime;
            }
        }

        // Complete the attack after windup
        if (isWindingUp && currentTime - windupStartTime.current >= ATTACK_WINDUP_DURATION) {
            setIsWindingUp(false);
            setIsAttacking(true);
            lastAttackTime.current = currentTime;

            // Launch projectile from bell (at position [1.0, 4.0, 0] relative to enemy) to player
            bellOffsetVec.current.set(1.0, 4.0, 0);
            bellOffsetVec.current.applyEuler(groupRef.current.rotation);
            const startPos = enemyPos.current.clone().add(bellOffsetVec.current);
            setProjectile({
                start: startPos,
                end: playerPos.current.clone(),
                startTime: currentTime
            });

            // Damage Calculation
            const basePlayerDmg = getStatsForLevel(level).damage;
            const rawDamage = basePlayerDmg * BARRAGE_DAMAGE_SCALE;
            const playerState = usePlayerStore.getState();
            const maxBarrageDmg = playerState.maxHealth * 0.125; // Hard cap at 12.5% max HP per attack
            const damage = roundToTenths(Math.min(rawDamage, maxBarrageDmg));
            playerTakeDamage(damage, 'euphonium');

            setTimeout(() => setIsAttacking(false), 500);
        }

        // Cancel windup if player moves out of range or LOS
        if (isWindingUp) {
            const stillInRange = distanceToPlayer <= ATTACK_RANGE_CALC;
            const stillHasLOS = pillars.length === 0 || checkLineOfSight(
                { x: enemyPos.current.x, z: enemyPos.current.z },
                { x: playerPos.current.x, z: playerPos.current.z },
                pillars
            );
            if (!stillInRange || !stillHasLOS) {
                setIsWindingUp(false);
            }
        }

        // --- MOVEMENT ---
        const START_STOP_RANGE = ATTACK_RANGE_CALC * 0.3;
        let moveDistance = 0;
        let moveDir = direction.current; // Handled by reference since they don't mutate below

        if (canSeePlayer && !isAttacking) {
            if (distanceToPlayer > START_STOP_RANGE) {
                moveDistance = MOVE_SPEED * effectiveDelta;
            }
            // Rotation - Face player
            const angle = Math.atan2(direction.current.x, direction.current.z);
            groupRef.current.rotation.y = angle;
        } else if (!canSeePlayer && !isAttacking) {
            // Idle Wander
            if (currentTime - lastWanderChange.current > WANDER_CHANGE_INTERVAL) {
                wanderDirection.current.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                lastWanderChange.current = currentTime;
            }
            moveDistance = (MOVE_SPEED * 0.6) * effectiveDelta;
            moveDir = wanderDirection.current;

            // Wander Rotation
            if (wanderDirection.current.length() > 0.01) {
                const angle = Math.atan2(wanderDirection.current.x, wanderDirection.current.z);
                groupRef.current.rotation.y = angle;
            }
        }

        // Apply Unified Movement and Gravity
        const { didCollide } = applyEnemyMovement({
            currentPos: enemyPos.current,
            moveDirection: moveDir,
            moveDistance,
            currentLocation,
            bodyHeight: BODY_HEIGHT,
            bodyRadius: 1.5, // Derived from old collision (pillar.radius * 1.5 + 1.5)
            pillars,
            arenaCenter: arenaCenter || [0, 0, 0] as unknown as [number, number, number],
            arenaRadius: arenaRadius || 375,
            teleportToCenterOnOOB
        });

        if (didCollide && !canSeePlayer && !isAttacking) {
            wanderDirection.current.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        }

        // Spawn point leash (for confined enemies like guardians)
        if (maxRangeFromSpawn !== undefined) {
            const dxSpawn = enemyPos.current.x - worldSpawnPos.current.x;
            const dzSpawn = enemyPos.current.z - worldSpawnPos.current.z;
            const distFromSpawn = Math.sqrt(dxSpawn * dxSpawn + dzSpawn * dzSpawn);

            // Constrain Y to spawn height for completely fixed enemies
            if (maxRangeFromSpawn < 10) {
                enemyPos.current.y = worldSpawnPos.current.y;
            }

            if (distFromSpawn > maxRangeFromSpawn) {
                // Instantly teleport back to spawn point
                enemyPos.current.x = worldSpawnPos.current.x;
                enemyPos.current.y = worldSpawnPos.current.y;
                enemyPos.current.z = worldSpawnPos.current.z;

                // If wandering, pick a new direction
                if (!canSeePlayer && !isAttacking) {
                    wanderDirection.current.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                    lastWanderChange.current = currentTime;
                }
            }
        }

        applySeparation(id, enemyPos.current, 'euphonium');
        registerEnemyPosition(id, enemyPos.current.x, enemyPos.current.z, 'euphonium', takeDamage);
        groupRef.current.position.copy(enemyPos.current);

        // Windup pulse via scale (avoids geometry recreation)
        if (windupMeshRef.current) {
            if (isWindingUp) {
                const pulse = 1.0 + Math.sin(currentTime * 12) * 0.4;
                windupMeshRef.current.scale.setScalar(pulse);
            } else {
                windupMeshRef.current.scale.setScalar(1.0);
            }
        }

        // Projectile animation
        if (projectile && currentTime - projectile.startTime < PROJECTILE_DURATION) {
            const progress = (currentTime - projectile.startTime) / PROJECTILE_DURATION;
            tempVec3.current.lerpVectors(projectile.start, projectile.end, progress);
            if (projectileRef.current) {
                projectileRef.current.position.copy(tempVec3.current);
                projectileRef.current.visible = true;
                // Scale projectile down as it travels
                const scale = 1 - (progress * 0.5);
                projectileRef.current.scale.setScalar(scale);
            }
        } else if (projectile && currentTime - projectile.startTime >= PROJECTILE_DURATION) {
            setProjectile(null);
            if (projectileRef.current) {
                projectileRef.current.visible = false;
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
    });

    const takeDamage = (amount: number, type: 'normal' | 'crit' | 'superCrit' = 'normal') => {
        // Apply Shield Resistance
        const effectiveResistance = isShieldActive ? SHIELD_RESISTANCE : 0;
        const finalDamage = applyDefenseMultiplier(amount, effectiveResistance);

        const newHealth = Math.max(0, healthRef.current - finalDamage);
        healthRef.current = newHealth;
        damageNumberRef.current = { value: Number(finalDamage.toFixed(2)), time: Date.now(), type };

        // Check for death
        if (newHealth <= 0 && isAlive) {
            handleDeath();
        }
    };

    // Handle Death - checked in takeDamage instead of useEffect
    const handleDeath = () => {
        if (rewardGranted.current) return;
        rewardGranted.current = true;
        setIsAlive(false);
        if (isShieldActive) removeEuphoniumShield();
        processEnemyDeath({
            id,
            level,
            baseXpMultiplier: 3,
            embouchureXp: 0,
            goldFormula: (lvl) => Math.floor(8 * (1 + lvl / 100)),
            getDrops: getEuphoniumDrops,
            onDeath,
        });
    };

    if (!isReady) return null;

    return (
        <group ref={groupRef} position={initialPosition}>
            {isAlive && isReady && (
                <group>
                    <group position={[0, 0, 0]}>
                        {/* Body Construction - Scaled down Tuba */}
                        {models ? <models.body position={[0, 1.5, 0]} /> : <mesh position={[0, 1.5, 0]} geometry={bodyGeo} material={brassMat} />}
                        {models ? <models.uBend position={[0.5, 0.4, 0]} rotation={[0, 0, Math.PI / 2]} /> : <mesh position={[0.5, 0.4, 0]} rotation={[0, 0, Math.PI / 2]} geometry={uBendGeo} material={brassMat} />}
                        {models ? <models.secondTube position={[1.0, 1.8, 0]} /> : <mesh position={[1.0, 1.8, 0]} geometry={secondTubeGeo} material={brassMat} />}
                        {models ? <models.bell position={[1.0, 4.0, 0]} /> : <mesh position={[1.0, 4.0, 0]} geometry={bellGeo} material={bellMat} />}
                        {models ? <models.mouthpiece position={[-0.6, 2.2, 0]} rotation={[0, 0, Math.PI / 4]} /> : <mesh position={[-0.6, 2.2, 0]} rotation={[0, 0, Math.PI / 4]} geometry={mouthpieceGeo} material={silverMat} />}

                        {/* Valves */}
                        <group position={[0.3, 1.5, 0.6]}>
                            {models ? <models.valve position={[-0.2, 0, 0]} /> : <mesh position={[-0.2, 0, 0]} geometry={valveGeo} material={silverMat} />}
                            {models ? <models.valve position={[0, 0, 0]} /> : <mesh position={[0, 0, 0]} geometry={valveGeo} material={silverMat} />}
                            {models ? <models.valve position={[0.2, 0, 0]} /> : <mesh position={[0.2, 0, 0]} geometry={valveGeo} material={silverMat} />}
                            {models ? <models.valve position={[0.4, 0, 0]} /> : <mesh position={[0.4, 0, 0]} geometry={valveGeo} material={silverMat} />}
                        </group>

                        {/* Attack Windup Visual - Pulsing Warning (scale-based, no geometry recreation) */}
                        <group position={[1.0, 4.0, 0]} visible={isWindingUp || isAttacking}>
                            <mesh ref={windupMeshRef}>
                                <sphereGeometry args={[0.5, 16, 16]} />
                                <meshStandardMaterial
                                    color={isWindingUp ? "#FFA500" : "#FF4500"}
                                    emissive={isWindingUp ? "#FFA500" : "#FF4500"}
                                    emissiveIntensity={isWindingUp ? 3 : 2}
                                    transparent
                                    opacity={isWindingUp ? 0.9 : 0.6}
                                />
                            </mesh>
                            {/* Outer ring that expands during windup */}
                            {isWindingUp && (
                                <mesh>
                                    <ringGeometry args={[0.8, 1.0, 32]} />
                                    <meshBasicMaterial
                                        color="#FF6B35"
                                        transparent
                                        opacity={0.6}
                                        side={THREE.DoubleSide}
                                    />
                                </mesh>
                            )}
                        </group>

                        {/* Flying Projectile */}
                        <mesh ref={projectileRef} visible={false}>
                            <sphereGeometry args={[0.3, 8, 8]} />
                            <meshStandardMaterial
                                color="#FF4500"
                                emissive="#FF4500"
                                emissiveIntensity={3}
                                transparent
                                opacity={0.9}
                            />
                        </mesh>
                        <mesh ref={shieldRef} visible={false} position={[0, 2, 0]} scale={[2.5, 2.5, 2.5]}>
                            <sphereGeometry args={[1, 32, 32]} />
                            <primitive object={shieldMat} attach="material" />
                        </mesh>
                    </group>

                    {/* Click Hitbox */}
                    <mesh
                        ref={(m) => {
                            if (m) {
                                m.userData.onHit = (dmg: number, type: any) => takeDamage(dmg, type);
                                m.userData.type = 'enemy';
                                m.userData.enemyType = 'euphonium';
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
                enemyType="euphonium"
                damageTextRef={damageNumberRef}
                enemyPosRef={enemyPos}
                yOffset={6}
                visible={gameState === 'playing' && isAlive && isReady}
            />
        </group>
    );
});

export default Euphonium;
