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
 * French Horn Enemy Component
 * 
 * Ability: "Closing Bell"
 * - Stuns player for 0.5s - 2s
 * - Buffs self defense by 35% - 70%
 * - No direct damage abilities
 * 
 * Dimensions: 2 × 1.5 × 1.5 feet
 * Speed: 3.75 ft/s (+0.075 per level)
 * Health: 2.4x scaling
 */

// Constants
const BASE_SPEED = 3.75; // ft/s
const SPEED_PER_LEVEL = 0.075;
const ABILITY_RANGE = 15; // feet - Range for Closing Bell
const ABILITY_COOLDOWN = 6.0; // seconds
const SIGHT_RANGE = 100;

// Dimensions in feet
const BODY_WIDTH = 2; // X
const BODY_HEIGHT = 1.5; // Y
const BODY_DEPTH = 1.5; // Z

// Helper function to round to one decimal place
const roundToTenths = (value: number) => Math.round(value * 10) / 10;

/**
 * Calculate French Horn stats
 * Uses same base stats as player from getStatsForLevel(), then applies enemy multipliers
 */
function getFrenchHornStats(level: number): { health: number; speed: number; xp: number } {
    const baseStats = getStatsForLevel(level);

    // Health: base stats * 2.4x enemy multiplier * HP scaling
    const hpMultiplier = getEnemyHpMultiplier(level);
    const health = roundToTenths(baseStats.health * 2.4 * hpMultiplier);

    // Speed: 3.75 + 0.075 * level
    const speed = BASE_SPEED + (SPEED_PER_LEVEL * level);

    // XP: Higher base than Trumpet due to tankiness
    const xp = 2 + (level - 1) * 0.15;

    return { health, speed, xp };
}

interface FrenchHornProps {
    id: string;
    initialPosition: [number, number, number];
    level?: number;
    onDeath?: (id: string) => void;
    pillars?: Pillar[];
    arenaRadius?: number;
}

const hornColor = '#8B4513'; // Darker Brass
const buffColor = '#4444ff'; // Blue glow

// Geometries
const outerCoilGeo = new THREE.TorusGeometry(0.6, 0.12, 12, 24);
const innerCoilGeo = new THREE.TorusGeometry(0.35, 0.1, 10, 20);
const bellThroatGeo = new THREE.CylinderGeometry(0.2, 0.12, 0.4, 16);
const bellFlareGeo = new THREE.CylinderGeometry(0.5, 0.2, 0.4, 16, 1, true);
const interiorGlowGeo = new THREE.CylinderGeometry(0.48, 0.15, 0.38, 16, 1, true);
const valveBodyGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8);
const valveKeyGeo = new THREE.BoxGeometry(0.4, 0.05, 0.1);
const leadPipeGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.6, 8);
const hitboxGeo = new THREE.BoxGeometry(BODY_WIDTH, BODY_HEIGHT, BODY_DEPTH);

// Materials
const hornMat = new THREE.MeshStandardMaterial({
    color: hornColor,
    roughness: 0.3,
    metalness: 0.8
});
const buffMat = new THREE.MeshStandardMaterial({
    color: buffColor,
    roughness: 0.3,
    metalness: 0.8,
    emissive: buffColor,
    emissiveIntensity: 0.5
});
const interiorMat = new THREE.MeshStandardMaterial({
    color: "#332200",
    roughness: 0.9
});
const valveBodyMat = new THREE.MeshStandardMaterial({
    color: "#888888",
    metalness: 0.5
});
const valveKeyMat = new THREE.MeshStandardMaterial({
    color: "#aaaaaa"
});
const hitboxMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0
});

export function FrenchHorn({ id, initialPosition, level = 1, onDeath, pillars = [], arenaRadius = 375 }: FrenchHornProps) {
    const groupRef = useRef<Group>(null);
    const { camera } = useThree();
    const gameState = useGameStore((state) => state.gameState);

    // Stats
    const stats = getFrenchHornStats(level);
    const MAX_HEALTH = stats.health;
    const MOVEMENT_SPEED = stats.speed;
    const XP_VALUE = stats.xp;

    // State
    const [health, setHealth] = useState(MAX_HEALTH);
    const [isAlive, setIsAlive] = useState(true);
    const [defenseBuff, setDefenseBuff] = useState(0); // 0.0 to 0.7
    const lastAbilityTime = useRef(0);
    const rewardGranted = useRef(false);

    // Damage logic
    const isLongToneActive = usePlayerStore((state) => state.isLongToneActive);
    const playerDamage = usePlayerStore((state) => state.damage);
    const basicAttackDamage = usePlayerStore((state) => state.basicAttackDamage);
    const applyStun = usePlayerStore((state) => state.applyStun);

    const lastTickTime = useRef(0);
    const TICK_RATE = 0.5;
    const [damageNumber, setDamageNumber] = useState<{ value: number, time: number } | null>(null);

    // Vectors
    const enemyPos = useRef(new Vector3(...initialPosition));
    const playerPos = useRef(new Vector3());
    const direction = useRef(new Vector3());
    const playerDistanceRef = useRef(0); // For health bar visibility
    const frameCounter = useRef(0); // For tiered frame skip

    // Wander state
    const wanderDirection = useRef(new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize());
    const lastWanderChange = useRef(0);
    const WANDER_CHANGE_INTERVAL = 3 + Math.random() * 2;

    // Animation state
    const [isUsingAbility, setIsUsingAbility] = useState(false);

    // Fade in
    const [isReady, setIsReady] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setIsReady(true), 50);
        return () => clearTimeout(t);
    }, []);

    // Main Loop
    useFrame((state, delta) => {
        // Cap delta to prevent huge jumps after frame stalls (e.g., shader compilation)
        const cappedDelta = Math.min(delta, 0.1);

        if (!groupRef.current || !isAlive || gameState !== 'playing') return;

        camera.getWorldPosition(playerPos.current);
        const distanceToPlayer = enemyPos.current.distanceTo(playerPos.current);
        playerDistanceRef.current = distanceToPlayer; // Update for health bar visibility

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
            groupRef.current.position.copy(enemyPos.current);
            return;
        }

        // Calculate direction
        direction.current.copy(playerPos.current).sub(enemyPos.current);
        direction.current.y = 0;
        direction.current.normalize();

        // Check Zone LOS to prevent aggro through walls
        const getZone = (pos: Vector3) => {
            const { x, z } = pos;
            if (z >= 25 && x >= -6 && x <= 6) return 'center'; // Center Corridor
            if (x >= 25 && z >= -6 && z <= 6) return 'right'; // Right Corridor
            if (x <= -25 && z >= -6 && z <= 6) return 'left'; // Left Corridor
            if (x >= -15 && x <= 15 && z >= -25 && z <= 25) return 'hub'; // Hub
            return 'other';
        };

        const enemyZone = getZone(enemyPos.current);
        const playerZone = getZone(playerPos.current);
        const currentLocation = useGameStore.getState().currentLocation;

        // LOS if in same zone, or one is in Hub (which connects to all)
        // Note: This is a simplification. Real LOS would trace a ray.
        // But for Backstage Halls' layout (Hub + 3 straight corridors), this works well.
        // Exception: Hub to deep corridor might be blocked by corner, but strict wall collision handles movement.
        // This is mainly to stop "seeing" through the wall between Center and Right corridors.
        const hasZoneLOS =
            (enemyZone === playerZone) ||
            (enemyZone === 'hub' && ['center', 'left', 'right'].includes(playerZone)) ||
            (playerZone === 'hub' && ['center', 'left', 'right'].includes(enemyZone));

        const canSeePlayer = distanceToPlayer <= SIGHT_RANGE && hasZoneLOS;
        const currentTime = state.clock.elapsedTime;

        // === MOVEMENT LOGIC ===
        // Move towards player if seen. Keep moving even in ability range (chase down).
        // Only stop if literally touching (e.g. < 2ft)? No, let it push against player.

        let moveVec = new Vector3();
        if (canSeePlayer) {
            // Updated AI: Maintain optimal range (10-15ft) instead of rushing
            if (distanceToPlayer > ABILITY_RANGE) {
                // Too far: Chase
                moveVec.copy(direction.current).multiplyScalar(MOVEMENT_SPEED * cappedDelta);
            } else if (distanceToPlayer < 10) {
                // Too close: Retreat
                moveVec.copy(direction.current).multiplyScalar(-MOVEMENT_SPEED * 0.8 * cappedDelta);
            } else {
                // Sweet spot: Strafe or Hold
                // Minimal strafing to feel alive
                const strafeDir = new Vector3(-direction.current.z, 0, direction.current.x);
                moveVec.copy(strafeDir).multiplyScalar(MOVEMENT_SPEED * 0.3 * cappedDelta * Math.sin(currentTime));
            }
        } else {
            // Wander
            if (currentTime - lastWanderChange.current > WANDER_CHANGE_INTERVAL) {
                wanderDirection.current.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                lastWanderChange.current = currentTime;
            }
            moveVec.copy(wanderDirection.current).multiplyScalar(MOVEMENT_SPEED * 0.6 * cappedDelta);
        }

        // Apply movement with collision
        const newX = enemyPos.current.x + moveVec.x;
        const newZ = enemyPos.current.z + moveVec.z;

        // Dungeon Collision
        if (currentLocation === 'backstage_halls') {
            const isValidMove = isValidDungeonPosition(newX, newZ, 1.0);
            if (isValidMove) {
                enemyPos.current.x = newX;
                enemyPos.current.z = newZ;
            } else {
                if (isValidDungeonPosition(newX, enemyPos.current.z, 1.0)) enemyPos.current.x = newX;
                if (isValidDungeonPosition(enemyPos.current.x, newZ, 1.0)) enemyPos.current.z = newZ;
            }
        } else {
            enemyPos.current.x = newX;
            enemyPos.current.z = newZ;
        }

        // Apply Gravity (Floor Height)
        const floorY = getFloorHeightAt(enemyPos.current.x, enemyPos.current.z, enemyPos.current.y, 0.3, currentLocation);
        enemyPos.current.y = floorY + (BODY_HEIGHT / 2); // Center of body

        // Pillar Collision
        const nearbyPillars = getNearbyPillars({ x: enemyPos.current.x, z: enemyPos.current.z }, pillars, 15);
        const bodyRadius = 1.0;

        for (const pillar of nearbyPillars) {
            const minDist = pillar.radius * 1.5 + bodyRadius;
            const dx = enemyPos.current.x - pillar.x;
            const dz = enemyPos.current.z - pillar.z;
            const distSq = dx * dx + dz * dz;

            if (distSq < minDist * minDist) {
                const dist = Math.sqrt(distSq);
                const pushDir = dist > 0.001 ? { x: dx / dist, z: dz / dist } : { x: 1, z: 0 };
                enemyPos.current.x = pillar.x + pushDir.x * minDist;
                enemyPos.current.z = pillar.z + pushDir.z * minDist;
            }
        }

        // Arena Boundary
        const distFromCenter = Math.sqrt(enemyPos.current.x ** 2 + enemyPos.current.z ** 2);
        if (distFromCenter > arenaRadius) {
            const angle = Math.atan2(enemyPos.current.z, enemyPos.current.x);
            const resetDist = arenaRadius * 0.95;
            enemyPos.current.x = Math.cos(angle) * resetDist;
            enemyPos.current.z = Math.sin(angle) * resetDist;
        }

        // Apply Position and Rotation
        groupRef.current.position.copy(enemyPos.current);

        if (canSeePlayer && direction.current.length() > 0.01) {
            const angle = Math.atan2(direction.current.x, direction.current.z);
            groupRef.current.rotation.y = angle;
        } else if (!canSeePlayer && wanderDirection.current.length() > 0.01) {
            const angle = Math.atan2(wanderDirection.current.x, wanderDirection.current.z);
            groupRef.current.rotation.y = angle;
        }


        // === ABILITY LOGIC: CLOSING BELL ===
        if (canSeePlayer && distanceToPlayer <= ABILITY_RANGE && currentTime - lastAbilityTime.current >= ABILITY_COOLDOWN) {
            // Check LOS
            const hasLOS = pillars.length === 0 || checkLineOfSight(
                { x: enemyPos.current.x, z: enemyPos.current.z },
                { x: playerPos.current.x, z: playerPos.current.z },
                pillars
            );

            if (hasLOS) {
                lastAbilityTime.current = currentTime;
                setIsUsingAbility(true); // Visual indicator

                // 1. Stun Player
                // Duration: Stun increases by 0.01 second, starts at 0.5s. Cap 2s.
                const stunDurationRaw = 0.5 + (level * 0.01);
                const stunDuration = Math.min(2.0, stunDurationRaw);
                applyStun(stunDuration);

                // 2. Self Buff Defense
                // Base 35% (0.35). Increases by 0.1% (0.001). Cap 70% (0.70).
                const defRaw = 0.35 + (level * 0.001);
                const defenseAmount = Math.min(0.70, defRaw);

                // Duration: 2s + 0.03s per level. Cap 4s.
                const defDurationRaw = 2.0 + (level * 0.03);
                const defDuration = Math.min(4.0, defDurationRaw);

                setDefenseBuff(defenseAmount);
                console.log(`French Horn used Closing Bell! Stun: ${stunDuration.toFixed(2)}s, Def: ${(defenseAmount * 100).toFixed(1)}% for ${defDuration.toFixed(2)}s`);

                // Remove defense buff after duration
                setTimeout(() => {
                    setDefenseBuff(0);
                }, defDuration * 1000);

                // End animation
                setTimeout(() => setIsUsingAbility(false), 500);
            }
        }


        // === INCOMING DAMAGE (Long Tone) ===
        if (isLongToneActive && currentTime - lastTickTime.current >= TICK_RATE) {
            const dist = groupRef.current.position.distanceTo(playerPos.current);
            if (dist < 20) {
                const hasLOS = pillars.length === 0 || checkLineOfSight(
                    { x: playerPos.current.x, z: playerPos.current.z },
                    { x: enemyPos.current.x, z: enemyPos.current.z },
                    pillars
                );

                if (hasLOS) {
                    const { critChance, critFactor } = usePlayerStore.getState();
                    const isCrit = Math.random() < critChance;
                    const dmg = (playerDamage * 0.15) * (isCrit ? critFactor : 1.0);
                    takeDamage(dmg);
                    lastTickTime.current = currentTime;
                }
            }
        }

        // Visuals: Pulse scale when using ability or buffed
        if (isUsingAbility) {
            groupRef.current.scale.setScalar(1.2);
        } else if (defenseBuff > 0) {
            // Pulse slowly when buffed
            const s = 1.0 + Math.sin(currentTime * 10) * 0.1;
            groupRef.current.scale.setScalar(s);
        } else {
            groupRef.current.scale.lerp(new Vector3(1, 1, 1), 0.1);
        }
    });

    // Take Damage
    const takeDamage = (amount: number) => {
        // Apply Defense Buff
        const reducedAmount = Math.max(0, amount * (1.0 - defenseBuff));

        const nextHealth = Math.max(0, health - reducedAmount);
        setHealth(nextHealth);
        setDamageNumber({ value: Number(reducedAmount.toFixed(1)), time: Date.now() });

        if (reducedAmount < amount && defenseBuff > 0) {
            // Visual indication of blocked damage? Maybe blue text?
        }
    };

    // Handle Death
    useEffect(() => {
        if (health <= 0 && isAlive && !rewardGranted.current) {
            rewardGranted.current = true;
            setIsAlive(false);

            const playerStore = usePlayerStore.getState();
            playerStore.registerKill(level, 2.5); // French Horn gives 2.5x XP
            playerStore.addEmbouchureXp(25); // Slightly more than Trumpet

            // Drops
            const echoes = Math.floor(Math.random() * 2) + 2; // 2-3 Echoes
            playerStore.collectEchoes(echoes);

            // 50% Valve
            if (Math.random() < 0.50) playerStore.addMaterial('valves', 1);

            // 75% Sheet Music
            if (Math.random() < 0.75) playerStore.addMaterial('sheet_music_fragments', 1);

            // 20% Choice (Extra Sheet Music OR Slide OR Oil)
            if (Math.random() < 0.20) {
                const roll = Math.random();
                if (roll < 0.33) playerStore.addMaterial('sheet_music_fragments', 1);
                else if (roll < 0.66) playerStore.addMaterial('trombone_slides', 1);
                else playerStore.addMaterial('valve_oil', 1);
            }

            onDeath?.(id);
        }
    }, [health, isAlive, id, level, onDeath]);

    if (!isAlive || !isReady) return null;

    const isBuffed = defenseBuff > 0;

    return (
        <group ref={groupRef} position={initialPosition}>
            {/* --- French Horn Composite Geometry --- */}
            {/* Visual Offset to center the mass */}
            <group position={[0, BODY_HEIGHT / 2, 0]}>

                {/* 1. Main Outer Coil (Large Wrap) */}
                <mesh rotation={[Math.PI / 2, 0, 0]} geometry={outerCoilGeo} material={isBuffed ? buffMat : hornMat} />

                {/* 2. Inner Coil (Smaller Wrap for complexity) */}
                <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.05]} geometry={innerCoilGeo} material={isBuffed ? buffMat : hornMat} />

                {/* 3. The Bell (Large flair pointing backward/sideways) */}
                {/* Positioned on the left side, flaring back */}
                <group position={[0.5, 0.2, 0.3]} rotation={[0, 0, -Math.PI / 6]}>
                    {/* Bell Throat */}
                    <mesh position={[0, -0.2, 0]} geometry={bellThroatGeo} material={isBuffed ? buffMat : hornMat} />
                    {/* Bell Flare */}
                    <mesh position={[0, 0.1, 0]} geometry={bellFlareGeo} material={isBuffed ? buffMat : hornMat} />
                    {/* Interior glow/darkness */}
                    <mesh position={[0, 0.05, 0]} geometry={interiorGlowGeo} material={interiorMat} />
                </group>

                {/* 4. Rotary Valves (Cluster in center) */}
                <group position={[-0.1, 0.1, 0]}>
                    <mesh position={[0, 0, -0.1]} geometry={valveBodyGeo} material={valveBodyMat} />
                    <mesh position={[0.15, 0, -0.05]} geometry={valveBodyGeo} material={valveBodyMat} />
                    <mesh position={[-0.15, 0, -0.05]} geometry={valveBodyGeo} material={valveBodyMat} />

                    {/* Valve Levers/Keys */}
                    <mesh position={[0, 0.2, -0.05]} rotation={[0, 0, Math.PI / 2]} geometry={valveKeyGeo} material={valveKeyMat} />
                </group>

                {/* 5. Leadpipe (Connection to mouthpiece) */}
                <mesh position={[-0.5, 0.1, -0.2]} rotation={[0, 0, Math.PI / 4]} geometry={leadPipeGeo} material={isBuffed ? buffMat : hornMat} />

            </group>

            {/* Click Hitbox */}
            <mesh onClick={(e) => {
                e.stopPropagation();
                const dist = enemyPos.current.distanceTo(playerPos.current);
                if (dist > 30) return;

                const hasLOS = pillars.length === 0 || checkLineOfSight(
                    { x: playerPos.current.x, z: playerPos.current.z },
                    { x: enemyPos.current.x, z: enemyPos.current.z },
                    pillars
                );

                if (hasLOS) {
                    const { critChance, critFactor } = usePlayerStore.getState();
                    const isCrit = Math.random() < critChance;
                    const dmg = basicAttackDamage * (isCrit ? critFactor : 1.0);
                    if (isCrit) console.log("CRIT!");
                    takeDamage(dmg);
                }
            }} visible={false}
                geometry={hitboxGeo}
                material={hitboxMat}
            />

            {/* Health Bar - Only visible when playing and within 175ft */}
            {gameState === 'playing' && playerDistanceRef.current <= 175 && (
                <group position={[0, BODY_HEIGHT + 0.5, 0]}>
                    <Html center distanceFactor={12}>
                        <div className="flex flex-col items-center pointer-events-none">
                            {damageNumber && Date.now() - damageNumber.time < 1000 && (
                                <div className="absolute -top-12 text-red-400 font-bold text-lg text-shadow-sm animate-bounce whitespace-nowrap">
                                    -{damageNumber.value}
                                </div>
                            )}

                            <div className="flex items-center gap-2 bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm mb-1">
                                <span className="text-yellow-400 font-bold text-xs">LV {level}</span>
                                {defenseBuff > 0 && <span className="text-blue-400 font-bold text-xs">🛡️</span>}
                            </div>

                            <div className="w-24 h-2 bg-gray-900 border border-white/20 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-red-500 transition-[width] duration-75"
                                    style={{ width: `${(health / MAX_HEALTH) * 100}%` }}
                                />
                            </div>
                        </div>
                    </Html>
                </group>
            )}
        </group>
    );
}

export default FrenchHorn;
