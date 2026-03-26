import { useRef, useState, useEffect, useMemo, createContext, useContext } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import * as THREE from 'three';
import { usePlayerStore, useGameStore, useAccessoryStore, useInventoryStore } from '@/lib/store';
import { Merged } from '@react-three/drei';
import { EnemyHealthBar } from './EnemyHealthBar';
import { getStatsForLevel, getEnemyHpMultiplier } from '@/lib/game/stats';
import { calculateBasicAttackDamage, calculateAbilityDamage, applyDefenseMultiplier } from '@/lib/game/damageUtils';
import { applyEnemyMovement, shouldUpdateEnemyFrame, checkZoneLineOfSight } from '@/lib/game/enemyMovement';
import { getFrenchHornDrops } from '@/lib/game/enemyDrops';
import { Pillar, checkLineOfSight } from '@/lib/game/pillars';
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
    arenaCenter?: [number, number, number];
    teleportToCenterOnOOB?: boolean;
    models?: any;
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

export const FrenchHornContext = createContext<any>(null);

export function FrenchHornInstances({ children }: { children: React.ReactNode }) {
    const meshes = useMemo(() => {
        return {
            outerCoil: new THREE.Mesh(outerCoilGeo, hornMat),
            outerCoilBuffed: new THREE.Mesh(outerCoilGeo, buffMat),
            innerCoil: new THREE.Mesh(innerCoilGeo, hornMat),
            innerCoilBuffed: new THREE.Mesh(innerCoilGeo, buffMat),
            bellThroat: new THREE.Mesh(bellThroatGeo, hornMat),
            bellThroatBuffed: new THREE.Mesh(bellThroatGeo, buffMat),
            bellFlare: new THREE.Mesh(bellFlareGeo, hornMat),
            bellFlareBuffed: new THREE.Mesh(bellFlareGeo, buffMat),
            interiorGlow: new THREE.Mesh(interiorGlowGeo, interiorMat),
            valveBody: new THREE.Mesh(valveBodyGeo, valveBodyMat),
            valveKey: new THREE.Mesh(valveKeyGeo, valveKeyMat),
            leadPipe: new THREE.Mesh(leadPipeGeo, hornMat),
            leadPipeBuffed: new THREE.Mesh(leadPipeGeo, buffMat),
        };
    }, []);

    return (
        <Merged castShadow receiveShadow frustumCulled={false} meshes={meshes}>
            {(instances) => (
                <FrenchHornContext.Provider value={instances}>
                    {children}
                </FrenchHornContext.Provider>
            )}
        </Merged>
    );
}

export function FrenchHorn({ id, initialPosition, level = 1, onDeath, pillars = [], arenaRadius = 375, arenaCenter = [0, 0, 0], teleportToCenterOnOOB = false, models: propModels }: FrenchHornProps) {
    const contextModels = useContext(FrenchHornContext);
    const models = propModels || contextModels;
    const groupRef = useRef<Group>(null);
    const healthBarRef = useRef<Group>(null);
    const { camera } = useThree();
    const gameState = useGameStore((state) => state.gameState);

    // Stats
    const stats = getFrenchHornStats(level);
    const MAX_HEALTH = stats.health;
    const MOVEMENT_SPEED = stats.speed;
    const XP_VALUE = stats.xp;

    // State - use ref for health to avoid re-renders on damage
    const healthRef = useRef(MAX_HEALTH);
    const [currentHealth, setCurrentHealth] = useState(MAX_HEALTH);
    const [isAlive, setIsAlive] = useState(true);
    const [defenseBuff, setDefenseBuff] = useState(0); // 0.0 to 0.7
    const lastAbilityTime = useRef(0);
    const rewardGranted = useRef(false);

    // Poison DOT state
    const poisonState = useRef<{ isActive: boolean; endTime: number; damagePerSecond: number }>({
        isActive: false,
        endTime: 0,
        damagePerSecond: 0
    });

    // Damage logic
    const isLongToneActive = usePlayerStore((state) => state.isLongToneActive);
    const playerDamage = usePlayerStore((state) => state.damage);
    const basicAttackDamage = usePlayerStore((state) => state.basicAttackDamage);
    const applyStun = usePlayerStore((state) => state.applyStun);

    const lastTickTime = useRef(0);
    const BASE_TICK_RATE = 0.5;
    const damageNumberRef = useRef<{ value: number, time: number, type?: 'normal' | 'crit' | 'superCrit' } | null>(null);

    // Vectors
    const enemyPos = useRef(new Vector3(...initialPosition));
    const playerPos = useRef(new Vector3());
    const direction = useRef(new Vector3());
    const playerDistanceRef = useRef(0); // For health bar visibility
    const frameCounter = useRef(0); // For tiered frame skip
    const accumulatedDelta = useRef(0);
    const moveVec = useRef(new Vector3());
    const strafeDirVec = useRef(new Vector3());
    const unitScale = useRef(new Vector3(1, 1, 1));

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

    // Despawn timer for high-level enemies (> player level + 20)
    if (!id.includes("wave")) {
        useEffect(() => {
            const playerLevel = usePlayerStore.getState().level;
            const levelThreshold = playerLevel + 20;

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

    // Main Loop
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
            // 10.0 distance to match user's previous preference in this file
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
        const distanceToPlayer = enemyPos.current.distanceTo(playerPos.current);
        playerDistanceRef.current = distanceToPlayer; // Update for health bar visibility

        // PERF: Hard sleep for very distant enemies — skip entire frame
        if (distanceToPlayer > 400) return;

        if (healthBarRef.current) {
            healthBarRef.current.visible = healthRef.current < MAX_HEALTH || distanceToPlayer <= SIGHT_RANGE;
        }

        // Removed DOM update


        // Tiered frame skip based on distance
        frameCounter.current++;
        accumulatedDelta.current += cappedDelta;

        if (!shouldUpdateEnemyFrame(distanceToPlayer, frameCounter.current)) {
            // Always sync position for rendering, but skip expensive calculations
            groupRef.current.position.copy(enemyPos.current);
            return;
        }

        const effectiveDelta = accumulatedDelta.current;
        accumulatedDelta.current = 0;

        // Calculate direction
        direction.current.copy(playerPos.current).sub(enemyPos.current);
        direction.current.y = 0;
        direction.current.normalize();

        const currentLocation = useGameStore.getState().currentLocation;

        // Check Zone LOS to prevent aggro through walls
        const hasZoneLOS = checkZoneLineOfSight(enemyPos.current, playerPos.current);

        const canSeePlayer = distanceToPlayer <= SIGHT_RANGE && hasZoneLOS;
        const currentTime = state.clock.elapsedTime;

        // === MOVEMENT LOGIC ===
        // Move towards player if seen. Keep moving even in ability range (chase down).
        // Only stop if literally touching (e.g. < 2ft)? No, let it push against player.

        moveVec.current.set(0, 0, 0);
        // To prevent extreme strafing speeds.
        let one = Math.min(15, MOVEMENT_SPEED * 0.3)

        if (canSeePlayer) {
            // Updated AI: Maintain optimal range (10-15ft) instead of rushing
            if (distanceToPlayer > ABILITY_RANGE) {
                // Too far: Chase
                moveVec.current.copy(direction.current).multiplyScalar(one * effectiveDelta);
            } else if (distanceToPlayer < 10) {
                // Too close: Retreat
                moveVec.current.copy(direction.current).multiplyScalar(-MOVEMENT_SPEED * 0.8 * effectiveDelta);
            } else {
                // Sweet spot: Strafe or Hold
                // Minimal strafing to feel alive
                strafeDirVec.current.set(-direction.current.z, 0, direction.current.x);
                moveVec.current.copy(strafeDirVec.current).multiplyScalar(one * effectiveDelta * Math.sin(currentTime));
            }
        } else {
            // Wander
            if (currentTime - lastWanderChange.current > WANDER_CHANGE_INTERVAL) {
                wanderDirection.current.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                lastWanderChange.current = currentTime;
            }
            moveVec.current.copy(wanderDirection.current).multiplyScalar(one * effectiveDelta);
        }

        // Apply movement with collision
        const { didCollide } = applyEnemyMovement({
            currentPos: enemyPos.current,
            moveDirection: moveVec.current,
            moveDistance: 1, // Using moveVec for both direction and distance
            currentLocation,
            bodyHeight: BODY_HEIGHT,
            bodyRadius: 1.0,
            pillars,
            arenaCenter: arenaCenter || [0, 0, 0] as unknown as [number, number, number],
            arenaRadius: arenaRadius || 375,
            teleportToCenterOnOOB
        });

        if (didCollide && !canSeePlayer) {
            wanderDirection.current.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
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

                // 3. Horn Retaliation - Player deals damage back if using "Silenced" enchantment
                const playerState = usePlayerStore.getState();
                const enchantmentBonus = useAccessoryStore.getState().getEnchantmentBonus();
                if (enchantmentBonus.hornRetaliationDamage > 0) {
                    const retaliationDmg = playerState.basicAttackDamage * enchantmentBonus.hornRetaliationDamage;
                    takeDamage(retaliationDmg);
                    console.log(`Horn Retaliation! French Horn took ${retaliationDmg.toFixed(1)} damage.`);
                }

                // Remove defense buff after duration
                setTimeout(() => {
                    setDefenseBuff(0);
                }, defDuration * 1000);

                // End animation
                setTimeout(() => setIsUsingAbility(false), 500);
            }
        }


        // === INCOMING DAMAGE (Long Tone) ===
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

                if (dist < effectiveRange) {
                    const hasLOS = pillars.length === 0 || checkLineOfSight(
                        { x: playerPos.current.x, z: playerPos.current.z },
                        { x: enemyPos.current.x, z: enemyPos.current.z },
                        pillars
                    );

                    if (hasLOS) {
                        const { critChance } = playerState;
                        const { critFactor } = useAccessoryStore.getState();

                        // Add ability upgrade crit chance
                        const totalCritChance = critChance + (abilityStats.critChance || 0);
                        const isCrit = Math.random() < totalCritChance;
                        let isSuperCrit = false;
                        if (totalCritChance > 1.0) {
                            const totalSuperCritChance = (totalCritChance - 1.0) / 10;
                            if (Math.random() < totalSuperCritChance) {
                                isSuperCrit = true;
                            }
                        }

                        // Calculate damage with all bonuses including impactBonus (Tier 2 Brute Force stat)
                        const playerDamage = playerState.damage;
                        const { damage: rawDamage, type: dmgType } = calculateAbilityDamage(playerDamage, abilityStats);
                        const dmg = Math.max(0, rawDamage);

                        if (dmg > 0) {
                            takeDamage(dmg, dmgType);

                            // Apply knockback from impactBonus (Tier 2 Brute Force stat) - 1 foot per impact point
                            const knockbackDistance = abilityStats.impactBonus || 0;
                            if (knockbackDistance > 0 && direction.current.length() > 0.01) {
                                const knockbackDir = direction.current.clone().normalize().negate();
                                enemyPos.current.addScaledVector(knockbackDir, knockbackDistance);
                            }

                            lastTickTime.current = currentTime;

                            // Apply Poison DOT if player has poison upgrades
                            if (abilityStats.dotDamagePerSecond > 0 && abilityStats.dotDuration > 0) {
                                poisonState.current = {
                                    isActive: true,
                                    endTime: currentTime + abilityStats.dotDuration,
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

        // Visuals: Pulse scale when using ability or buffed
        if (isUsingAbility) {
            groupRef.current.scale.setScalar(1.2);
        } else if (defenseBuff > 0) {
            // Pulse slowly when buffed
            const s = 1.0 + Math.sin(currentTime * 10) * 0.1;
            groupRef.current.scale.setScalar(s);
        } else {
            groupRef.current.scale.lerp(unitScale.current, 0.1);
        }
    });

    // Take Damage
    const takeDamage = (amount: number, type: 'normal' | 'crit' | 'superCrit' = 'normal') => {
        // Apply Defense Buff
        const reducedAmount = applyDefenseMultiplier(amount, defenseBuff);

        const newHealth = Math.max(0, healthRef.current - reducedAmount);
        healthRef.current = newHealth;
        setCurrentHealth(newHealth);
        damageNumberRef.current = { value: Number(reducedAmount.toFixed(1)), time: Date.now(), type };

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

        const playerStore = usePlayerStore.getState();
        let one = 2.5
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
        playerStore.registerKill(level, one); // French Horn gives 2.5x XP
        useAccessoryStore.getState().addEmbouchureXp(25);

        const currentLocation = useGameStore.getState().currentLocation;

        if (currentLocation === 'backstage_halls') {
            useGameStore.getState().collectGold(Math.floor(7 * (1 + level / 120)));
        }

        const drops = getFrenchHornDrops(level, currentLocation);

        if (Object.keys(drops).length > 0) {
            if (drops.echoes) { playerStore.collectEchoes(drops.echoes); delete drops.echoes; }
            if (Object.keys(drops).length > 0) useInventoryStore.getState().addMaterials(drops);
        }


        onDeath?.(id);
    };

    if (!isAlive || !isReady) return null;

    const isBuffed = defenseBuff > 0;

    return (
        <group ref={groupRef} position={initialPosition}>
            {/* --- French Horn Composite Geometry --- */}
            {/* Visual Offset to center the mass */}
            <group position={[0, BODY_HEIGHT / 2, 0]}>

                {/* 1. Main Outer Coil (Large Wrap) */}
                {models ? (isBuffed ? <models.outerCoilBuffed rotation={[Math.PI / 2, 0, 0]} /> : <models.outerCoil rotation={[Math.PI / 2, 0, 0]} />) : <mesh rotation={[Math.PI / 2, 0, 0]} geometry={outerCoilGeo} material={isBuffed ? buffMat : hornMat} />}

                {/* 2. Inner Coil (Smaller Wrap for complexity) */}
                {models ? (isBuffed ? <models.innerCoilBuffed rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.05]} /> : <models.innerCoil rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.05]} />) : <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.05]} geometry={innerCoilGeo} material={isBuffed ? buffMat : hornMat} />}

                {/* 3. The Bell (Large flair pointing backward/sideways) */}
                {/* Positioned on the left side, flaring back */}
                <group position={[0.5, 0.2, 0.3]} rotation={[0, 0, -Math.PI / 6]}>
                    {/* Bell Throat */}
                    {models ? (isBuffed ? <models.bellThroatBuffed position={[0, -0.2, 0]} /> : <models.bellThroat position={[0, -0.2, 0]} />) : <mesh position={[0, -0.2, 0]} geometry={bellThroatGeo} material={isBuffed ? buffMat : hornMat} />}
                    {/* Bell Flare */}
                    {models ? (isBuffed ? <models.bellFlareBuffed position={[0, 0.1, 0]} /> : <models.bellFlare position={[0, 0.1, 0]} />) : <mesh position={[0, 0.1, 0]} geometry={bellFlareGeo} material={isBuffed ? buffMat : hornMat} />}
                    {/* Interior glow/darkness */}
                    {models ? <models.interiorGlow position={[0, 0.05, 0]} /> : <mesh position={[0, 0.05, 0]} geometry={interiorGlowGeo} material={interiorMat} />}
                </group>

                {/* 4. Rotary Valves (Cluster in center) */}
                <group position={[-0.1, 0.1, 0]}>
                    {models ? <models.valveBody position={[0, 0, -0.1]} /> : <mesh position={[0, 0, -0.1]} geometry={valveBodyGeo} material={valveBodyMat} />}
                    {models ? <models.valveBody position={[0.15, 0, -0.05]} /> : <mesh position={[0.15, 0, -0.05]} geometry={valveBodyGeo} material={valveBodyMat} />}
                    {models ? <models.valveBody position={[-0.15, 0, -0.05]} /> : <mesh position={[-0.15, 0, -0.05]} geometry={valveBodyGeo} material={valveBodyMat} />}

                    {/* Valve Levers/Keys */}
                    {models ? <models.valveKey position={[0, 0.2, -0.05]} rotation={[0, 0, Math.PI / 2]} /> : <mesh position={[0, 0.2, -0.05]} rotation={[0, 0, Math.PI / 2]} geometry={valveKeyGeo} material={valveKeyMat} />}
                </group>

                {/* 5. Leadpipe (Connection to mouthpiece) */}
                {models ? (isBuffed ? <models.leadPipeBuffed position={[-0.5, 0.1, -0.2]} rotation={[0, 0, Math.PI / 4]} /> : <models.leadPipe position={[-0.5, 0.1, -0.2]} rotation={[0, 0, Math.PI / 4]} />) : <mesh position={[-0.5, 0.1, -0.2]} rotation={[0, 0, Math.PI / 4]} geometry={leadPipeGeo} material={isBuffed ? buffMat : hornMat} />}

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
                    const { damage: dmg, type: dmgType, isCrit, isSuperCrit } = calculateBasicAttackDamage(basicAttackDamage);
                    if (isCrit) console.log(isSuperCrit ? "SUPER-CRITICAL HIT on FrenchHorn!" : "CRIT!");
                    takeDamage(dmg, dmgType);
                }
            }} visible={false}
                geometry={hitboxGeo}
                material={hitboxMat}
            />

            {/* Health Bar */}
            {gameState === 'playing' && (
                <group position={[0, BODY_HEIGHT + 0.5, 0]} ref={healthBarRef}>
                    <EnemyHealthBar
                        health={currentHealth}
                        maxHealth={MAX_HEALTH}
                        level={level}
                        visible={currentHealth < MAX_HEALTH || playerDistanceRef.current <= SIGHT_RANGE}
                        enemyType="french_horn"
                        damageTextValue={damageNumberRef.current?.value}
                        damageTextTime={damageNumberRef.current?.time}
                        damageTextType={damageNumberRef.current?.type}
                    />
                </group>
            )}
        </group>
    );
}

export default FrenchHorn;
