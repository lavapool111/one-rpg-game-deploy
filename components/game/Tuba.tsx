'use client';

import { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import * as THREE from 'three';
import { usePlayerStore, useGameStore } from '@/lib/store';
import { Html } from '@react-three/drei';
import { getStatsForLevel, getEnemyHpMultiplier } from '@/lib/game/stats';
import { Pillar, checkLineOfSight, getNearbyPillars } from '@/lib/game/pillars';
import { isValidDungeonPosition } from '@/lib/game/collision';
import { getFloorHeightAt } from '@/lib/game/stairCollision';

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
const SPEED_PER_LEVEL = 0.005;

// Attack Config
const SLAM_COOLDOWN = 10.5;
const SLAM_RANGE = 10; // User requested 10ft
const SLAM_DAMAGE_SCALE = 6.0;
const CRASH_DAMAGE_SCALE = 15.0;
const SIGHT_RANGE_ARENA = 140;
const SIGHT_RANGE_DUNGEON = 40; // Reduced for dungeon to prevent wall-hacks

function roundToTenths(value: number): number {
    return Math.round(value * 10) / 10;
}

/**
 * Calculate Tuba stats for a given level
 * Uses same base stats as player from getStatsForLevel(), then applies enemy multipliers
 */
function getTubaStats(level: number) {
    const baseStats = getStatsForLevel(level);

    // Health: base stats * 15x enemy multiplier * HP scaling
    const hpMultiplier = getEnemyHpMultiplier(level);
    const health = roundToTenths(baseStats.health * 15 * hpMultiplier);

    // XP: 5x Trumpet base XP
    const xp = (1 + (level - 1) * 0.1) * 5;

    // Speed
    const speed = BASE_SPEED + (level - 1) * SPEED_PER_LEVEL;

    return { health, xp, speed };
}

interface TubaProps {
    id: string;
    initialPosition: [number, number, number];
    level?: number;
    onDeath?: (id: string) => void;
    pillars?: Pillar[];
    localPillars?: Pillar[]; // Pillars relative to the Tuba's parent (e.g., cell walls)
    arenaRadius?: number;
    /** Maximum distance this Tuba can move from spawn point (for confined enemies) */
    maxRangeFromSpawn?: number;
}

const brassColor = '#8B4513'; // Darker bronze/brass for Tuba
const bellColor = '#DAA520';
const silverColor = '#C0C0C0';

// Geometries
const bodyGeo = new THREE.CylinderGeometry(0.8, 0.6, 4, 16);
const uBendGeo = new THREE.TorusGeometry(0.7, 0.6, 16, 32, Math.PI);
const secondTubeGeo = new THREE.CylinderGeometry(0.6, 0.6, 5, 16);
const bellGeo = new THREE.CylinderGeometry(2, 0.6, 2, 32, 1, true);
const mouthpieceGeo = new THREE.CylinderGeometry(0.1, 0.1, 2, 8);
const valveGeo = new THREE.CylinderGeometry(0.15, 0.15, 1.5, 8);
const coilGeo = new THREE.TorusGeometry(1.6, 0.3, 16, 48);
const hitboxGeo = new THREE.BoxGeometry(BODY_WIDTH, BODY_HEIGHT * 2, BODY_DEPTH);

// Materials
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
    color: bellColor,
    side: 2,
    metalness: 0.7,
    roughness: 0.2,
    emissive: bellColor,
    emissiveIntensity: 0.05
});
const silverMat = new THREE.MeshStandardMaterial({
    color: silverColor
});
const hitboxMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0
});

export function Tuba({ id, initialPosition, level = 1, onDeath, pillars = [], localPillars = [], arenaRadius = 375, maxRangeFromSpawn }: TubaProps) {
    const groupRef = useRef<Group>(null);
    const { camera } = useThree();
    const gameState = useGameStore((state) => state.gameState);
    const currentLocation = useGameStore((state) => state.currentLocation);

    const stats = getTubaStats(level);
    const MAX_HEALTH = stats.health;
    const XP_REWARD = stats.xp;
    const MOVE_SPEED = stats.speed;

    const [initialHealth] = useState(MAX_HEALTH);
    const [health, setHealth] = useState(MAX_HEALTH);
    const [isAlive, setIsAlive] = useState(true);
    const rewardGranted = useRef(false);
    const [isReady, setIsReady] = useState(false);

    // Attack state
    const lastAttackTime = useRef(0);
    const [isAttacking, setIsAttacking] = useState(false);

    // Store access - use selective subscriptions to avoid mass re-renders
    const basicAttackDamage = usePlayerStore((state) => state.basicAttackDamage);
    const playerTakeDamage = usePlayerStore((state) => state.takeDamage);
    const playerApplySlow = usePlayerStore((state) => state.applySlow);

    // Vectors
    const enemyPos = useRef(new Vector3(...initialPosition));
    const worldSpawnPos = useRef(new Vector3(...initialPosition)); // Actual world spawn position
    const playerPos = useRef(new Vector3());
    const direction = useRef(new Vector3());
    const playerDistanceRef = useRef(0); // For health bar visibility
    const frameCounter = useRef(0); // For tiered frame skip

    // Wander state (when not aggroed)
    const wanderDirection = useRef(new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize());
    const lastWanderChange = useRef(0);
    const WANDER_CHANGE_INTERVAL = 4 + Math.random() * 3; // Tubas wander slower

    // Damage visuals
    const [damageNumber, setDamageNumber] = useState<{ value: number, time: number } | null>(null);

    // Fade in to prevent ghosting - minimal delay (1 frame)
    // Also capture actual world spawn position (only needed for confined Tubas)
    useEffect(() => {
        // Force a matrix update on next frame cycle to ensure parent transforms are applied
        const t = setTimeout(() => {
            if (groupRef.current) {
                // FORCE matrix update to get correct world position
                groupRef.current.updateMatrixWorld(true);

                // Only capture world position for confined Tubas (nested in groups like PrisonCell)
                if (maxRangeFromSpawn !== undefined) {
                    groupRef.current.getWorldPosition(worldSpawnPos.current);
                    // Debug: Log position to verify fix for 480 damage bug
                    // console.log(`Tuba ${id} Spawn World Pos:`, worldSpawnPos.current);
                }
            }
            setIsReady(true);
        }, 100); // Increased to 100ms to be safe with scene graph updates
        return () => clearTimeout(t);
    }, [maxRangeFromSpawn, id]);

    useFrame((state, delta) => {
        // Cap delta to prevent huge jumps after frame stalls (e.g., shader compilation)
        const cappedDelta = Math.min(delta, 0.1);

        // IMPORTANT: Must check isReady to ensure world spawn position has been captured
        if (!groupRef.current || !isAlive || !isReady || gameState !== 'playing') return;

        const currentTime = state.clock.elapsedTime;
        camera.getWorldPosition(playerPos.current);

        // For confined Tubas, use worldSpawnPos for all distance calculations
        const isConfined = maxRangeFromSpawn !== undefined;
        // Safety check: if worldSpawnPos is still 0,0,0 but we are confined, update it again
        if (isConfined && worldSpawnPos.current.lengthSq() < 0.1 && maxRangeFromSpawn !== undefined) {
            groupRef.current.updateMatrixWorld(true);
            groupRef.current.getWorldPosition(worldSpawnPos.current);
        }

        const effectivePos = isConfined ? worldSpawnPos.current : enemyPos.current;
        const distanceToPlayer = effectivePos.distanceTo(playerPos.current);
        playerDistanceRef.current = distanceToPlayer; // Update for health bar visibility

        // Determine sight range based on location
        const effectiveSightRange = currentLocation === 'backstage_halls' ? SIGHT_RANGE_DUNGEON : SIGHT_RANGE_ARENA;

        // Tiered frame skip based on distance:
        // 0-50ft: every frame, 50-100ft: every 2 frames, 100-200ft: every 4 frames, 200-400ft: every 8 frames
        frameCounter.current++;
        let shouldUpdate = true;
        if (distanceToPlayer > 200) {
            shouldUpdate = (frameCounter.current % 8) === 0;
        } else if (distanceToPlayer > 100) {
            shouldUpdate = (frameCounter.current % 4) === 0;
        } else if (distanceToPlayer > 50) {
            shouldUpdate = (frameCounter.current % 2) === 0;
        }
        // Always sync position for rendering, but skip expensive calculations
        if (!shouldUpdate) {
            if (!isConfined) {
                groupRef.current.position.copy(enemyPos.current);
            }
            return;
        }

        direction.current.copy(playerPos.current).sub(effectivePos);
        direction.current.y = 0;
        direction.current.normalize();

        const canSeePlayer = distanceToPlayer <= effectiveSightRange;

        // --- PREPARE PILLARS FOR LOS ---
        // If we have local pillars (from PrisonCell), transform them to world space
        // We use worldSpawnPos vs initialPosition to determine the offset
        let activePillars = pillars;
        if (localPillars.length > 0) {
            const offsetX = worldSpawnPos.current.x - initialPosition[0];
            const offsetZ = worldSpawnPos.current.z - initialPosition[2];

            // Create temporary world pillars
            const worldLocalPillars = localPillars.map(p => ({
                ...p,
                x: p.x + offsetX,
                z: p.z + offsetZ
            }));
            activePillars = [...pillars, ...worldLocalPillars];
        }

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
                    const damageIndex = basePlayerDmg * dmgScale;

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
            const moveDistance = MOVE_SPEED * cappedDelta;

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

            // Arena boundary collision
            const distFromCenter = Math.sqrt(enemyPos.current.x ** 2 + enemyPos.current.z ** 2);
            if (distFromCenter > arenaRadius) {
                const angle = Math.atan2(enemyPos.current.z, enemyPos.current.x);
                const resetDist = arenaRadius * 0.9;
                enemyPos.current.x = Math.cos(angle) * resetDist;
                enemyPos.current.z = Math.sin(angle) * resetDist;
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

            const wanderSpeed = (MOVE_SPEED * 2 / 3) * cappedDelta;
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

            // Arena boundary
            const distFromCenter = Math.sqrt(enemyPos.current.x ** 2 + enemyPos.current.z ** 2);
            if (distFromCenter > arenaRadius) {
                const angle = Math.atan2(enemyPos.current.z, enemyPos.current.x);
                const resetDist = arenaRadius * 0.9;
                enemyPos.current.x = Math.cos(angle) * resetDist;
                enemyPos.current.z = Math.sin(angle) * resetDist;
                wanderDirection.current.set(-Math.cos(angle), 0, -Math.sin(angle));
            }

            groupRef.current.position.copy(enemyPos.current);

            // Face wander direction
            if (wanderDirection.current.length() > 0.01) {
                const angle = Math.atan2(wanderDirection.current.x, wanderDirection.current.z);
                groupRef.current.rotation.y = angle;
            }
        }

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

    // Death
    useEffect(() => {
        if (health <= 0 && isAlive && !rewardGranted.current) {
            rewardGranted.current = true;
            setIsAlive(false);
            const playerStore = usePlayerStore.getState();
            // Use registerKill for Tempo system (handles XP with bonus)
            playerStore.registerKill(level, 5); // Tuba gives 5x XP
            playerStore.addEmbouchureXp(100);

            // Drops Logic
            const currentLocation = useGameStore.getState().currentLocation;

            if (currentLocation === 'backstage_halls') {
                // Backstage Halls: Gold only
                useGameStore.getState().collectGold(8);
            } else {
                // Band Room: Materials & Echoes
                playerStore.collectEchoes(5); // 5 Echoes
                playerStore.addMaterial('valves', Math.floor(Math.random() * 3) + 2); // 2-4 Valves
                playerStore.addMaterial('heavy_valves', Math.floor(Math.random() * 2) + 1); // 1-2 Heavy Valves
                if (Math.random() < 0.20) playerStore.addMaterial('valve_oil', 1);
                playerStore.addMaterial('sheet_music_fragments', 1); // Guaranteed
                playerStore.addMaterial('brass_ingots', 2); // Guaranteed
            }

            onDeath?.(id);
        }
    }, [health, isAlive, id, onDeath, XP_REWARD, level]);

    const takeDamage = (amount: number) => {
        const nextHealth = Math.max(0, health - amount);
        setHealth(nextHealth);
        setDamageNumber({ value: Number(amount.toFixed(2)), time: Date.now() });
    };

    if (!isAlive || !isReady) return null;

    return (
        <group ref={groupRef} position={initialPosition}>
            {/* Visual Object Wrapper to center the model visually */}
            <group position={[0, 0, 0]}>
                {/* Main vertical tube (Body) */}
                <mesh position={[0, 2, 0]} geometry={bodyGeo} material={brassMat} />

                {/* Bottom U-Bend */}
                <mesh position={[0.7, 0.4, 0]} rotation={[0, 0, Math.PI / 2]} geometry={uBendGeo} material={uBendMat} />

                {/* Second vertical tube (up to bell) */}
                <mesh position={[1.4, 2.5, 0]} geometry={secondTubeGeo} material={secondTubeMat} />

                {/* The Bell */}
                <mesh position={[1.4, 5.5, 0]} geometry={bellGeo} material={bellMat} />

                {/* Mouthpiece tube */}
                <mesh position={[-0.8, 3, 0]} rotation={[0, 0, Math.PI / 4]} geometry={mouthpieceGeo} material={silverMat} />

                {/* Valves (3 Pistons) */}
                <group position={[0.4, 2, 0.8]}>
                    <mesh position={[-0.3, 0, 0]} geometry={valveGeo} material={silverMat} />
                    <mesh position={[0, 0, 0]} geometry={valveGeo} material={silverMat} />
                    <mesh position={[0.3, 0, 0]} geometry={valveGeo} material={silverMat} />
                </group>

                {/* Coils/Wrap around */}
                <mesh position={[0, 1.5, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={coilGeo} material={brassMat} />
            </group>

            {/* Visual Hitbox/Click area */}
            <mesh
                onClick={(e) => {
                    e.stopPropagation();
                    // For confined Tubas, use worldSpawnPos (actual world position)
                    // For normal Tubas, use enemyPos (which tracks movement)
                    const effectivePos = maxRangeFromSpawn !== undefined ? worldSpawnPos.current : enemyPos.current;
                    const dist = effectivePos.distanceTo(playerPos.current);
                    if (dist > 30) return;

                    // Prepare pillars for click check (same as update loop)
                    let activePillars = pillars;
                    if (localPillars.length > 0) {
                        const offsetX = worldSpawnPos.current.x - initialPosition[0];
                        const offsetZ = worldSpawnPos.current.z - initialPosition[2];
                        const worldLocalPillars = localPillars.map(p => ({
                            ...p,
                            x: p.x + offsetX,
                            z: p.z + offsetZ
                        }));
                        activePillars = [...pillars, ...worldLocalPillars];
                    }

                    const hasLOS = activePillars.length === 0 || checkLineOfSight(
                        { x: playerPos.current.x, z: playerPos.current.z },
                        { x: effectivePos.x, z: effectivePos.z },
                        activePillars
                    );
                    if (hasLOS) {
                        // NERF: Basic attack deals 50% damage
                        const { critChance, critFactor } = usePlayerStore.getState();
                        const isCrit = Math.random() < critChance;
                        const critMult = isCrit ? critFactor : 1.0;

                        const dmg = basicAttackDamage * critMult;
                        if (isCrit) console.log("CRITICAL HIT on Tuba!");
                        takeDamage(dmg);
                        console.log(`Tuba HP: ${Math.max(0, health - dmg).toFixed(1)} / ${MAX_HEALTH}`);
                    }
                }}
                visible={false}
                geometry={hitboxGeo}
                material={hitboxMat}
            />

            {/* Health Bar - Only visible when playing and within 175ft */}
            {gameState === 'playing' && playerDistanceRef.current <= 175 && (
                <group position={[0, 7.5, 0]}>
                    <Html center distanceFactor={20}>
                        <div className="flex flex-col items-center pointer-events-none">
                            {damageNumber && Date.now() - damageNumber.time < 1000 && (
                                <div className="absolute -top-16 text-red-600 font-extrabold text-2xl animate-bounce">
                                    -{damageNumber.value}
                                </div>
                            )}
                            <div className="bg-black/70 px-3 py-1 rounded backdrop-blur-md mb-1 border border-red-900">
                                <span className="text-red-500 font-bold text-base">TUBA {level >= 100 ? 'CRASHER' : ''} LV {level}</span>
                            </div>
                            <div className="w-48 h-4 bg-gray-900 border-2 border-red-900/50 rounded-full overflow-hidden">
                                <div className="h-full bg-red-700 transition-[width] duration-75" style={{ width: `${(health / MAX_HEALTH) * 100}%` }} />
                            </div>
                        </div>
                    </Html>
                </group>
            )}
        </group>
    );
}
