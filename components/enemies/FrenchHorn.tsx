import { useRef, useState, useEffect, useMemo, createContext, useContext, memo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import * as THREE from 'three';
import { usePlayerStore, useGameStore, useAccessoryStore } from '@/lib/store';
import { Merged } from '@react-three/drei';
import { EnemyHealthBar } from './EnemyHealthBar';
import { getStatsForLevel, getEnemyHpMultiplier, getEnemyDefense } from '@/lib/game/stats';
import { calculateBasicAttackDamage, calculateAbilityDamage, applyDefenseMultiplier, applyFlatDefense } from '@/lib/enemies/damageUtils';
import { applyEnemyMovement, shouldUpdateEnemyFrame, checkZoneLineOfSight, registerEnemyPosition, unregisterEnemyPosition, applySeparation, RectangleBoundary } from '@/lib/enemies/enemyMovement';
import { getFrenchHornDrops } from '@/lib/enemies/enemyDrops';
import { useEnemyState } from '@/lib/enemies/useEnemyState';
import { processEnemyDeath, calculateEnemyHealth } from '@/lib/enemies/enemyUtils';
import { hitboxMat } from '@/lib/enemies/enemyMaterials';
import { Pillar, checkLineOfSight } from '@/lib/game/pillars';
import { getFloorHeightAt } from '@/lib/game/stairCollision';
import { applyOvertonePushback, applyLongToneDamage, updatePoisonDot, PoisonState } from '@/lib/enemies/abilityUtils';

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
function getFrenchHornStats(level: number): { health: number; speed: number } {
    const health = calculateEnemyHealth(level, 2.4); // 2.4x base health

    // Speed: 3.75 + 0.075 * level
    const speed = BASE_SPEED + (SPEED_PER_LEVEL * level);

    return { health, speed };
}

interface FrenchHornProps {
    id: string;
    initialPosition: [number, number, number];
    level?: number;
    onDeath?: (id: string) => void;
    pillars?: Pillar[];
    arenaRadius?: number;
    arenaCenter?: [number, number, number];
    rectangleBoundary?: RectangleBoundary;
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

export const FrenchHorn = memo(function FrenchHorn({ id, initialPosition, level = 1, onDeath, pillars = [], arenaRadius = 375, arenaCenter = [0, 0, 0], rectangleBoundary, teleportToCenterOnOOB = false, models: propModels }: FrenchHornProps) {
    const contextModels = useContext(FrenchHornContext);
    const models = propModels || contextModels;
    const groupRef = useRef<Group>(null);
    const { camera } = useThree();
    // gameState provided by useEnemyState

    // Stats
    const stats = getFrenchHornStats(level);
    const MAX_HEALTH = stats.health;
    const MOVEMENT_SPEED = stats.speed;

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

    // FrenchHorn-specific State
    const [defenseBuff, setDefenseBuff] = useState(0); // 0.0 to 0.7
    const lastAbilityTime = useRef(0);
    const applyStun = usePlayerStore((state) => state.applyStun);

    // FrenchHorn-specific vectors
    const moveVec = useRef(new Vector3());
    const strafeDirVec = useRef(new Vector3());
    const WANDER_CHANGE_INTERVAL = 3 + Math.random() * 2;
    const BASE_TICK_RATE = 0.5;

    // Animation state
    const [isUsingAbility, setIsUsingAbility] = useState(false);

    // Fade in
    const [isReady, setIsReady] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setIsReady(true), 50);
        return () => {
            clearTimeout(t);
            unregisterEnemyPosition(id);
        };
    }, [id]);

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

        camera.getWorldPosition(playerPos.current);
        const distanceToPlayer = enemyPos.current.distanceTo(playerPos.current);
        playerDistanceRef.current = distanceToPlayer; // Update for health bar visibility

        // PERF: Hard sleep for very distant enemies — skip entire frame
        if (distanceToPlayer > 400) return;

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
        moveVec.current.set(0, 0, 0);
        let one = Math.min(15, MOVEMENT_SPEED * 0.3)

        if (canSeePlayer) {
            if (distanceToPlayer > ABILITY_RANGE) {
                moveVec.current.copy(direction.current).multiplyScalar(one * effectiveDelta);
            } else if (distanceToPlayer < 10) {
                moveVec.current.copy(direction.current).multiplyScalar(-MOVEMENT_SPEED * 0.8 * effectiveDelta);
            } else {
                strafeDirVec.current.set(-direction.current.z, 0, direction.current.x);
                moveVec.current.copy(strafeDirVec.current).multiplyScalar(one * effectiveDelta * Math.sin(currentTime));
            }
        } else {
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
            moveDistance: 1,
            currentLocation,
            bodyHeight: BODY_HEIGHT,
            bodyRadius: 1.0,
            pillars,
            arenaCenter: arenaCenter || [0, 0, 0] as unknown as [number, number, number],
            arenaRadius: arenaRadius || 375,
            rectangleBoundary,
            teleportToCenterOnOOB
        });

        if (didCollide && !canSeePlayer) {
            wanderDirection.current.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
        }

        // Apply Position and Rotation
        applySeparation(id, enemyPos.current, 'french_horn');
        registerEnemyPosition(id, enemyPos.current.x, enemyPos.current.z, 'french_horn', takeDamage);
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
            const hasLOS = pillars.length === 0 || checkLineOfSight(
                { x: enemyPos.current.x, z: enemyPos.current.z },
                { x: playerPos.current.x, z: playerPos.current.z },
                pillars
            );

            if (hasLOS) {
                lastAbilityTime.current = currentTime;
                setIsUsingAbility(true);

                const stunDurationRaw = 0.5 + (level * 0.01);
                const stunDuration = Math.min(2.0, stunDurationRaw);
                applyStun(stunDuration);

                const defRaw = 0.35 + (level * 0.001);
                const defenseAmount = Math.min(0.70, defRaw);
                const defDurationRaw = 2.0 + (level * 0.03);
                const defDuration = Math.min(4.0, defDurationRaw);

                setDefenseBuff(defenseAmount);

                const playerState = usePlayerStore.getState();
                const enchantmentBonus = useAccessoryStore.getState().getEnchantmentBonus();
                if (enchantmentBonus.hornRetaliationDamage > 0) {
                    const retaliationDmg = playerState.basicAttackDamage * enchantmentBonus.hornRetaliationDamage;
                    takeDamage(retaliationDmg);
                }

                setTimeout(() => {
                    setDefenseBuff(0);
                }, defDuration * 1000);

                setTimeout(() => setIsUsingAbility(false), 500);
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
            'french_horn',
            id
        );

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
        // 1. Calculate and apply piecewise flat defense
        const defensePoints = getEnemyDefense(level);
        const amountAfterFlat = applyFlatDefense(amount, defensePoints, 0);

        // 2. Apply temporary Defense Buff (if active)
        const reducedAmount = applyDefenseMultiplier(amountAfterFlat, defenseBuff);

        const newHealth = Math.max(0, healthRef.current - reducedAmount);
        healthRef.current = newHealth;
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
        processEnemyDeath({
            id,
            level,
            baseXpMultiplier: 2.5,
            embouchureXp: 25,
            goldFormula: (lvl) => Math.floor(7 * (1 + lvl / 120)),
            getDrops: getFrenchHornDrops,
            onDeath,
        });
    };

    const isBuffed = defenseBuff > 0;

    if (!isReady) return null;

    return (
        <group ref={groupRef} position={initialPosition}>
            {isAlive && isReady && (
                <group>
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
                    <mesh
                        ref={(m) => {
                            if (m) {
                                m.userData.onHit = (dmg: number, type: any) => takeDamage(dmg, type);
                                m.userData.type = 'enemy';
                                m.userData.enemyType = 'french_horn';
                                m.userData.id = id;
                            }
                        }} visible={true}
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
                enemyType="french_horn"
                damageTextRef={damageNumberRef}
                enemyPosRef={enemyPos}
                yOffset={2}
                visible={gameState === 'playing' && isAlive && isReady}
            />
        </group>
    );
});

export default FrenchHorn;
