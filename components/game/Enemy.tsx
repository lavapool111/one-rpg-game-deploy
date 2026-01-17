'use client';

import { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Mesh, Vector3 } from 'three';
import { usePlayerStore, useGameStore } from '@/lib/store';
import { Html } from '@react-three/drei';
import { getStatsForLevel } from '@/lib/game/stats';

/**
 * Enemy Component
 * Base enemy entity with health and behavior
 */

interface EnemyProps {
    position?: [number, number, number];
    type?: 'basic' | 'ranged' | 'boss';
    level?: number;
    health?: number;
    defense?: number;
    xpValue?: number;
    echoDrops?: [number, number]; // min, max
}

export function Enemy({
    position = [0, 0, 0],
    type = 'basic',
    level = 1,
    health, // Optional override
    defense = 0,
    xpValue = 1,
    echoDrops = [1, 2]
}: EnemyProps) {
    // Calculate stats based on level if health not strictly provided
    const stats = getStatsForLevel(level);
    const initialHealth = health ?? stats.health;

    const meshRef = useRef<Mesh>(null);
    const [currentHealth, setCurrentHealth] = useState(initialHealth);
    const [isDead, setIsDead] = useState(false);

    // Store access - use selective subscriptions to avoid mass re-renders
    const isLongToneActive = usePlayerStore((state) => state.isLongToneActive);
    const playerDamage = usePlayerStore((state) => state.damage);
    const gameState = useGameStore((state) => state.gameState);
    const { camera } = useThree();

    // Long cone damage tick tracking
    const lastTickTime = useRef(0);
    const TICK_RATE = 0.5; // Damage every 0.5 seconds

    // Damage floating text state (simple implementation)
    const [damageNumber, setDamageNumber] = useState<{ value: number, time: number } | null>(null);

    // Color based on enemy type
    const colorMap = {
        basic: '#ef4444',
        ranged: '#f97316',
        boss: '#dc2626',
    };

    useFrame((state, delta) => {
        if (isDead || !meshRef.current || gameState !== 'playing') return;

        // Basic rotation
        meshRef.current.rotation.y -= delta * 0.3;

        // Long Tone Damage Logic
        if (isLongToneActive) {
            const now = state.clock.elapsedTime;

            // Check interval
            if (now - lastTickTime.current >= TICK_RATE) {
                // Check distance
                const dist = meshRef.current.position.distanceTo(camera.position);

                // Effective Range (e.g., 20 ft)
                if (dist < 20) {
                    // Calculate Damage
                    // Formula: (Damage * 0.15) - Defense
                    // playerDamage is already scaled
                    const { critChance } = usePlayerStore.getState();
                    const isCrit = Math.random() < critChance;
                    const critMult = isCrit ? 1.5 : 1.0;

                    const rawDamage = (playerDamage * 0.15) * critMult;
                    const finalDamage = Math.max(0, rawDamage - defense);

                    if (finalDamage > 0) {
                        takeDamage(finalDamage);
                        lastTickTime.current = now;
                    }
                }
            }
        }
    });

    const takeDamage = (amount: number) => {
        const nextHealth = Math.max(0, currentHealth - amount);
        setCurrentHealth(nextHealth);
        setDamageNumber({ value: Number(amount.toFixed(2)), time: Date.now() });

        if (nextHealth <= 0 && !isDead) {
            die();
        }
    };

    const die = () => {
        setIsDead(true);
        // Grant rewards
        const playerStore = usePlayerStore.getState();
        playerStore.addXp(xpValue);

        const echoes = Math.floor(Math.random() * (echoDrops[1] - echoDrops[0] + 1)) + echoDrops[0];
        playerStore.collectEchoes(echoes);

        console.log(`Enemy died! XP: ${xpValue}, Echoes: ${echoes}`);

        // In a real game, we'd notify a parent Spawner or use a store to remove this entity.
        // For this demo, we'll just scale it down to 0 or hide it.
    };

    if (isDead) return null; // Simple despawn

    return (
        <mesh
            ref={meshRef}
            position={position}
            onClick={(e) => {
                e.stopPropagation();

                // Get fresh stats
                const { critChance } = usePlayerStore.getState();

                // Critical Hit Calculation
                const isCrit = Math.random() < critChance;
                const critMultiplier = isCrit ? 1.5 : 1.0;

                const rawDamage = playerDamage * critMultiplier;
                const final = Math.max(0, rawDamage - defense);

                // TODO: Visual feedback for crit?
                if (isCrit) console.log("CRITICAL HIT!"); // Debug for now

                takeDamage(final);
            }}
        >
            <boxGeometry args={type === 'boss' ? [2, 2, 2] : [1, 1, 1]} />
            <meshStandardMaterial color={colorMap[type]} />

            {/* Simple Health Bar above enemy - Only visible when playing */}
            {gameState === 'playing' && (
                <Html position={[0, 1.0, 0]} center distanceFactor={10}>
                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm mb-1">
                            <span className="text-yellow-400 font-bold text-xs">LV {level}</span>
                        </div>

                        <div className="w-20 h-2 bg-gray-800 border border-white/20 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-red-500 transition-[width] duration-75"
                                style={{ width: `${(currentHealth / initialHealth) * 100}%` }}
                            />
                        </div>
                    </div>
                    {damageNumber && Date.now() - damageNumber.time < 1000 && (
                        <div className="text-red-400 font-bold text-lg text-shadow-sm absolute -top-8 left-1/2 -translate-x-1/2 animate-bounce">
                            -{damageNumber.value}
                        </div>
                    )}
                </Html>
            )}
        </mesh>
    );
}

export default Enemy;
