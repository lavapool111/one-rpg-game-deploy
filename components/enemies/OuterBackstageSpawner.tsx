'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Tuba } from './Tuba';
import { Trumpet } from './Trumpet';
import { Trombone } from './Trombone';
import { FrenchHorn } from './FrenchHorn';
import { Euphonium } from './Euphonium';
import { usePlayerStore, useGameStore } from '@/lib/store';
import {
    RING_CENTER_RADIUS,
    RING_INNER_RADIUS,
    RING_OUTER_RADIUS,
    ARC_START,
    ARC_SWEEP,
} from '../game/OuterBackstage';

/**
 * OuterBackstageSpawner
 *
 * CorridorSpawner-style spawner for the Outer Backstage ring.
 * Enemies roam freely and respawn — no wave system.
 * All enemies start at level 300 and scale up slightly per player proximity.
 *
 * Performance:
 * - Only active when player is within the ring radius band
 * - Uses setInterval polling (500ms) like CorridorSpawner
 * - Max 12 enemies total
 */

type EnemyType = 'trumpet' | 'trombone' | 'tuba' | 'french_horn' | 'euphonium';

interface Enemy {
    id: string;
    type: EnemyType;
    position: [number, number, number];
    level: number;
}

const MAX_ENEMIES = 24;
const BASE_LEVEL = 300;
const SPAWN_DISTANCE = 300; // Player must be within 300 ft of ring center radius
const DESPAWN_DISTANCE = 500;
const RESPAWN_DELAY = 8000; // 8 seconds

let outerEnemyIdCounter = 0;
function generateEnemyId(): string {
    return `outer-backstage-enemy-${++outerEnemyIdCounter}`;
}

/** Roll a random enemy type */
function rollEnemyType(): EnemyType {
    const roll = Math.random();
    if (roll < 0.30) return 'trumpet';
    if (roll < 0.60) return 'trombone';
    if (roll < 0.80) return 'french_horn';
    if (roll < 0.90) return 'tuba';
    return 'euphonium';
}

/**
 * Get a random position on the ring arc.
 * If targetAngle is provided, biases the spawn angle near the target to keep enemies grouped.
 */
function getRandomRingPosition(targetAngle?: number, spread: number = 0.5): { position: [number, number, number]; depth: number } {
    let angle: number;

    if (targetAngle !== undefined) {
        // Normalize targetAngle to be within [ARC_START, ARC_START + 2*PI]
        let baseAngle = targetAngle;
        while (baseAngle < ARC_START) baseAngle += 2 * Math.PI;
        while (baseAngle >= ARC_START + 2 * Math.PI) baseAngle -= 2 * Math.PI;

        // Spawn within ±spread radians of target
        angle = baseAngle + (Math.random() - 0.5) * 2 * spread;

        // Clamp to ensure they stay inside the valid arc sweep
        const normalizedArcEnd = ARC_START + ARC_SWEEP;
        if (angle < ARC_START) angle = ARC_START;
        if (angle > normalizedArcEnd) angle = normalizedArcEnd;
    } else {
        // Uniform fallback
        angle = ARC_START + Math.random() * ARC_SWEEP;
    }

    // Random radius between inner and outer, with margin from walls
    const margin = 15;
    const r = (RING_INNER_RADIUS + margin) + Math.random() * (RING_OUTER_RADIUS - RING_INNER_RADIUS - margin * 2);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;

    // Compute depth: how far around the arc from the entry points (NW/NE)
    // North is PI/2, which is the gap center. The farthest point is South (-PI/2).
    let normalizedAngle = angle % (2 * Math.PI);
    if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;
    let distFromNorth = Math.abs(normalizedAngle - Math.PI / 2);
    if (distFromNorth > Math.PI) distFromNorth = 2 * Math.PI - distFromNorth;
    const depth = Math.min(1, distFromNorth / Math.PI); // 0 at north, 1 at south

    return { position: [x, 1.5, z], depth };
}

interface OuterBackstageSpawnerProps {
    enabled?: boolean;
}

export function OuterBackstageSpawner({ enabled = true }: OuterBackstageSpawnerProps) {
    const [enemies, setEnemies] = useState<Enemy[]>([]);
    const [isActive, setIsActive] = useState(false);
    const hasSpawnedRef = useRef(false);
    const playerLevel = usePlayerStore((state) => state.level);

    /** Compute enemy level: base 300 + up to 50 based on ring depth, with random offset */
    const getEnemyLevel = useCallback((depth: number) => {
        const depthBonus = Math.floor(depth * 50); // 0 at entrances, up to +50 at south
        const base = Math.max(BASE_LEVEL, playerLevel) + depthBonus;
        const offset = Math.floor(Math.random() * 11) - 5; // -5 to +5
        return Math.max(BASE_LEVEL, base + offset);
    }, [playerLevel]);

    /** Generate a batch of enemies */
    const generateEnemies = useCallback((): Enemy[] => {
        const batch: Enemy[] = [];

        // Get player angle
        const pos = usePlayerStore.getState().position;
        const playerAngle = Math.atan2(pos[2], pos[0]);

        for (let i = 0; i < MAX_ENEMIES; i++) {
            // Bias spawn near player angle
            const { position, depth } = getRandomRingPosition(playerAngle, 0.4);
            batch.push({
                id: generateEnemyId(),
                type: rollEnemyType(),
                position,
                level: getEnemyLevel(depth),
            });
        }
        return batch;
    }, [getEnemyLevel]);

    const handleEnemyDeath = useCallback((id: string) => {
        setEnemies((prev) => prev.filter((e) => e.id !== id));
    }, []);

    const addEnemiesStaggered = useCallback((newEnemies: Enemy[]) => {
        let currentIndex = 0;
        const batchSize = 2;

        const addBatch = () => {
            if (currentIndex >= newEnemies.length) return;

            const nextIndex = Math.min(currentIndex + batchSize, newEnemies.length);
            const batch = newEnemies.slice(currentIndex, nextIndex);

            setEnemies(prev => [...prev, ...batch]);
            currentIndex = nextIndex;

            if (currentIndex < newEnemies.length) {
                requestAnimationFrame(addBatch);
            }
        };

        requestAnimationFrame(addBatch);
    }, []);

    // Proximity polling
    useEffect(() => {
        if (!enabled) return;

        const checkProximity = () => {
            const gameS = useGameStore.getState();
            if (!gameS.simulationActive) return;
            if (gameS.isInAltarRoom) {
                if (enemies.length > 0) {
                    setEnemies([]);
                    setIsActive(false);
                }
                return;
            }
            const pos = usePlayerStore.getState().position;
            const distFromOrigin = Math.sqrt(pos[0] * pos[0] + pos[2] * pos[2]);
            const distFromRing = Math.abs(distFromOrigin - RING_CENTER_RADIUS);

            // The ring has a gap from PI/4 to 3PI/4 (North).
            const playerAngle = Math.atan2(pos[2], pos[0]);
            const wrappedAngle = playerAngle < 0 ? playerAngle + 2 * Math.PI : playerAngle;

            // Add a slight buffer (0.15) so they don't despawn if hovering right at the doorway
            const inNorthernGap = wrappedAngle > Math.PI / 4 + 0.15 && wrappedAngle < 3 * Math.PI / 4 - 0.15;

            if (distFromRing < SPAWN_DISTANCE && !inNorthernGap && !isActive) {
                setIsActive(true);
                if (!hasSpawnedRef.current) {
                    addEnemiesStaggered(generateEnemies());
                    hasSpawnedRef.current = true;
                }
            } else if ((distFromRing > DESPAWN_DISTANCE || inNorthernGap) && isActive) {
                setIsActive(false);
                setEnemies([]);
            }
        };

        const interval = setInterval(checkProximity, 500);
        return () => clearInterval(interval);
    }, [enabled, isActive, generateEnemies]);

    // Respawn when enemies run low
    useEffect(() => {
        if (!enabled || !isActive) return;

        if (enemies.length < 3 && hasSpawnedRef.current) {
            const timer = setTimeout(() => {
                // Top up to MAX
                const newBatch: Enemy[] = [];
                const toSpawn = MAX_ENEMIES - enemies.length;

                // Get player angle for respawns too
                const pos = usePlayerStore.getState().position;
                const playerAngle = Math.atan2(pos[2], pos[0]);

                for (let i = 0; i < toSpawn; i++) {
                    const { position, depth } = getRandomRingPosition(playerAngle, 0.4);
                    newBatch.push({
                        id: generateEnemyId(),
                        type: rollEnemyType(),
                        position,
                        level: getEnemyLevel(depth),
                    });
                }
                addEnemiesStaggered(newBatch);
            }, RESPAWN_DELAY);

            return () => clearTimeout(timer);
        }
    }, [enabled, isActive, enemies.length, getEnemyLevel]);



    if (!enabled || !isActive) return null;

    const arenaRadius = RING_OUTER_RADIUS + 50; // Large arena for ring movement

    return (
        <group>
            {enemies.map((enemy) => {
                const commonProps = {
                    id: enemy.id,
                    initialPosition: enemy.position,
                    level: enemy.level,
                    onDeath: handleEnemyDeath,
                    pillars: [] as never[],
                    arenaRadius,
                };

                switch (enemy.type) {
                    case 'tuba':
                        return <Tuba key={enemy.id} {...commonProps} />;
                    case 'trombone':
                        return <Trombone key={enemy.id} {...commonProps} />;
                    case 'french_horn':
                        return <FrenchHorn key={enemy.id} {...commonProps} />;
                    case 'euphonium':
                        return <Euphonium key={enemy.id} {...commonProps} />;
                    case 'trumpet':
                    default:
                        return <Trumpet key={enemy.id} {...commonProps} />;
                }
            })}
        </group>
    );
}

export default OuterBackstageSpawner;
