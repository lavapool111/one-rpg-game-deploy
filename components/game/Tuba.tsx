'use client';

import { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import { usePlayerStore, useGameStore } from '@/lib/store';
import { Html } from '@react-three/drei';
import { getStatsForLevel, getEnemyHpMultiplier } from '@/lib/game/stats';
import { Pillar, checkLineOfSight, getNearbyPillars } from '@/lib/game/pillars';

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
const SLAM_RANGE = 12; // slightly larger than body
const SLAM_DAMAGE_SCALE = 6.0;
const CRASH_DAMAGE_SCALE = 15.0;
const SIGHT_RANGE = 140; // Can see further

function roundToTenths(value: number): number {
    return Math.round(value * 10) / 10;
}

function getTubaStats(level: number) {
    const playerStats = getStatsForLevel(level);

    // Base health: 15x player hp scaling
    let baseHealth = playerStats.health * 15;

    // Apply piecewise HP multiplier from stats.ts
    const hpMultiplier = getEnemyHpMultiplier(level);
    const health = roundToTenths(baseHealth * hpMultiplier);

    // XP: 5x Trumpet base XP (Trumpet: 1 + (level - 1) * 0.1)
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
    arenaRadius?: number;
}

export function Tuba({ id, initialPosition, level = 1, onDeath, pillars = [], arenaRadius = 250 }: TubaProps) {
    const groupRef = useRef<Group>(null);
    const { camera } = useThree();
    const gameState = useGameStore((state) => state.gameState);

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
    const playerPos = useRef(new Vector3());
    const direction = useRef(new Vector3());

    // Wander state (when not aggroed)
    const wanderDirection = useRef(new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize());
    const lastWanderChange = useRef(0);
    const WANDER_CHANGE_INTERVAL = 4 + Math.random() * 3; // Tubas wander slower

    // Damage visuals
    const [damageNumber, setDamageNumber] = useState<{ value: number, time: number } | null>(null);

    // Fade in to prevent ghosting - minimal delay (1 frame)
    useEffect(() => {
        const t = setTimeout(() => setIsReady(true), 50);
        return () => clearTimeout(t);
    }, []);

    useFrame((state, delta) => {
        if (!groupRef.current || !isAlive || gameState !== 'playing') return;

        const currentTime = state.clock.elapsedTime;
        camera.getWorldPosition(playerPos.current);
        const distanceToPlayer = enemyPos.current.distanceTo(playerPos.current);

        // Distance-based AI throttling: distant enemies update less frequently
        if (distanceToPlayer > 150 && Math.random() > 0.3) {
            groupRef.current.position.copy(enemyPos.current);
            return;
        }

        direction.current.copy(playerPos.current).sub(enemyPos.current);
        direction.current.y = 0;
        direction.current.normalize();

        const canSeePlayer = distanceToPlayer <= SIGHT_RANGE;

        // --- ATTACK LOGIC ---
        if (canSeePlayer && !isAttacking) {
            if (distanceToPlayer <= SLAM_RANGE && currentTime - lastAttackTime.current >= SLAM_COOLDOWN) {
                const hasLOS = pillars.length === 0 || checkLineOfSight(
                    { x: enemyPos.current.x, z: enemyPos.current.z },
                    { x: playerPos.current.x, z: playerPos.current.z },
                    pillars
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
                        playerTakeDamage(roundToTenths(damageIndex));

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
        if (!isAttacking && canSeePlayer && distanceToPlayer > SLAM_RANGE - 2) {
            const moveDistance = MOVE_SPEED * delta;
            enemyPos.current.addScaledVector(direction.current, moveDistance);

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

            groupRef.current.position.copy(enemyPos.current);

            // Rotation
            if (direction.current.length() > 0.01) {
                const angle = Math.atan2(direction.current.x, direction.current.z);
                groupRef.current.rotation.y = angle;
            }
        } else if (!isAttacking && !canSeePlayer) {
            // Idle wander at 2/3 speed
            if (currentTime - lastWanderChange.current > WANDER_CHANGE_INTERVAL) {
                wanderDirection.current.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                lastWanderChange.current = currentTime;
            }

            const wanderSpeed = (MOVE_SPEED * 2 / 3) * delta;
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
            groupRef.current.position.y = initialPosition[1] + Math.sin(state.clock.elapsedTime * 20) * 1;
        } else {
            groupRef.current.position.y = initialPosition[1];
        }
    });

    // Death
    useEffect(() => {
        if (health <= 0 && isAlive && !rewardGranted.current) {
            rewardGranted.current = true;
            setIsAlive(false);
            const playerStore = usePlayerStore.getState();
            // Use registerKill for Tempo system (handles XP with bonus)
            playerStore.registerKill(level);
            playerStore.addEmbouchureXp(100);

            // Drops
            playerStore.collectEchoes(5); // 5 Echoes
            playerStore.addMaterial('valves', Math.floor(Math.random() * 3) + 2); // 2-4 Valves
            playerStore.addMaterial('heavy_valves', Math.floor(Math.random() * 2) + 1); // 1-2 Heavy Valves
            if (Math.random() < 0.20) playerStore.addMaterial('valve_oil', 1);
            playerStore.addMaterial('sheet_music_fragments', 1); // Guaranteed
            playerStore.addMaterial('brass_ingots', 2); // Guaranteed

            onDeath?.(id);
        }
    }, [health, isAlive, id, onDeath, XP_REWARD, level]);

    const takeDamage = (amount: number) => {
        const nextHealth = Math.max(0, health - amount);
        setHealth(nextHealth);
        setDamageNumber({ value: Number(amount.toFixed(2)), time: Date.now() });
    };

    if (!isAlive || !isReady) return null;

    const brassColor = '#8B4513'; // Darker bronze/brass for Tuba
    const bellColor = '#DAA520';
    const silverColor = '#C0C0C0';

    return (
        <group ref={groupRef} position={initialPosition}>
            {/* Visual Object Wrapper to center the model visually */}
            <group position={[0, 0, 0]}>
                {/* Main vertical tube (Body) */}
                <mesh position={[0, 2, 0]}>
                    <cylinderGeometry args={[0.8, 0.6, 4, 16]} />
                    <meshStandardMaterial color={brassColor} roughness={0.3} metalness={0.6} emissive={brassColor} emissiveIntensity={0.05} />
                </mesh>

                {/* Bottom U-Bend */}
                <mesh position={[0.7, 0.4, 0]} rotation={[0, 0, Math.PI / 2]}>
                    <torusGeometry args={[0.7, 0.6, 16, 32, Math.PI]} />
                    <meshStandardMaterial color={brassColor} roughness={0.3} metalness={0.6} />
                </mesh>

                {/* Second vertical tube (up to bell) */}
                <mesh position={[1.4, 2.5, 0]}>
                    <cylinderGeometry args={[0.6, 0.6, 5, 16]} />
                    <meshStandardMaterial color={brassColor} roughness={0.3} metalness={0.6} />
                </mesh>

                {/* The Bell */}
                <mesh position={[1.4, 5.5, 0]}>
                    <cylinderGeometry args={[2, 0.6, 2, 32, 1, true]} />
                    <meshStandardMaterial color={bellColor} side={2} metalness={0.7} roughness={0.2} emissive={bellColor} emissiveIntensity={0.05} />
                </mesh>

                {/* Mouthpiece tube */}
                <mesh position={[-0.8, 3, 0]} rotation={[0, 0, Math.PI / 4]}>
                    <cylinderGeometry args={[0.1, 0.1, 2, 8]} />
                    <meshStandardMaterial color={silverColor} />
                </mesh>

                {/* Valves (3 Pistons) */}
                <group position={[0.4, 2, 0.8]}>
                    <mesh position={[-0.3, 0, 0]}>
                        <cylinderGeometry args={[0.15, 0.15, 1.5, 8]} />
                        <meshStandardMaterial color={silverColor} />
                    </mesh>
                    <mesh position={[0, 0, 0]}>
                        <cylinderGeometry args={[0.15, 0.15, 1.5, 8]} />
                        <meshStandardMaterial color={silverColor} />
                    </mesh>
                    <mesh position={[0.3, 0, 0]}>
                        <cylinderGeometry args={[0.15, 0.15, 1.5, 8]} />
                        <meshStandardMaterial color={silverColor} />
                    </mesh>
                </group>

                {/* Coils/Wrap around */}
                <mesh position={[0, 1.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[1.6, 0.3, 16, 48]} />
                    <meshStandardMaterial color={brassColor} roughness={0.3} metalness={0.6} emissive={brassColor} emissiveIntensity={0.05} />
                </mesh>
            </group>

            {/* Visual Hitbox/Click area */}
            <mesh
                onClick={(e) => {
                    e.stopPropagation();
                    const dist = enemyPos.current.distanceTo(playerPos.current);
                    if (dist > 30) return;

                    const hasLOS = pillars.length === 0 || checkLineOfSight(
                        { x: playerPos.current.x, z: playerPos.current.z },
                        { x: enemyPos.current.x, z: enemyPos.current.z },
                        pillars
                    );
                    if (hasLOS) {
                        // NERF: Basic attack deals 50% damage
                        const { critChance } = usePlayerStore.getState();
                        const isCrit = Math.random() < critChance;
                        const critMult = isCrit ? 1.5 : 1.0;

                        const dmg = basicAttackDamage * critMult;
                        if (isCrit) console.log("CRITICAL HIT on Tuba!");
                        takeDamage(dmg);
                    }
                }}
                visible={false}
            >
                <boxGeometry args={[BODY_WIDTH, BODY_HEIGHT * 2, BODY_DEPTH]} />
                <meshBasicMaterial transparent opacity={0} />
            </mesh>

            {/* Health Bar - Only visible when playing */}
            {gameState === 'playing' && (
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
