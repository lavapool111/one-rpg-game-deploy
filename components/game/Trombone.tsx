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
const ATTACK_RANGE_SLIDE = 8; // feet (melee poke)
const SIGHT_RANGE = 100; // feet
const GLISSANDO_DURATION = 5; // seconds
const GLISSANDO_COOLDOWN = 20; // seconds
const SLIDE_COOLDOWN = 20; // seconds

// Dimensions in feet
const BODY_LENGTH = 5; // Longer than trumpet (3)
const BODY_HEIGHT = 2;
const BODY_DEPTH = 2;

// Trombone damage scaling factor (base for Glissando)
const GLISSANDO_SCALE_F = 0.15;
const GLISSANDO_SCALE_FF = 0.20;
const GLISSANDO_SCALE_FFF = 0.30;
const SLIDE_SCALE = 5.0;

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

function roundToTenths(value: number): number {
    return Math.round(value * 10) / 10;
}

/**
 * Calculate Trombone stats for a given level
 * Uses same base stats as player from getStatsForLevel(), then applies enemy multipliers
 */
function getTromboneStats(level: number): { health: number; damage: number; xp: number } {
    const baseStats = getStatsForLevel(level);

    // Health: base stats * 3x enemy multiplier * HP scaling
    const hpMultiplier = getEnemyHpMultiplier(level);
    const health = roundToTenths(baseStats.health * 3 * hpMultiplier);

    // Damage: use base stats damage directly (scaled in attack logic)
    const damage = baseStats.damage;

    // XP formula: 1.5x Trumpet XP
    const xp = (1 + (level - 1) * 0.1) * 1.5;

    return { health, damage, xp };
}

interface TromboneProps {
    id: string;
    initialPosition: [number, number, number];
    level?: number;
    onDeath?: (id: string) => void;
    pillars?: Pillar[];
    arenaRadius?: number;
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

export function Trombone({ id, initialPosition, level = 1, onDeath, pillars = [], arenaRadius = 375 }: TromboneProps) {
    const groupRef = useRef<Group>(null);
    const slideRef = useRef<Group>(null);
    const { camera } = useThree();
    const gameState = useGameStore((state) => state.gameState);

    const stats = getTromboneStats(level);
    const MAX_HEALTH = stats.health;
    const XP_REWARD = stats.xp;
    // We store base damage to apply multipliers dynamically
    const BASE_DAMAGE = stats.damage;

    // Enemy state
    const [health, setHealth] = useState(MAX_HEALTH);
    const [isAlive, setIsAlive] = useState(true);
    const rewardGranted = useRef(false);

    // Cooldowns
    const lastGlissandoTime = useRef(0);
    const lastSlideTime = useRef(0);
    const glissandoStartTime = useRef(0);

    // Damage logic state - use selective subscriptions to avoid mass re-renders
    const isLongToneActive = usePlayerStore((state) => state.isLongToneActive);
    const basicAttackDamage = usePlayerStore((state) => state.basicAttackDamage);
    const [damageNumber, setDamageNumber] = useState<{ value: number, time: number } | null>(null);

    // Movement vectors
    const enemyPos = useRef(new Vector3(...initialPosition));
    const playerPos = useRef(new Vector3());
    const direction = useRef(new Vector3());
    const playerDistanceRef = useRef(0); // For health bar visibility
    const frameCounter = useRef(0); // For tiered frame skip

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

    useFrame((state, delta) => {
        // Cap delta to prevent huge jumps after frame stalls (e.g., shader compilation)
        const cappedDelta = Math.min(delta, 0.1);

        if (!groupRef.current || !isAlive || gameState !== 'playing') return;

        const currentTime = state.clock.elapsedTime;
        camera.getWorldPosition(playerPos.current);
        const currentLocation = useGameStore.getState().currentLocation;
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

                const pokeDmg = BASE_DAMAGE * SLIDE_SCALE;
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
                const moveDistance = TROMBONE_SPEED * cappedDelta;

                // Calculate proposed new position
                const newX = enemyPos.current.x + direction.current.x * moveDistance;
                const newZ = enemyPos.current.z + direction.current.z * moveDistance;

                // Dungeon Collision Check
                if (currentLocation === 'backstage_halls') {
                    const oldX = enemyPos.current.x;
                    const oldZ = enemyPos.current.z;
                    const isValidMove = isValidDungeonPosition(newX, newZ, 1.0);

                    if (isValidMove) {
                        enemyPos.current.x = newX;
                        enemyPos.current.z = newZ;
                    } else {
                        // Try sliding
                        if (isValidDungeonPosition(newX, oldZ, 1.0)) {
                            enemyPos.current.x = newX;
                        }
                        if (isValidDungeonPosition(oldX, newZ, 1.0)) {
                            enemyPos.current.z = newZ;
                        }
                    }
                } else {
                    enemyPos.current.x = newX;
                    enemyPos.current.z = newZ;
                }

                // Apply Gravity (Floor Height)
                const floorY = getFloorHeightAt(enemyPos.current.x, enemyPos.current.z, enemyPos.current.y, 0.3, currentLocation);
                enemyPos.current.y = floorY + (BODY_HEIGHT / 2); // Center of body

                // Collision (only check nearby pillars)
                const nearbyPillars = getNearbyPillars({ x: enemyPos.current.x, z: enemyPos.current.z }, pillars, 15);
                const radius = BODY_LENGTH / 2;
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
            }
        } else if (!canSeePlayer && !isSlideAttacking && !isGlissandoActive) {
            // Idle wander at 2/3 speed
            if (currentTime - lastWanderChange.current > WANDER_CHANGE_INTERVAL) {
                wanderDirection.current.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                lastWanderChange.current = currentTime;
            }

            const wanderSpeed = (TROMBONE_SPEED * 2 / 3) * cappedDelta;

            // Calculate proposed new position
            const newX = enemyPos.current.x + wanderDirection.current.x * wanderSpeed;
            const newZ = enemyPos.current.z + wanderDirection.current.z * wanderSpeed;

            // Dungeon Collision Check
            if (currentLocation === 'backstage_halls') {
                const oldX = enemyPos.current.x;
                const oldZ = enemyPos.current.z;
                const isValidMove = isValidDungeonPosition(newX, newZ, 1.0);

                if (isValidMove) {
                    enemyPos.current.x = newX;
                    enemyPos.current.z = newZ;
                } else {
                    // Try sliding
                    if (isValidDungeonPosition(newX, oldZ, 1.0)) {
                        enemyPos.current.x = newX;
                    }
                    if (isValidDungeonPosition(oldX, newZ, 1.0)) {
                        enemyPos.current.z = newZ;
                    }
                    // If blocked, change wander direction? 
                    if (!isValidMove && !isValidDungeonPosition(newX, oldZ, 1.0) && !isValidDungeonPosition(oldX, newZ, 1.0)) {
                        wanderDirection.current.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                    }
                }
            } else {
                enemyPos.current.x = newX;
                enemyPos.current.z = newZ;
            }

            // Apply Gravity (Floor Height)
            const floorY = getFloorHeightAt(enemyPos.current.x, enemyPos.current.z, enemyPos.current.y, 0.3, currentLocation);
            enemyPos.current.y = floorY + (BODY_HEIGHT / 2); // Center of body

            // Pillar collision (only check nearby pillars)
            const nearbyPillarsW = getNearbyPillars({ x: enemyPos.current.x, z: enemyPos.current.z }, pillars, 15);
            const radiusW = BODY_LENGTH / 2;
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
        if (isLongToneActive) {
            // ... existing logic ...
            const now = state.clock.elapsedTime;
            // Need ref for tick rate
            // ... omitting for brevity, copy from Trumpet if needed or assume shared logic later ...
            // Copying basic check:
            const dist = groupRef.current.position.distanceTo(playerPos.current);
            if (dist < 20 && now - lastGlissandoTime.current > 0.5) {
                // Formula: (Damage * 0.15) - Defense(0)
                // playerDamage is already scaled
                const { critChance, critFactor, damage: playerDamage } = usePlayerStore.getState();
                const isCrit = Math.random() < critChance;
                const critMult = isCrit ? critFactor : 1.0;

                const rawDamage = (playerDamage * 0.15) * critMult;
                const finalDamage = Math.max(0, rawDamage); // Defense 0

                if (finalDamage > 0) {
                    takeDamage(finalDamage);
                    lastGlissandoTime.current = now;
                }
            }
        }
    });

    // Death & XP
    useEffect(() => {
        if (health <= 0 && isAlive && !rewardGranted.current) {
            rewardGranted.current = true;
            setIsAlive(false);
            const playerStore = usePlayerStore.getState();
            // Use registerKill for Tempo system (handles XP with bonus)
            playerStore.registerKill(level, 1.5); // Trombone gives 1.5x XP
            playerStore.addEmbouchureXp(35);

            // Drops Logic
            const gameStore = useGameStore.getState();
            const currentLocation = gameStore.currentLocation;

            if (currentLocation === 'backstage_halls') {
                // Backstage Halls: Gold only
                gameStore.collectGold(4);
            } else {
                // Band Room: Materials & Echoes
                const echoes = Math.floor(Math.random() * 2) + 2; // 2-3 Echoes
                playerStore.collectEchoes(echoes);

                if (Math.random() < 0.50) playerStore.addMaterial('trombone_slides', 1);
                if (Math.random() < 0.45) playerStore.addMaterial('sheet_music_fragments', 1);
                if (Math.random() < 0.30) playerStore.addMaterial('brass_ingots', 1);
            }

            onDeath?.(id);
        }
    }, [health, isAlive, id, onDeath, XP_REWARD, level]);

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

    // Visuals
    const isBuffing = isGlissandoActive;

    return (
        <group ref={groupRef} position={initialPosition}>
            {/* Slide Part (animated) - glows red when charging */}
            <group ref={slideRef} position={[0, BODY_HEIGHT / 2, 1]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} geometry={slideGeo} material={isSlideCharging ? slideMatCharging : slideMat} />
            </group>

            {/* Main Body */}
            <mesh position={[0, BODY_HEIGHT / 2, -0.5]} rotation={[Math.PI / 2, 0, 0]} geometry={mainBodyGeo} material={isBuffing ? mainBodyMatBuffing : mainBodyMat} />

            {/* Bell */}
            <mesh position={[0, BODY_HEIGHT / 2, 2]} rotation={[-Math.PI / 2, 0, 0]} geometry={bellGeo} material={isSlideAttacking ? bellMatAttacking : bellMat} />

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
                        const { critChance, critFactor } = usePlayerStore.getState();
                        const isCrit = Math.random() < critChance;
                        const critMult = isCrit ? critFactor : 1.0;

                        const dmg = basicAttackDamage * critMult;
                        if (isCrit) console.log("CRITICAL HIT on Trombone!");
                        takeDamage(dmg);
                    }
                }}
                visible={false}
                geometry={hitboxGeo}
                material={hitboxMat}
            />

            {/* Health Bar UI - Only visible when playing and within 175ft */}
            {gameState === 'playing' && playerDistanceRef.current <= 175 && (
                <group position={[0, BODY_HEIGHT + 1, 0]}>
                    <Html center distanceFactor={15}>
                        <div className="flex flex-col items-center pointer-events-none">
                            {damageNumber && Date.now() - damageNumber.time < 1000 && (
                                <div className="absolute -top-12 text-red-500 font-bold text-xl animate-bounce">
                                    -{damageNumber.value}
                                </div>
                            )}
                            <div className="bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm mb-1">
                                <span className="text-orange-400 font-bold text-sm">TB LV {level}</span>
                            </div>
                            <div className="w-32 h-3 bg-gray-900 border border-white/20 rounded-full overflow-hidden">
                                <div className="h-full bg-orange-600 transition-[width] duration-75" style={{ width: `${(health / MAX_HEALTH) * 100}%` }} />
                            </div>
                        </div>
                    </Html>
                </group>
            )}
        </group>
    );
}

export default Trombone;
