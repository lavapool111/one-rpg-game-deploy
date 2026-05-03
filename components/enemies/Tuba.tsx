'use client';

import { useRef, useState, useEffect, useMemo, createContext, useContext, memo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import * as THREE from 'three';
import { usePlayerStore, useGameStore, useAccessoryStore } from '@/lib/store';
import { Merged } from '@react-three/drei';
import { getStatsForLevel } from '@/lib/game/stats';
import { Pillar, checkLineOfSight, getNearbyPillars } from '@/lib/game/pillars';
import { isValidDungeonPosition } from '@/lib/game/collision';
import { getFloorHeightAt } from '@/lib/game/stairCollision';
import { applyOvertonePushback, applyLongToneDamage, updatePoisonDot, PoisonState } from '@/lib/enemies/abilityUtils';
import { getLigatureStats } from '@/lib/game/inventory';
import { getSlotMultiplier } from '@/lib/store/playerStore';
import { EnemyHealthBar } from './EnemyHealthBar';
import { applyEnemyMovement, shouldUpdateEnemyFrame, checkZoneLineOfSight, registerEnemyPosition, unregisterEnemyPosition, applySeparation, RectangleBoundary } from '@/lib/enemies/enemyMovement';
import { getTubaDrops } from '@/lib/enemies/enemyDrops';
import { useEnemyState } from '@/lib/enemies/useEnemyState';
import { processEnemyDeath, calculateEnemyHealth, roundToTenths } from '@/lib/enemies/enemyUtils';
import { getEnemyDefense } from '@/lib/game/stats';
import { applyFlatDefense } from '@/lib/enemies/damageUtils';
import { hitboxMat, silverMat } from '@/lib/enemies/enemyMaterials';

// Global counter to limit concurrent tuba initializations
let tubaInitCounter = 0;
const MAX_CONCURRENT_TUBA_INITS_DUNGEON = 30;
const MAX_CONCURRENT_TUBA_INITS_DEFAULT = 3;

/**
 * Tuba Enemy Component
 * 
 * A massive brass enemy.
 * 
 * Health: 35x level scaling
 * Attack: Body Slam (8x dmg) -> Body Crash (24x dmg + Slow) at Lvl 100+
 * Dimensions: 6x4x3
 * Speed: 1.5 ft/s + 0.005/lvl
 */

// Dimensions
const BODY_WIDTH = 6;
const BODY_HEIGHT = 4;
const BODY_DEPTH = 3;

// Base stats
const BASE_SPEED = 1.5;
const SPEED_PER_LEVEL = 0.001;

// Attack Config
const SLAM_COOLDOWN = 10.5;
const SLAM_RANGE = 10; // User requested 10ft
const SLAM_DAMAGE_SCALE = 6.0;
const CRASH_DAMAGE_SCALE = 15.0;
const SIGHT_RANGE_ARENA = 140;
const SIGHT_RANGE_DUNGEON = 40; // Reduced for dungeon to prevent wall-hacks



/**
 * Calculate Tuba stats for a given level
 * Uses same base stats as player from getStatsForLevel(), then applies enemy multipliers
 */
function getTubaStats(level: number) {
    const health = calculateEnemyHealth(level, 15); // 15x base health
    const speed = BASE_SPEED + (level - 1) * SPEED_PER_LEVEL;

    return { health, speed };
}

interface TubaProps {
    id: string;
    initialPosition: [number, number, number];
    level?: number;
    onDeath?: (id: string) => void;
    pillars?: Pillar[];
    localPillars?: Pillar[]; // Pillars relative to the Tuba's parent (e.g., cell walls)
    arenaRadius?: number;
    arenaCenter?: [number, number, number];
    /** Rectangular boundary for corridors */
    rectangleBoundary?: RectangleBoundary;
    /** Maximum distance this Tuba can move from spawn point (for confined enemies) */
    maxRangeFromSpawn?: number;
    teleportToCenterOnOOB?: boolean;
    models?: any;
}

// Geometries
const bodyGeo = new THREE.CylinderGeometry(0.8, 0.6, 4, 16);
const uBendGeo = new THREE.TorusGeometry(0.7, 0.6, 16, 32, Math.PI);
const secondTubeGeo = new THREE.CylinderGeometry(0.6, 0.6, 5, 16);
const bellGeo = new THREE.CylinderGeometry(2, 0.6, 2, 32, 1, true);
const mouthpieceGeo = new THREE.CylinderGeometry(0.1, 0.1, 2, 8);
const valveGeo = new THREE.CylinderGeometry(0.15, 0.15, 1.5, 8);
const coilGeo = new THREE.TorusGeometry(1.6, 0.3, 16, 48);
const hitboxGeo = new THREE.BoxGeometry(BODY_WIDTH, BODY_HEIGHT * 2, BODY_DEPTH);

const brassColor = '#8B4513';
const brassMat = new THREE.MeshStandardMaterial({
    color: brassColor,
    roughness: 0.3,
    metalness: 0.6,
    emissive: brassColor,
    emissiveIntensity: 0.05
});

const uBendMat = new THREE.MeshStandardMaterial({
    color: brassColor,
    roughness: 0.3,
    metalness: 0.6
});

const secondTubeMat = new THREE.MeshStandardMaterial({
    color: brassColor,
    roughness: 0.3,
    metalness: 0.6
});

const bellMat = new THREE.MeshStandardMaterial({
    color: '#DAA520',
    side: 2,
    metalness: 0.7,
    roughness: 0.2,
    emissive: '#DAA520',
    emissiveIntensity: 0.05
});



export const TubaContext = createContext<any>(null);

export function TubaInstances({ children }: { children: React.ReactNode }) {
    const meshes = useMemo(() => {
        return {
            body: new THREE.Mesh(bodyGeo, brassMat),
            uBend: new THREE.Mesh(uBendGeo, uBendMat),
            secondTube: new THREE.Mesh(secondTubeGeo, secondTubeMat),
            bell: new THREE.Mesh(bellGeo, bellMat),
            mouthpiece: new THREE.Mesh(mouthpieceGeo, silverMat),
            valve: new THREE.Mesh(valveGeo, silverMat),
            coil: new THREE.Mesh(coilGeo, brassMat),
        };
    }, []);

    return (
        <Merged castShadow receiveShadow frustumCulled={false} meshes={meshes}>
            {(instances) => (
                <TubaContext.Provider value={instances}>
                    {children}
                </TubaContext.Provider>
            )}
        </Merged>
    );
}

export const Tuba = memo(function Tuba({ id, initialPosition, level = 1, onDeath, pillars = [], localPillars = [], arenaRadius = 375, arenaCenter = [0, 0, 0], rectangleBoundary, maxRangeFromSpawn, teleportToCenterOnOOB = false, models: propModels }: TubaProps) {
    const contextModels = useContext(TubaContext);
    const models = propModels || contextModels;
    const hitboxRef = useRef<THREE.Mesh>(null);

    const groupRef = useRef<Group>(null);
    const { camera } = useThree();
    const currentLocation = useGameStore((state) => state.currentLocation);

    const stats = getTubaStats(level);
    const MAX_HEALTH = stats.health;
    const MOVE_SPEED = stats.speed;

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

    const [initialHealth] = useState(MAX_HEALTH);
    const [isReady, setIsReady] = useState(false);

    const playerApplySlow = usePlayerStore((state) => state.applySlow);

    // Tuba-specific vectors and flags
    const worldSpawnPos = useRef(new Vector3(...initialPosition)); // Actual world spawn position
    const worldPosReady = useRef(false); // Track if world position was successfully captured
    const fallbackAttempted = useRef(false); // Prevent repeated fallback attempts
    const WANDER_CHANGE_INTERVAL = 4 + Math.random() * 3; // Tubas wander slower

    // DOM refs for direct health bar manipulation (avoids React re-renders)
    const healthBarFillRef = useRef<HTMLDivElement>(null);
    const damageTextRef = useRef<HTMLDivElement>(null);
    const activePillarsRef = useRef<Pillar[]>(pillars);
    const BASE_TICK_RATE = 0.5;

    // Fade in to prevent ghosting - minimal delay (1 frame)
    // Also capture actual world spawn position (only needed for confined Tubas)
    useEffect(() => {
        // Determine cap based on location
        const currentLocation = useGameStore.getState().currentLocation;
        const maxInits = currentLocation === 'backstage_halls' ? MAX_CONCURRENT_TUBA_INITS_DUNGEON : MAX_CONCURRENT_TUBA_INITS_DEFAULT;
        if (tubaInitCounter >= maxInits) {
            // Instead of permanently skipping, retry after a staggered delay
            const retryDelay = 500 + Math.random() * 1000; // 500-1500ms
            const retryTimer = setTimeout(() => {
                // Re-trigger the effect by forcing a state update
                setIsReady(prev => {
                    if (!prev) return prev; // Already handled
                    return prev;
                });
                // Just run initialization directly
                if (groupRef.current) {
                    if (maxRangeFromSpawn !== undefined) {
                        groupRef.current.updateMatrixWorld(true);
                        groupRef.current.getWorldPosition(worldSpawnPos.current);
                        worldPosReady.current = true;

                        if (localPillars.length > 0) {
                            const offsetX = worldSpawnPos.current.x - initialPosition[0];
                            const offsetZ = worldSpawnPos.current.z - initialPosition[2];
                            const worldLocalPillars = localPillars.map(p => ({
                                ...p,
                                x: p.x + offsetX,
                                z: p.z + offsetZ
                            }));
                            activePillarsRef.current = [...pillars, ...worldLocalPillars];
                        }
                    }
                    setIsReady(true);
                } else {
                    setIsReady(true);
                }
            }, retryDelay);
            return () => clearTimeout(retryTimer);
        }

        tubaInitCounter++;
        let didDecrement = false;

        // Force a matrix update on next frame cycle to ensure parent transforms are applied
        const t = setTimeout(() => {
            if (groupRef.current) {
                // FORCE matrix update to get correct world position
                groupRef.current.updateMatrixWorld(true);

                // Only capture world position for confined Tubas (nested in groups like PrisonCell)
                if (maxRangeFromSpawn !== undefined) {
                    groupRef.current.getWorldPosition(worldSpawnPos.current);
                    // Verify it actually changed from local coords
                    const dx = Math.abs(worldSpawnPos.current.x - initialPosition[0]);
                    const dy = Math.abs(worldSpawnPos.current.y - initialPosition[1]);
                    const dz = Math.abs(worldSpawnPos.current.z - initialPosition[2]);
                    if (dx > 0.5 || dy > 0.5 || dz > 0.5) {
                        worldPosReady.current = true;
                    } else {
                        // Fallback: use initial position as world position
                        worldSpawnPos.current.set(...initialPosition);
                        worldPosReady.current = true;
                    }

                    // Precompute activePillars globally
                    if (localPillars.length > 0) {
                        const offsetX = worldSpawnPos.current.x - initialPosition[0];
                        const offsetZ = worldSpawnPos.current.z - initialPosition[2];

                        const worldLocalPillars = localPillars.map(p => ({
                            ...p,
                            x: p.x + offsetX,
                            z: p.z + offsetZ
                        }));
                        activePillarsRef.current = [...pillars, ...worldLocalPillars];
                    }
                }
                console.log(`[Tuba ${id}] Initialization complete, counter: ${tubaInitCounter}`);
            }

            // Always mark as ready — groupRef will be populated on next render,
            // and the useFrame fallback will capture world position if needed
            setIsReady(true);

            // Decrement counter after initialization completes (frees slot for next Tuba)
            tubaInitCounter = Math.max(0, tubaInitCounter - 1);
            didDecrement = true;
        }, 200);

        // Cleanup: clear timeout and decrement counter if component unmounts mid-init
        return () => {
            clearTimeout(t);
            if (!didDecrement) {
                tubaInitCounter = Math.max(0, tubaInitCounter - 1);
            }
            unregisterEnemyPosition(id);
        };
    }, [maxRangeFromSpawn, id]);

    // Despawn timer for high-level enemies (> player level + 20), higher level for tubas because they are easy to avoid
    if (!id.includes("wave")) {
        useEffect(() => {
            const playerLevel = usePlayerStore.getState().level;
            const levelThreshold = Math.max(playerLevel + 30, playerLevel * 2.4);

            // Only set despawn timer if enemy level exceeds player level + 30/player level * 2.4
            if (level > levelThreshold) {
                console.log(`High-level enemy spawned (LV ${level} vs player ${playerLevel}). Despawning in 30s if not killed...`);
                const despawnTimer = setTimeout(() => {
                    if (isAlive && !rewardGranted.current) {
                        rewardGranted.current = true;
                        console.log(`High-level enemy (LV ${level}) despawning after 30 seconds`);
                        setIsAlive(false);
                        onDeath?.(id);
                    }
                }, 60000); // 60 seconds

                return () => clearTimeout(despawnTimer);
            }
        }, [id, level, isAlive, onDeath]);
    }
    const lastHitByOvertone = useRef(0);
    const overtoneStunEndTime = useRef(0);

    useFrame((state, delta) => {
        // Cap delta to prevent huge jumps after frame stalls (e.g., shader compilation)
        const cappedDelta = Math.min(delta, 0.1);

        // IMPORTANT: Must check isReady to ensure world spawn position has been captured
        if (!groupRef.current || !isAlive || !isReady || !simulationActive) {
            // Fallback: Try to initialize ready state if not ready and we have a groupRef
            // BUT: Limit attempts to prevent performance issues
            if (!isReady && groupRef.current && maxRangeFromSpawn !== undefined && !fallbackAttempted.current) {
                fallbackAttempted.current = true;
                groupRef.current.updateMatrixWorld(true);
                groupRef.current.getWorldPosition(worldSpawnPos.current);
                worldPosReady.current = true;

                if (localPillars.length > 0) {
                    const offsetX = worldSpawnPos.current.x - initialPosition[0];
                    const offsetZ = worldSpawnPos.current.z - initialPosition[2];

                    const worldLocalPillars = localPillars.map(p => ({
                        ...p,
                        x: p.x + offsetX,
                        z: p.z + offsetZ
                    }));
                    activePillarsRef.current = [...pillars, ...worldLocalPillars];
                }

                setIsReady(true);
            }
            return;
        }

        // Kill floor check: if enemy fell to a catch floor (Y=-1000), instantly kill
        if (enemyPos.current.y < -500) {
            if (rewardGranted.current) return;
            rewardGranted.current = true;
            setIsAlive(false);
            onDeath?.(id);
            return;
        }

        const stateObj = usePlayerStore.getState();
        camera.getWorldPosition(playerPos.current);
        const isConfined = maxRangeFromSpawn !== undefined;

        // --- Overtone Shield Pushback Logic ---
        if (applyOvertonePushback(enemyPos.current, groupRef.current, 1.5 * 2, cappedDelta)) {
            playerPos.current.fromArray(usePlayerStore.getState().position);
            return;
        }

        const currentTime = state.clock.elapsedTime;
        // Safety check: if worldSpawnPos was never successfully captured, try again
        if (isConfined && !worldPosReady.current) {
            groupRef.current.updateMatrixWorld(true);
            groupRef.current.getWorldPosition(worldSpawnPos.current);
            const dx = Math.abs(worldSpawnPos.current.x - initialPosition[0]);
            const dy = Math.abs(worldSpawnPos.current.y - initialPosition[1]);
            const dz = Math.abs(worldSpawnPos.current.z - initialPosition[2]);
            if (dx > 0.5 || dy > 0.5 || dz > 0.5) {
                worldPosReady.current = true;
            } else {
                // World position still matches local position - scene graph not ready
                // Skip this frame entirely to prevent attacking from wrong position
                return;
            }
        }

        const effectivePos = isConfined ? worldSpawnPos.current : enemyPos.current;
        const distanceToPlayer = effectivePos.distanceTo(playerPos.current);
        playerDistanceRef.current = distanceToPlayer; // Update for health bar visibility

        // PERF: Hard sleep for very distant enemies — skip entire frame
        if (distanceToPlayer > 400) return;

        // Check Zone LOS to prevent aggro through walls
        const hasZoneLOS = checkZoneLineOfSight(effectivePos, playerPos.current);

        // Determine sight range based on location
        const effectiveSightRange = currentLocation === 'backstage_halls' ? SIGHT_RANGE_DUNGEON : SIGHT_RANGE_ARENA;
        const canSeePlayer = distanceToPlayer <= effectiveSightRange && (currentLocation !== 'backstage_halls' || hasZoneLOS);

        // Update damage number visibility via DOM ref
        if (damageTextRef.current) {
            const dmg = damageNumberRef.current;
            if (dmg && Date.now() - dmg.time < 1000) {
                damageTextRef.current.style.display = 'block';
                damageTextRef.current.textContent = `-${dmg.value}`;
            } else {
                damageTextRef.current.style.display = 'none';
            }
        }

        // Tiered frame skip based on distance
        frameCounter.current++;
        accumulatedDelta.current += cappedDelta;

        if (!shouldUpdateEnemyFrame(distanceToPlayer, frameCounter.current)) {
            // Always sync position for rendering, but skip expensive calculations
            if (!isConfined) {
                groupRef.current.position.copy(enemyPos.current);
            }
            return;
        }

        const effectiveDelta = accumulatedDelta.current;
        accumulatedDelta.current = 0;

        direction.current.copy(playerPos.current).sub(effectivePos);
        direction.current.y = 0;
        direction.current.normalize();

        const activePillars = activePillarsRef.current;

        // --- ATTACK LOGIC ---
        if (canSeePlayer && !isAttacking) {
            // For confined Tubas, check if player is actually near the spawn point
            // (prevents attacking through walls/bars)
            let playerInRange = distanceToPlayer <= SLAM_RANGE;
            if (maxRangeFromSpawn !== undefined && playerInRange) {
                const dxPlayer = playerPos.current.x - worldSpawnPos.current.x;
                const dzPlayer = playerPos.current.z - worldSpawnPos.current.z;
                const playerDistFromSpawn = Math.sqrt(dxPlayer * dxPlayer + dzPlayer * dzPlayer);
                // Player must be within the spawn leash range + attack range to be attackable
                playerInRange = playerDistFromSpawn <= (maxRangeFromSpawn + SLAM_RANGE);
            }

            if (playerInRange && currentTime - lastAttackTime.current >= SLAM_COOLDOWN) {
                // FIX: Use effectivePos (Global) instead of enemyPos (Local)
                const hasLOS = activePillars.length === 0 || checkLineOfSight(
                    { x: effectivePos.x, z: effectivePos.z },
                    { x: playerPos.current.x, z: playerPos.current.z },
                    activePillars
                );

                if (hasLOS) {
                    setIsAttacking(true);
                    lastAttackTime.current = currentTime;

                    // Determine Attack Type
                    const isCrash = level >= 100;
                    const dmgScale = isCrash ? CRASH_DAMAGE_SCALE : SLAM_DAMAGE_SCALE;

                    // Damage Calculation: Base player damage at this level * Scale
                    const basePlayerDmg = getStatsForLevel(level).damage;

                    // Check for Euphonium Shield Buff (Global)
                    const activeEuphoniumShields = useGameStore.getState().activeEuphoniumShields;
                    const buffMultiplier = activeEuphoniumShields > 0 ? 1.2 : 1.0;

                    const damageIndex = basePlayerDmg * dmgScale * buffMultiplier;

                    setTimeout(() => {
                        playerTakeDamage(roundToTenths(damageIndex), 'tuba');

                        if (isCrash) {
                            // Slow Logic
                            // 20% base + 0.1s duration per level
                            // Cap duration at 20s
                            // Wait, "Every level, the slow also increases by 0.1s" - likely duration or percent?
                            // "slows a player by 20% for 5 seconds. Every level, the slow also increases by 0.1s" -> implies duration increases?
                            // User said: "Every level, the slow also increases by 0.1s. The body crash caps on 20 seconds." 
                            // This implies duration scaling.

                            const extraDuration = (level - 100) * 0.1;
                            const duration = Math.min(20, 5 + extraDuration);

                            playerApplySlow(20, duration);
                        }

                        setIsAttacking(false);
                    }, 500); // 0.5s windup
                }
            }
        }

        // --- MOVEMENT ---
        // Confined Tubas (with maxRangeFromSpawn) are stationary - skip all movement
        // This avoids coordinate system issues with nested groups
        if (!isConfined && !isAttacking && canSeePlayer && distanceToPlayer > SLAM_RANGE - 2) {
            const moveDistance = MOVE_SPEED * effectiveDelta;

            // Calculate proposed new position
            const newX = enemyPos.current.x + direction.current.x * moveDistance;
            const newZ = enemyPos.current.z + direction.current.z * moveDistance;

            // Dungeon Collision Check
            const currentLocation = useGameStore.getState().currentLocation;
            if (currentLocation === 'backstage_halls') {
                const oldX = enemyPos.current.x;
                const oldZ = enemyPos.current.z;
                // Buffer 2.5 for enemies to prevent visual clipping (Body width ~6, radius 3)
                const isValidMove = isValidDungeonPosition(newX, newZ, 2.5);

                if (isValidMove) {
                    enemyPos.current.x = newX;
                    enemyPos.current.z = newZ;
                } else {
                    // Try sliding
                    if (isValidDungeonPosition(newX, oldZ, 2.5)) {
                        enemyPos.current.x = newX;
                    }
                    if (isValidDungeonPosition(oldX, newZ, 2.5)) {
                        enemyPos.current.z = newZ;
                    }
                }
            } else {
                // Normal Movement (Band Room)
                enemyPos.current.x = newX;
                enemyPos.current.z = newZ;
            }

            // Apply Gravity (Floor Height)
            // Tuba floats slightly higher (BODY_HEIGHT/2 = 2)
            // Pass currentY to properly detect negative floors, and location for special logic
            const floorY = getFloorHeightAt(enemyPos.current.x, enemyPos.current.z, enemyPos.current.y, 0.3, currentLocation);
            enemyPos.current.y = floorY + (BODY_HEIGHT / 2);

            // Collision (only check nearby pillars)
            const nearbyPillars = getNearbyPillars({ x: enemyPos.current.x, z: enemyPos.current.z }, pillars, 15);
            const radius = Math.max(BODY_WIDTH, BODY_DEPTH) / 2;
            const collisionPadding = 0.5;
            for (const pillar of nearbyPillars) {
                const baseRadius = pillar.radius * 1.5;
                const minDist = baseRadius + radius + collisionPadding;
                const dx = enemyPos.current.x - pillar.x;
                const dz = enemyPos.current.z - pillar.z;
                const distSq = dx * dx + dz * dz;

                if (distSq < minDist * minDist) {
                    const distToPillar = Math.sqrt(distSq);
                    const pushDir = distToPillar > 0.001
                        ? { x: dx / distToPillar, z: dz / distToPillar }
                        : { x: 1, z: 0 };
                    enemyPos.current.x = pillar.x + pushDir.x * minDist;
                    enemyPos.current.z = pillar.z + pushDir.z * minDist;
                }
            }

            // Boundary collision (Rectangle or Circle)
            if (rectangleBoundary) {
                const { centerX, centerZ, width, length, angle } = rectangleBoundary;
                const dxBoundary = enemyPos.current.x - centerX;
                const dzBoundary = enemyPos.current.z - centerZ;
                const cosBoundary = Math.cos(-angle);
                const sinBoundary = Math.sin(-angle);
                const localX = dxBoundary * cosBoundary - dzBoundary * sinBoundary;
                const localZ = dxBoundary * sinBoundary + dzBoundary * cosBoundary;
                const halfWidth = width / 2;
                const halfLength = length / 2;
                let oob = false;
                let clampedX = localX;
                let clampedZ = localZ;
                if (Math.abs(localX) > halfWidth) {
                    clampedX = Math.sign(localX) * (halfWidth - 0.5);
                    oob = true;
                }
                if (Math.abs(localZ) > halfLength) {
                    clampedZ = Math.sign(localZ) * (halfLength - 0.5);
                    oob = true;
                }
                if (oob) {
                    const cosW = Math.cos(angle);
                    const sinW = Math.sin(angle);
                    const worldX = clampedX * cosW - clampedZ * sinW;
                    const worldZ = clampedX * sinW + clampedZ * cosW;
                    enemyPos.current.x = centerX + worldX;
                    enemyPos.current.z = centerZ + worldZ;
                }
            } else {
                const cx = arenaCenter ? arenaCenter[0] : 0;
                const cz = arenaCenter ? arenaCenter[2] : 0;
                const distFromCenter = Math.sqrt((enemyPos.current.x - cx) ** 2 + (enemyPos.current.z - cz) ** 2);
                if (distFromCenter > (arenaRadius || 375)) {
                    if (teleportToCenterOnOOB) {
                        enemyPos.current.x = cx;
                        enemyPos.current.z = cz;
                    } else {
                        const angle = Math.atan2(enemyPos.current.z - cz, enemyPos.current.x - cx);
                        const resetDist = (arenaRadius || 375) * 0.9;
                        enemyPos.current.x = cx + Math.cos(angle) * resetDist;
                        enemyPos.current.z = cz + Math.sin(angle) * resetDist;
                    }
                }
            }

            // Spawn point leash (for confined enemies like prison cells)
            if (maxRangeFromSpawn !== undefined) {
                const dxSpawn = enemyPos.current.x - worldSpawnPos.current.x;
                const dzSpawn = enemyPos.current.z - worldSpawnPos.current.z;
                const distFromSpawn = Math.sqrt(dxSpawn * dxSpawn + dzSpawn * dzSpawn);
                if (distFromSpawn > maxRangeFromSpawn) {
                    // Push back toward spawn point
                    const angle = Math.atan2(dzSpawn, dxSpawn);
                    enemyPos.current.x = worldSpawnPos.current.x + Math.cos(angle) * maxRangeFromSpawn * 0.9;
                    enemyPos.current.z = worldSpawnPos.current.z + Math.sin(angle) * maxRangeFromSpawn * 0.9;
                }
            }

            applySeparation(id, enemyPos.current, 'tuba');
            registerEnemyPosition(id, enemyPos.current.x, enemyPos.current.z, 'tuba', takeDamage);
            groupRef.current.position.copy(enemyPos.current);

            // Rotation
            if (direction.current.length() > 0.01) {
                const angle = Math.atan2(direction.current.x, direction.current.z);
                groupRef.current.rotation.y = angle;
            }
        } else if (!isConfined && !isAttacking && !canSeePlayer) {
            // Idle wander at 2/3 speed
            if (currentTime - lastWanderChange.current > WANDER_CHANGE_INTERVAL) {
                wanderDirection.current.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                lastWanderChange.current = currentTime;
            }

            const wanderSpeed = (MOVE_SPEED * 2 / 3) * effectiveDelta;
            enemyPos.current.addScaledVector(wanderDirection.current, wanderSpeed);

            // Pillar collision (only check nearby pillars)
            const nearbyPillarsW = getNearbyPillars({ x: enemyPos.current.x, z: enemyPos.current.z }, pillars, 15);
            const radiusW = Math.max(BODY_WIDTH, BODY_DEPTH) / 2;
            const collisionPaddingW = 0.5;
            for (const pillar of nearbyPillarsW) {
                const baseRadius = pillar.radius * 1.5;
                const minDist = baseRadius + radiusW + collisionPaddingW;
                const dx = enemyPos.current.x - pillar.x;
                const dz = enemyPos.current.z - pillar.z;
                const distSq = dx * dx + dz * dz;
                if (distSq < minDist * minDist) {
                    const distToPillar = Math.sqrt(distSq);
                    const pushDir = distToPillar > 0.001
                        ? { x: dx / distToPillar, z: dz / distToPillar }
                        : { x: 1, z: 0 };
                    enemyPos.current.x = pillar.x + pushDir.x * minDist;
                    enemyPos.current.z = pillar.z + pushDir.z * minDist;
                    wanderDirection.current.set(pushDir.x, 0, pushDir.z).normalize();
                }
            }

            // Arena boundary (Rectangle or Circle)
            if (rectangleBoundary) {
                const { centerX, centerZ, width, length, angle } = rectangleBoundary;
                const dxBoundary = enemyPos.current.x - centerX;
                const dzBoundary = enemyPos.current.z - centerZ;
                const cosBoundary = Math.cos(-angle);
                const sinBoundary = Math.sin(-angle);
                const localX = dxBoundary * cosBoundary - dzBoundary * sinBoundary;
                const localZ = dxBoundary * sinBoundary + dzBoundary * cosBoundary;
                const halfWidth = width / 2;
                const halfLength = length / 2;
                let oob = false;
                let clampedX = localX;
                let clampedZ = localZ;
                if (Math.abs(localX) > halfWidth) {
                    clampedX = Math.sign(localX) * (halfWidth - 0.5);
                    oob = true;
                }
                if (Math.abs(localZ) > halfLength) {
                    clampedZ = Math.sign(localZ) * (halfLength - 0.5);
                    oob = true;
                }
                if (oob) {
                    const cosW = Math.cos(angle);
                    const sinW = Math.sin(angle);
                    const worldX = clampedX * cosW - clampedZ * sinW;
                    const worldZ = clampedX * sinW + clampedZ * cosW;
                    enemyPos.current.x = centerX + worldX;
                    enemyPos.current.z = centerZ + worldZ;
                    wanderDirection.current.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                }
            } else {
                const cx = arenaCenter ? arenaCenter[0] : 0;
                const cz = arenaCenter ? arenaCenter[2] : 0;
                const distFromCenter = Math.sqrt((enemyPos.current.x - cx) ** 2 + (enemyPos.current.z - cz) ** 2);
                if (distFromCenter > (arenaRadius || 375)) {
                    if (teleportToCenterOnOOB) {
                        enemyPos.current.x = cx;
                        enemyPos.current.z = cz;
                        wanderDirection.current.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                    } else {
                        const angle = Math.atan2(enemyPos.current.z - cz, enemyPos.current.x - cx);
                        const resetDist = (arenaRadius || 375) * 0.9;
                        enemyPos.current.x = cx + Math.cos(angle) * resetDist;
                        enemyPos.current.z = cz + Math.sin(angle) * resetDist;
                        wanderDirection.current.set(-Math.cos(angle), 0, -Math.sin(angle));
                    }
                }
            }

            applySeparation(id, enemyPos.current, 'tuba');
            registerEnemyPosition(id, enemyPos.current.x, enemyPos.current.z, 'tuba');
            groupRef.current.position.copy(enemyPos.current);

            // Face wander direction
            if (wanderDirection.current.length() > 0.01) {
                const angle = Math.atan2(wanderDirection.current.x, wanderDirection.current.z);
                groupRef.current.rotation.y = angle;
            }
        }

        // --- INCOMING DAMAGE (Long Tone & Poison) ---
        updatePoisonDot(currentTime, poisonState, lastTickTime, takeDamage);
        applyLongToneDamage(
            effectivePos,
            playerPos.current,
            isLongToneActive,
            lastTickTime,
            currentTime,
            takeDamage,
            poisonState,
            activePillars,
            direction.current,
            'tuba',
            id
        );

        // Attack Animation (Jump/Slam visual)
        if (isAttacking) {
            // For confined Tubas, don't update position - just do the jump animation in place
            if (!isConfined) {
                // Use current Y from enemyPos (which includes floor height) instead of initialPosition
                // Ensure we sync X/Z too since movement block doesn't run when attacking
                groupRef.current.position.copy(enemyPos.current);
            }
            // Jump animation on Y axis
            const baseY = isConfined ? groupRef.current.position.y : enemyPos.current.y;
            const jumpOffset = Math.sin(state.clock.elapsedTime * 20) * 1;
            groupRef.current.position.y = (isConfined ? initialPosition[1] : baseY) + jumpOffset;
        }
    });

    // Handle death - checked in takeDamage instead of useEffect
    const handleDeath = () => {
        if (rewardGranted.current) return;
        rewardGranted.current = true;
        setIsAlive(false);
        processEnemyDeath({
            id,
            level,
            baseXpMultiplier: 5,
            embouchureXp: 100,
            goldFormula: (lvl) => Math.floor(5 * (1 + lvl / 100)),
            getDrops: getTubaDrops,
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

        if (newHealth <= 0 && isAlive) {
            handleDeath();
        }
    };

    if (!isReady) return null;

    return (
        <group ref={groupRef} position={initialPosition}>
            {isAlive && isReady && (
                <group>
                    {/* Visual Object Wrapper to center the model visually */}
                    <group position={[0, 0, 0]}>
                        {/* Main vertical tube (Body) */}
                        {models ? <models.body position={[0, 2, 0]} /> : <mesh position={[0, 2, 0]} geometry={bodyGeo} material={brassMat} />}

                        {/* Bottom U-Bend */}
                        {models ? <models.uBend position={[0.7, 0.4, 0]} rotation={[0, 0, Math.PI / 2]} /> : <mesh position={[0.7, 0.4, 0]} rotation={[0, 0, Math.PI / 2]} geometry={uBendGeo} material={uBendMat} />}

                        {/* Second vertical tube (up to bell) */}
                        {models ? <models.secondTube position={[1.4, 2.5, 0]} /> : <mesh position={[1.4, 2.5, 0]} geometry={secondTubeGeo} material={secondTubeMat} />}

                        {/* The Bell */}
                        {models ? <models.bell position={[1.4, 5.5, 0]} /> : <mesh position={[1.4, 5.5, 0]} geometry={bellGeo} material={bellMat} />}

                        {/* Mouthpiece tube */}
                        {models ? <models.mouthpiece position={[-0.8, 3, 0]} rotation={[0, 0, Math.PI / 4]} /> : <mesh position={[-0.8, 3, 0]} rotation={[0, 0, Math.PI / 4]} geometry={mouthpieceGeo} material={silverMat} />}

                        {/* Valves (3 Pistons) */}
                        <group position={[0.4, 2, 0.8]}>
                            {models ? <models.valve position={[-0.3, 0, 0]} /> : <mesh position={[-0.3, 0, 0]} geometry={valveGeo} material={silverMat} />}
                            {models ? <models.valve position={[0, 0, 0]} /> : <mesh position={[0, 0, 0]} geometry={valveGeo} material={silverMat} />}
                            {models ? <models.valve position={[0.3, 0, 0]} /> : <mesh position={[0.3, 0, 0]} geometry={valveGeo} material={silverMat} />}
                        </group>

                        {/* Coils/Wrap around */}
                        {models ? <models.coil position={[0, 1.5, 0]} rotation={[Math.PI / 2, 0, 0]} /> : <mesh position={[0, 1.5, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={coilGeo} material={brassMat} />}
                    </group>

                    {/* Visual Hitbox/Click area */}
                    <mesh
                        ref={(m) => {
                            if (m) {
                                m.userData.onHit = (dmg: number, type: any) => takeDamage(dmg, type);
                                m.userData.type = 'enemy';
                                m.userData.enemyType = 'tuba';
                                m.userData.id = id;
                            }
                        }}
                        visible={true}
                        geometry={hitboxGeo}
                        material={hitboxMat}
                    />
                </group>
            )}

            {/* Health Bar */}
            <EnemyHealthBar
                healthRef={healthRef}
                maxHealth={MAX_HEALTH}
                level={level}
                playerDistanceRef={playerDistanceRef}
                enemyType="tuba"
                damageTextRef={damageNumberRef}
                enemyPosRef={enemyPos}
                yOffset={7.5}
                visible={gameState === 'playing' && isAlive && isReady}
            />
        </group>
    );
});
