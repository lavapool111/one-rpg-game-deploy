'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Trumpet } from './Trumpet';
import { Trombone } from './Trombone';
import { Tuba } from './Tuba';
import { usePlayerStore } from '@/lib/store';
import AudioManager from '@/lib/audio/AudioManager';
import { Pillar } from '@/lib/game/pillars';


// Sound key for the trumpet fanfare
const TRUMPET_FANFARE_KEY = 'trumpet-fanfare';
const TRUMPET_FANFARE_SRC = '/audio/trumpet-fanfare-announcement-zeroframe-audio-2-1-00-03.mp3';

/**
 * EnemySpawner Component
 * 
 * Manages spawning of enemies in the Band Room
 * Spawns Trumpets and Trombones based on zones and player level
 */

type EnemyType = 'trumpet' | 'trombone' | 'tuba';

interface Enemy {
    id: string;
    type: EnemyType;
    position: [number, number, number];
    level: number;
}

interface EnemySpawnerProps {
    /** Arena radius for spawn bounds */
    arenaRadius?: number;
    /** Number of enemies to spawn per wave */
    enemiesPerWave?: number;
    /** Time between spawn waves in seconds */
    spawnInterval?: number;
    /** Whether spawning is enabled */
    enabled?: boolean;
    /** Pillar data for collision */
    pillars?: Pillar[];
}

// Spawn zones with radius ranges (percentage of arena radius)
const SPAWN_ZONES = {
    inner: { minRadius: 0.32, maxRadius: 0.48 },  // Lower level
    mid: { minRadius: 0.48, maxRadius: 0.64 },  // Player level
    outer: { minRadius: 0.64, maxRadius: 0.80 },  // Higher level
    extreme: { minRadius: 0.80, maxRadius: 0.95 }, // Danger zone - very high level
};

// Maximum enemies per zone to prevent overcrowding
const MAX_ENEMIES_PER_ZONE = {
    inner: 40,
    mid: 40,
    outer: 35,
    extreme: 20,
};

// Total max enemies in the arena
const MAX_TOTAL_ENEMIES = 150;

type ZoneType = 'inner' | 'mid' | 'outer' | 'extreme';

// Calculate enemy level based on zone and player level
function calculateZoneLevel(zoneType: ZoneType, playerLevel: number): number {
    switch (zoneType) {
        case 'inner':
            // Math.round(playerLevel / 2)
            return Math.max(1, Math.round(playerLevel / 2));
        case 'mid':
            // Player level - 3 to player level + 3
            const midVariance = Math.floor(Math.random() * 7) - 3; // -3 to +3
            return Math.max(1, playerLevel + midVariance);
        case 'outer':
            // Math.round(playerLevel * random(1.0-1.5)) + 5
            const outerMultiplier = 1.0 + Math.random() * 0.5; // 1.0 to 1.5
            return Math.max(1, Math.round(playerLevel * outerMultiplier) + 5);
        case 'extreme':
            // Very dangerous: 2x player level + 10-20
            const extremeBonus = Math.floor(Math.random() * 11) + 10; // 10-20
            return Math.max(1, Math.round(playerLevel * 2) + extremeBonus);
    }
}

// Generate random position and level based on specific zone
function getZoneSpawn(zoneType: ZoneType, arenaRadius: number, playerLevel: number, pillars: Pillar[], playerPosition?: [number, number, number]): { position: [number, number, number], level: number, type: EnemyType } | null {
    const MAX_RETRIES = 20;
    const MIN_PLAYER_DISTANCE = 30; // Don't spawn within 30ft of player

    for (let i = 0; i < MAX_RETRIES; i++) {
        // Random angle
        const angle = Math.random() * Math.PI * 2;

        const zone = SPAWN_ZONES[zoneType];

        // Calculate distance within the zone
        const minRadius = arenaRadius * zone.minRadius;
        const maxRadius = arenaRadius * zone.maxRadius;
        const distance = minRadius + Math.random() * (maxRadius - minRadius);

        const position: [number, number, number] = [
            Math.cos(angle) * distance,
            1, // Height above ground
            Math.sin(angle) * distance
        ];

        // Check for pillar collision
        let collides = false;
        if (pillars.length > 0) {
            const ENEMY_RADIUS = 3; // Approx max radius of enemy
            for (const pillar of pillars) {
                // Use base radius for check
                const baseRadius = pillar.radius * 1.5;
                const minSafeDist = baseRadius + ENEMY_RADIUS;

                const dx = position[0] - pillar.x;
                const dz = position[2] - pillar.z;
                const distSq = dx * dx + dz * dz;

                if (distSq < minSafeDist * minSafeDist) {
                    collides = true;
                    break;
                }
            }
        }

        if (collides) continue; // Retry

        // Check player proximity - don't spawn too close to player
        if (playerPosition) {
            const dx = position[0] - playerPosition[0];
            const dz = position[2] - playerPosition[2];
            const playerDist = Math.sqrt(dx * dx + dz * dz);
            if (playerDist < MIN_PLAYER_DISTANCE) continue; // Too close, retry
        }

        // Calculate level based on zone formula
        const enemyLevel = calculateZoneLevel(zoneType, playerLevel);

        // Determine Enemy Type
        // Extreme: 43% Trumpet, 43% Trombone, 14% Tuba
        // Outer: 50% chance for Trombone, 50% Trumpet
        // Inner/Mid: Trombone only if playerLevel >= 10 (30% chance)
        let type: EnemyType = 'trumpet';
        const typeRoll = Math.random();

        if (zoneType === 'extreme') {
            if (typeRoll < 0.43) {
                type = 'trumpet';
            } else if (typeRoll < 0.86) {
                type = 'trombone';
            } else {
                type = 'tuba';
            }
        } else if (zoneType === 'outer') {
            if (typeRoll < 0.5) type = 'trombone';
        } else {
            // Inner or Mid
            if (playerLevel >= 10 && typeRoll < 0.3) {
                type = 'trombone';
            }
        }

        return { position, level: enemyLevel, type };
    }

    // Failed to find spot after retries
    return null;
}

// Generate unique ID
let enemyIdCounter = 0;
function generateEnemyId(): string {
    return `enemy-${Date.now()}-${enemyIdCounter++}-${Math.random().toString(36).substr(2, 9)}`;
}

export function EnemySpawner({
    arenaRadius = 250,
    enemiesPerWave = 3, // Increased default
    spawnInterval = 30, // Much faster base interval (was 60)
    enabled = true,
    pillars = []
}: EnemySpawnerProps) {
    const [enemies, setEnemies] = useState<Enemy[]>([]);
    // Use selective subscription to only re-render on level changes
    const currentLevel = usePlayerStore((state) => state.level);
    const lastFanfareTime = useRef<number>(0);
    const zoneWaveCounts = useRef<Record<string, number>>({});

    // Preload sounds
    useEffect(() => {
        AudioManager.load(TRUMPET_FANFARE_KEY, TRUMPET_FANFARE_SRC);
    }, []);

    // Generic spawn function for a specific zone
    const spawnZoneWave = useCallback((zone: ZoneType) => {
        setEnemies(prev => {
            // Check total enemy cap
            if (prev.length >= MAX_TOTAL_ENEMIES) return prev;

            // Count enemies roughly in this zone (based on spawn position distance)
            const zoneConfig = SPAWN_ZONES[zone];
            const zoneEnemyCount = prev.filter(e => {
                const dist = Math.sqrt(e.position[0] ** 2 + e.position[2] ** 2);
                const pct = dist / arenaRadius;
                return pct >= zoneConfig.minRadius && pct <= zoneConfig.maxRadius;
            }).length;

            // Check zone cap
            if (zoneEnemyCount >= MAX_ENEMIES_PER_ZONE[zone]) return prev;

            // Increment wave count for this zone
            zoneWaveCounts.current[zone] = (zoneWaveCounts.current[zone] || 0) + 1;
            const waveBonus = Math.max(0, zoneWaveCounts.current[zone] - 1);

            // Calculate how many we can spawn (Base + WaveBonus)
            const baseSpawn = Math.floor(Math.random() * enemiesPerWave) + 1;

            // Request: "on average 1 more enemy per wave".
            // Wave 1: Base (e.g. 1-2) + 0 -> Avg 1.5
            // Wave 2: Base (e.g. 1-2) + 1 -> Avg 2.5

            const maxToSpawn = Math.min(
                MAX_ENEMIES_PER_ZONE[zone] - zoneEnemyCount,
                MAX_TOTAL_ENEMIES - prev.length,
                baseSpawn + waveBonus
            );

            if (maxToSpawn <= 0) return prev;

            const newEnemies: Enemy[] = [];
            for (let i = 0; i < maxToSpawn; i++) {
                const spawn = getZoneSpawn(zone, arenaRadius, currentLevel, pillars);
                const isValid = spawn && !spawn.position.some(coord => isNaN(coord));

                if (isValid && spawn) {
                    newEnemies.push({
                        id: generateEnemyId(),
                        type: spawn.type,
                        position: spawn.position,
                        level: spawn.level
                    });
                }
            }

            if (newEnemies.length > 0) {
                // Throttle fanfares
                const now = Date.now();
                if (now - lastFanfareTime.current > 45000) {
                    AudioManager.play(TRUMPET_FANFARE_KEY, 'sfx', { volume: 0.3 });
                    lastFanfareTime.current = now;
                }
                return [...prev, ...newEnemies];
            }
            return prev;
        });
    }, [arenaRadius, enemiesPerWave, currentLevel, pillars]);

    // Handle enemy death
    const handleEnemyDeath = useCallback((id: string) => {
        setEnemies(prev => prev.filter(enemy => enemy.id !== id));
    }, []);

    // Initial spawn on mount (One for each zone, staggered)
    useEffect(() => {
        if (enabled) {
            // Stagger initial spawns
            const t1 = setTimeout(() => spawnZoneWave('inner'), 2000);
            const t2 = setTimeout(() => spawnZoneWave('mid'), 4000);
            const t3 = setTimeout(() => spawnZoneWave('outer'), 6000);
            const t4 = setTimeout(() => spawnZoneWave('extreme'), 8000);
            return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
        }
    }, [enabled, spawnZoneWave]);

    // Independent Loop: INNER Zone
    useEffect(() => {
        if (!enabled) return;
        // Spawn every ~40s for inner zone
        const intervalMs = (spawnInterval * 0.4) * 1000;
        const interval = setInterval(() => spawnZoneWave('inner'), intervalMs);
        return () => clearInterval(interval);
    }, [enabled, spawnInterval, spawnZoneWave]);

    // Independent Loop: MID Zone
    useEffect(() => {
        if (!enabled) return;
        // Spawn every ~50s for mid zone
        const intervalMs = (spawnInterval * 0.56) * 1000;
        const interval = setInterval(() => spawnZoneWave('mid'), intervalMs);
        return () => clearInterval(interval);
    }, [enabled, spawnInterval, spawnZoneWave]);

    // Independent Loop: OUTER Zone
    useEffect(() => {
        if (!enabled) return;
        // Spawn every ~60s for outer zone
        const intervalMs = (spawnInterval * 0.7) * 1000;
        const interval = setInterval(() => spawnZoneWave('outer'), intervalMs);
        return () => clearInterval(interval);
    }, [enabled, spawnInterval, spawnZoneWave]);

    // Independent Loop: EXTREME Zone (Danger Zone)
    useEffect(() => {
        if (!enabled) return;
        // Spawn every ~90s for extreme zone
        const intervalMs = (spawnInterval * 1) * 1000;
        const interval = setInterval(() => spawnZoneWave('extreme'), intervalMs);
        return () => clearInterval(interval);
    }, [enabled, spawnInterval, spawnZoneWave]);

    // Independent Loop: TUBA (Back Layer / Outer)
    // Max 3 Tubas. Spawns "multiple of 15 above player".
    useEffect(() => {
        if (!enabled) return;

        // Check every 5 seconds if we need more Tubas
        const interval = setInterval(() => {
            setEnemies(prev => {
                const tubas = prev.filter(e => e.type === 'tuba');
                if (tubas.length >= 3) return prev; // Cap at 3

                // Need to spawn a Tuba
                // Level logic: Multiple of 15 *above* player
                // If 1-14 -> 15. If 15 -> 30.
                // Formula: (floor(level / 15) + 1) * 15
                const tubaLevel = (Math.floor(currentLevel / 15) + 1) * 15;

                // Spawn in outer zone (back layer)
                // We can reuse getZoneSpawn('outer') logic manually or just call it?
                // getZoneSpawn doesn't support 'tuba' type override or specific level override easily.
                // Let's copy the position logic for safety and clarity.

                const zone = SPAWN_ZONES['outer'];
                const minRadius = arenaRadius * zone.minRadius;
                const maxRadius = arenaRadius * zone.maxRadius;
                const angle = Math.random() * Math.PI * 2;
                const distance = minRadius + Math.random() * (maxRadius - minRadius);

                const pos: [number, number, number] = [
                    Math.cos(angle) * distance,
                    1,
                    Math.sin(angle) * distance
                ];

                // Collision check
                let collides = false;
                if (pillars.length > 0) {
                    const TUBA_RADIUS = 4;
                    for (const pillar of pillars) {
                        const baseRadius = pillar.radius * 1.5;
                        const minSafeDist = baseRadius + TUBA_RADIUS;
                        const dx = pos[0] - pillar.x;
                        const dz = pos[2] - pillar.z;
                        if (dx * dx + dz * dz < minSafeDist * minSafeDist) {
                            collides = true;
                            break;
                        }
                    }
                }

                if (collides) return prev; // Skip this tick if collision

                const newTuba: Enemy = {
                    id: generateEnemyId(),
                    type: 'tuba',
                    position: pos,
                    level: tubaLevel
                };

                console.log(`[EnemySpawner] Spawning Tuba LV ${tubaLevel} at`, pos);
                return [...prev, newTuba];
            });
        }, 5000); // Check every 5s

        return () => clearInterval(interval);
    }, [enabled, currentLevel, arenaRadius, pillars]);

    // Independent Loop: LOWER-LEVEL TUBA (Mid Zone)
    // Only when player is level 30+. Max 5. Levels are multiples of 15 at or below player.
    useEffect(() => {
        if (!enabled || currentLevel < 30) return;

        // Check every 7 seconds if we need more lower-level Tubas
        const interval = setInterval(() => {
            setEnemies(prev => {
                // Count lower-level tubas (those spawned in mid zone with level < currentLevel)
                // We track them by checking if their level is a multiple of 15 AND below the "above player" tuba level
                const abovePlayerTubaLevel = (Math.floor(currentLevel / 15) + 1) * 15;
                const lowerLevelTubas = prev.filter(e =>
                    e.type === 'tuba' && e.level < abovePlayerTubaLevel
                );

                if (lowerLevelTubas.length >= 5) return prev; // Cap at 5

                // Pick a random tuba level from available multiples of 15 at or below player
                // e.g., if player is 36, options are [15, 30]
                const maxMultiple = Math.floor(currentLevel / 15);
                if (maxMultiple < 1) return prev; // Safety check

                const selectedMultiple = Math.floor(Math.random() * maxMultiple) + 1; // 1 to maxMultiple
                const tubaLevel = selectedMultiple * 15;

                // Spawn in mid zone
                const zone = SPAWN_ZONES['mid'];
                const minRadius = arenaRadius * zone.minRadius;
                const maxRadius = arenaRadius * zone.maxRadius;
                const angle = Math.random() * Math.PI * 2;
                const distance = minRadius + Math.random() * (maxRadius - minRadius);

                const pos: [number, number, number] = [
                    Math.cos(angle) * distance,
                    1,
                    Math.sin(angle) * distance
                ];

                // Collision check
                let collides = false;
                if (pillars.length > 0) {
                    const TUBA_RADIUS = 4;
                    for (const pillar of pillars) {
                        const baseRadius = pillar.radius * 1.5;
                        const minSafeDist = baseRadius + TUBA_RADIUS;
                        const dx = pos[0] - pillar.x;
                        const dz = pos[2] - pillar.z;
                        if (dx * dx + dz * dz < minSafeDist * minSafeDist) {
                            collides = true;
                            break;
                        }
                    }
                }

                if (collides) return prev; // Skip this tick if collision

                const newTuba: Enemy = {
                    id: generateEnemyId(),
                    type: 'tuba',
                    position: pos,
                    level: tubaLevel
                };

                console.log(`[EnemySpawner] Spawning LOWER-LEVEL Tuba LV ${tubaLevel} in mid zone at`, pos);
                return [...prev, newTuba];
            });
        }, 7000); // Check every 7s

        return () => clearInterval(interval);
    }, [enabled, currentLevel, arenaRadius, pillars]);

    return (
        <group>
            {enemies.map(enemy => {
                if (enemy.type === 'tuba') {
                    return (
                        <Tuba
                            key={enemy.id}
                            id={enemy.id}
                            initialPosition={enemy.position}
                            level={enemy.level}
                            onDeath={handleEnemyDeath}
                            pillars={pillars}
                            arenaRadius={arenaRadius}
                        />
                    );
                }
                if (enemy.type === 'trombone') {
                    return (
                        <Trombone
                            key={enemy.id}
                            id={enemy.id}
                            initialPosition={enemy.position}
                            level={enemy.level}
                            onDeath={handleEnemyDeath}
                            pillars={pillars}
                            arenaRadius={arenaRadius}
                        />
                    );
                }
                return (
                    <Trumpet
                        key={enemy.id}
                        id={enemy.id}
                        initialPosition={enemy.position}
                        level={enemy.level}
                        onDeath={handleEnemyDeath}
                        pillars={pillars}
                        arenaRadius={arenaRadius}
                    />
                );
            })}
        </group>
    );
}

export default EnemySpawner;
