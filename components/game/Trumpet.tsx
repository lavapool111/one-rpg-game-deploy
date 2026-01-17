'use client';

import { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import { usePlayerStore, useGameStore } from '@/lib/store';
import { Html } from '@react-three/drei';
import { getStatsForLevel, getEnemyHpMultiplier } from '@/lib/game/stats';
import { Pillar, checkLineOfSight, getNearbyPillars } from '@/lib/game/pillars';

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

// Stat increments per level range (same structure as stats.ts)
const STAT_INCREMENTS = [
    { maxLevel: 10, dmg: 1 },
    { maxLevel: 20, dmg: 2 },
    { maxLevel: 30, dmg: 3 },
    { maxLevel: 40, dmg: 4 },
    { maxLevel: 50, dmg: 5 },
    { maxLevel: 60, dmg: 6 },
    { maxLevel: 70, dmg: 8 },
    { maxLevel: 80, dmg: 10 },
    { maxLevel: 90, dmg: 12 },
    { maxLevel: 100, dmg: 15 },
    { maxLevel: 110, dmg: 18 },
    { maxLevel: 120, dmg: 21 },
    { maxLevel: 130, dmg: 24 },
    { maxLevel: 140, dmg: 28 },
    { maxLevel: 150, dmg: 33 },
    { maxLevel: 160, dmg: 39 },
    { maxLevel: 170, dmg: 45 },
    { maxLevel: 180, dmg: 51 },
    { maxLevel: 190, dmg: 59 },
    { maxLevel: 200, dmg: 66 },
    { maxLevel: 210, dmg: 73 },
    { maxLevel: 220, dmg: 81 },
    { maxLevel: 230, dmg: 90 },
    { maxLevel: 240, dmg: 100 },
    { maxLevel: 250, dmg: 112 },
];

/**
 * Round a number to the tenths place to avoid floating point errors
 */
function roundToTenths(value: number): number {
    return Math.round(value * 10) / 10;
}

/**
 * Calculate Trumpet stats for a given level
 * Health scales 1:1 with player, damage uses 0.2x of player damage increments
 * Added progressive HP multiplier for levels 10+ to make high-level enemies tankier
 */
function getTrumpetStats(level: number): { health: number; damage: number; xp: number } {
    const playerStats = getStatsForLevel(level);

    // Base health scales 1:1 with player scaling
    let baseHealth = playerStats.health * 2;

    // Apply piecewise HP multiplier from stats.ts
    const hpMultiplier = getEnemyHpMultiplier(level);
    const health = roundToTenths(baseHealth * hpMultiplier);

    // Damage: base 1 + 0.2x of normal damage increments per level
    // Level 1 = 1, each level adds 0.2x the normal damage increment for that range
    let damage = 1;
    for (let i = 1; i < level; i++) {
        const increment = STAT_INCREMENTS.find((inc) => i <= inc.maxLevel) || STAT_INCREMENTS[STAT_INCREMENTS.length - 1];
        damage += increment.dmg * TRUMPET_DAMAGE_SCALE;
    }
    damage = roundToTenths(damage);

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
}

export function Trumpet({ id, initialPosition, level = 1, onDeath, pillars = [], arenaRadius = 250 }: TrumpetProps) {
    const groupRef = useRef<Group>(null);
    const { camera } = useThree();
    const gameState = useGameStore((state) => state.gameState);

    // Calculate stats based on level (half damage scaling)
    const stats = getTrumpetStats(level);
    const TRUMPET_HEALTH = stats.health;
    const TRUMPET_DAMAGE = stats.damage;
    const TRUMPET_XP = stats.xp;

    // Enemy state
    const [health, setHealth] = useState(TRUMPET_HEALTH);
    const [isAlive, setIsAlive] = useState(true);
    const lastAttackTime = useRef(0);
    const rewardGranted = useRef(false);

    // Damage logic state - use selective subscriptions to avoid mass re-renders
    const isLongToneActive = usePlayerStore((state) => state.isLongToneActive);
    const playerDamage = usePlayerStore((state) => state.damage);
    const basicAttackDamage = usePlayerStore((state) => state.basicAttackDamage);
    const lastTickTime = useRef(0);
    const TICK_RATE = 0.5;
    const [damageNumber, setDamageNumber] = useState<{ value: number, time: number } | null>(null);

    // Reusable vectors
    const enemyPos = useRef(new Vector3(...initialPosition));
    const playerPos = useRef(new Vector3());
    const direction = useRef(new Vector3());

    // Attack animation state
    const [isAttacking, setIsAttacking] = useState(false);

    // Wander state (when not aggroed)
    const wanderDirection = useRef(new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize());
    const lastWanderChange = useRef(0);
    const WANDER_CHANGE_INTERVAL = 3 + Math.random() * 2; // 3-5 seconds

    // Get player damage function
    const playerTakeDamage = usePlayerStore((state) => state.takeDamage);

    // Main game loop
    useFrame((state, delta) => {
        if (!groupRef.current || !isAlive || gameState !== 'playing') return;

        // Get player position from camera
        camera.getWorldPosition(playerPos.current);

        // Calculate distance to player
        const distanceToPlayer = enemyPos.current.distanceTo(playerPos.current);

        // Distance-based AI throttling: distant enemies update less frequently
        // Enemies >150ft away only update 30% of frames to reduce CPU
        if (distanceToPlayer > 150 && Math.random() > 0.3) {
            // Still sync position for rendering
            groupRef.current.position.copy(enemyPos.current);
            return;
        }

        // Calculate direction to player (only on XZ plane)
        direction.current.copy(playerPos.current).sub(enemyPos.current);
        direction.current.y = 0; // Keep on ground
        direction.current.normalize();

        // Only act if player is within sight range
        const canSeePlayer = distanceToPlayer <= SIGHT_RANGE;
        const currentTime = state.clock.elapsedTime;

        // Move toward player if within sight range and outside attack range
        if (canSeePlayer && distanceToPlayer > ATTACK_RANGE) {
            const moveDistance = TRUMPET_SPEED * delta;
            enemyPos.current.addScaledVector(direction.current, moveDistance);

            // Pillar collision resolution for trumpet (only check nearby pillars)
            const nearbyPillars = getNearbyPillars({ x: enemyPos.current.x, z: enemyPos.current.z }, pillars, 15);
            const trumpetRadius = BODY_LENGTH / 2;
            const collisionPadding = 0.5;

            for (const pillar of nearbyPillars) {
                const baseRadius = pillar.radius * 1.5;
                const minDist = baseRadius + trumpetRadius + collisionPadding;
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

            // Arena boundary collision - keep enemy within bounds
            const distFromCenter = Math.sqrt(enemyPos.current.x ** 2 + enemyPos.current.z ** 2);
            if (distFromCenter > arenaRadius) {
                const angle = Math.atan2(enemyPos.current.z, enemyPos.current.x);
                const resetDist = arenaRadius * 0.9;
                enemyPos.current.x = Math.cos(angle) * resetDist;
                enemyPos.current.z = Math.sin(angle) * resetDist;
            }

            groupRef.current.position.copy(enemyPos.current);
        } else if (!canSeePlayer) {
            // Idle wander at 2/3 speed
            // Change wander direction periodically
            if (currentTime - lastWanderChange.current > WANDER_CHANGE_INTERVAL) {
                wanderDirection.current.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                lastWanderChange.current = currentTime;
            }

            const wanderSpeed = (TRUMPET_SPEED * 2 / 3) * delta;
            enemyPos.current.addScaledVector(wanderDirection.current, wanderSpeed);

            // Pillar collision (only check nearby pillars)
            const nearbyPillarsW = getNearbyPillars({ x: enemyPos.current.x, z: enemyPos.current.z }, pillars, 15);
            const trumpetRadiusW = BODY_LENGTH / 2;
            const collisionPaddingW = 0.5;
            for (const pillar of nearbyPillarsW) {
                const baseRadius = pillar.radius * 1.5;
                const minDist = baseRadius + trumpetRadiusW + collisionPaddingW;
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
                // Turn around when hitting boundary
                wanderDirection.current.set(-Math.cos(angle), 0, -Math.sin(angle));
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
        if (isLongToneActive) {
            const now = state.clock.elapsedTime;
            if (now - lastTickTime.current >= TICK_RATE) {
                const dist = groupRef.current.position.distanceTo(playerPos.current);
                if (dist < 20) { // Range
                    // Check LOS before applying Long Tone damage
                    const hasLOS = pillars.length === 0 || checkLineOfSight(
                        { x: playerPos.current.x, z: playerPos.current.z },
                        { x: enemyPos.current.x, z: enemyPos.current.z },
                        pillars
                    );

                    if (hasLOS) {
                        // Formula: (Damage * 0.15) - Defense(0)
                        // playerDamage is already scaled
                        const { critChance } = usePlayerStore.getState();
                        const isCrit = Math.random() < critChance;
                        const critMult = isCrit ? 1.5 : 1.0;

                        const rawDamage = (playerDamage * 0.15) * critMult;
                        const finalDamage = Math.max(0, rawDamage); // Defense 0

                        if (finalDamage > 0) {
                            takeDamage(finalDamage);
                            lastTickTime.current = now;
                        }
                    }
                }
            }
        }

        // Attack animation - scale up when attacking
        if (isAttacking) {
            groupRef.current.scale.setScalar(1.15);
        } else {
            groupRef.current.scale.lerp(new Vector3(1, 1, 1), 0.1);
        }
    });

    // Handle death
    useEffect(() => {
        if (health <= 0 && isAlive && !rewardGranted.current) {
            rewardGranted.current = true;
            setIsAlive(false);
            // Grant Rewards via Tempo system (handles XP bonus calculation)
            const playerStore = usePlayerStore.getState();
            playerStore.registerKill(level);
            playerStore.addEmbouchureXp(20);

            // Drops
            const echoes = Math.floor(Math.random() * 2) + 1; // 1-2 Echoes
            playerStore.collectEchoes(echoes);

            playerStore.addMaterial('valves', Math.floor(Math.random() * 2) + 1); // 1-2 Valves
            if (Math.random() < 0.3) playerStore.addMaterial('sheet_music_fragments', 1);
            if (Math.random() < 0.05) playerStore.addMaterial('valve_oil', 1);
            if (Math.random() < 0.15) playerStore.addMaterial('brass_ingots', 1);

            onDeath?.(id);
        }
    }, [health, isAlive, id, onDeath, level]);

    const takeDamage = (amount: number) => {
        const nextHealth = Math.max(0, health - amount);
        setHealth(nextHealth);
        setDamageNumber({ value: Number(amount.toFixed(2)), time: Date.now() });
    };

    // Fade in health bar to prevent ghosting - minimal delay (1 frame)
    const [isReady, setIsReady] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setIsReady(true), 50);
        return () => clearTimeout(t);
    }, []);

    if (!isAlive || !isReady) return null;

    // Trumpet colors
    const brassColor = '#B8860B'; // Dark goldenrod
    const brassHighlight = '#DAA520'; // Goldenrod
    const valveColor = '#CD853F'; // Peru

    return (
        <group ref={groupRef} position={initialPosition}>
            {/* Main body tube - horizontal cylinder */}
            <mesh position={[0, BODY_HEIGHT / 2, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[BODY_DEPTH / 4, BODY_DEPTH / 4, BODY_LENGTH * 0.6, 12]} />
                <meshStandardMaterial color={brassColor} roughness={0.3} metalness={0.8} emissive={brassColor} emissiveIntensity={0.05} />
            </mesh>

            {/* Bell (flared end) */}
            <mesh position={[BODY_LENGTH / 2 - 0.3, BODY_HEIGHT / 2, 0]} rotation={[0, 0, -Math.PI / 2]}>
                <cylinderGeometry args={[BODY_HEIGHT / 2, BODY_DEPTH / 4, 0.8, 16]} />
                <meshStandardMaterial
                    color={brassHighlight}
                    roughness={0.2}
                    metalness={0.9}
                    emissive={isAttacking ? '#FF6600' : brassHighlight}
                    emissiveIntensity={isAttacking ? 0.5 : 0.03}
                />
            </mesh>

            {/* Mouthpiece (narrow end) */}
            <mesh position={[-BODY_LENGTH / 2 + 0.3, BODY_HEIGHT / 2, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[BODY_DEPTH / 8, BODY_DEPTH / 6, 0.4, 8]} />
                <meshStandardMaterial color={brassHighlight} roughness={0.25} metalness={0.85} />
            </mesh>

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
                        const { critChance } = usePlayerStore.getState();
                        const isCrit = Math.random() < critChance;
                        const critMult = isCrit ? 1.5 : 1.0;

                        // basicAttackDamage is already half of full damage
                        const dmg = basicAttackDamage * critMult;

                        if (isCrit) console.log("CRITICAL HIT on Trumpet!");
                        takeDamage(dmg);
                    }
                }}
                visible={false}
            >
                <boxGeometry args={[BODY_LENGTH, BODY_HEIGHT, BODY_DEPTH]} />
                <meshBasicMaterial transparent opacity={0} />
            </mesh>

            {/* Valve section */}
            <group position={[0, BODY_HEIGHT / 2 + 0.3, 0]}>
                {/* Three valves */}
                {[-0.3, 0, 0.3].map((xOffset, i) => (
                    <mesh key={i} position={[xOffset, 0, 0]}>
                        <cylinderGeometry args={[0.12, 0.12, 0.4, 8]} />
                        <meshStandardMaterial color={valveColor} roughness={0.4} metalness={0.7} />
                    </mesh>
                ))}

                {/* Valve caps */}
                {[-0.3, 0, 0.3].map((xOffset, i) => (
                    <mesh key={`cap-${i}`} position={[xOffset, 0.25, 0]}>
                        <sphereGeometry args={[0.1, 8, 8]} />
                        <meshStandardMaterial color={brassHighlight} roughness={0.2} metalness={0.9} />
                    </mesh>
                ))}
            </group>

            {/* Tubing curves (simplified) */}
            <mesh position={[0, BODY_HEIGHT / 2 - 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[0.3, 0.08, 8, 16, Math.PI]} />
                <meshStandardMaterial color={brassColor} roughness={0.3} metalness={0.8} emissive={brassColor} emissiveIntensity={0.05} />
            </mesh>

            {/* Health bar above enemy - Only visible when playing */}
            {gameState === 'playing' && (
                <group position={[0, BODY_HEIGHT + 0.4, 0]}>
                    <Html center distanceFactor={12}>
                        <div className="flex flex-col items-center pointer-events-none">
                            {damageNumber && Date.now() - damageNumber.time < 1000 && (
                                <div className="absolute -top-12 text-red-400 font-bold text-lg text-shadow-sm animate-bounce whitespace-nowrap">
                                    -{damageNumber.value}
                                </div>
                            )}

                            <div className="flex items-center gap-2 bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm mb-1">
                                <span className="text-yellow-400 font-bold text-xs">LV {level}</span>
                            </div>

                            <div className="w-24 h-2 bg-gray-900 border border-white/20 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-red-500 transition-[width] duration-75"
                                    style={{ width: `${(health / TRUMPET_HEALTH) * 100}%` }}
                                />
                            </div>
                        </div>
                    </Html>
                </group>
            )}
        </group>
    );
}

export default Trumpet;
