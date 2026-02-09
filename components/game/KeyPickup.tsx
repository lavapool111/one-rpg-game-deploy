'use client';

import { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '@/lib/store';

/**
 * KeyPickup Component
 * 
 * Collectible key that floats and rotates. Auto-pickup when player walks over.
 * - Resonance Key: Gold colored (for Gold Vaults)
 * - Melodic Key: Silver colored (for Metal Doors)
 */

interface KeyPickupProps {
    /** Type of key */
    type: 'melodic' | 'resonance';
    /** World position */
    position: [number, number, number];
    /** Callback when picked up */
    onPickup?: () => void;
}

export function KeyPickup({ type, position, onPickup }: KeyPickupProps) {
    const groupRef = useRef<THREE.Group>(null);
    const [collected, setCollected] = useState(false);
    const { camera } = useThree();
    const addKey = useGameStore((state) => state.addKey);
    const gameState = useGameStore((state) => state.gameState);

    // Key colors based on type
    const keyColor = type === 'resonance' ? '#FFD700' : '#C0C0C0';
    const glowColor = type === 'resonance' ? '#ffaa00' : '#aaccff';
    const keyName = type === 'resonance' ? 'Resonance' : 'Melodic';

    // Float and rotate animation, check for player proximity
    useFrame((state) => {
        if (!groupRef.current || collected) return;

        // Floating animation
        const time = state.clock.elapsedTime;
        groupRef.current.position.y = position[1] + Math.sin(time * 2) * 0.2;
        groupRef.current.rotation.y = time * 1.5;

        // Check distance to player for auto-pickup
        if (gameState === 'playing' && groupRef.current) {
            const playerPos = camera.position;
            const keyPos = new THREE.Vector3();
            groupRef.current.getWorldPosition(keyPos);
            const distance = playerPos.distanceTo(keyPos);

            if (distance < 4) { // 4 feet pickup radius
                // Collect the key
                addKey(type);
                setCollected(true);
                console.log(`Collected ${keyName} Key!`);
                if (onPickup) onPickup();
            }
        }
    });

    // Don't render if collected
    if (collected) return null;

    return (
        <group ref={groupRef} position={position}>
            {/* Key shaft */}
            <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.08, 0.08, 0.8, 8]} />
                <meshStandardMaterial
                    color={keyColor}
                    roughness={0.2}
                    metalness={0.9}
                    emissive={keyColor}
                    emissiveIntensity={0.3}
                />
            </mesh>

            {/* Key head (circle) */}
            <mesh position={[-0.5, 0, 0]}>
                <torusGeometry args={[0.2, 0.06, 8, 16]} />
                <meshStandardMaterial
                    color={keyColor}
                    roughness={0.2}
                    metalness={0.9}
                    emissive={keyColor}
                    emissiveIntensity={0.3}
                />
            </mesh>

            {/* Key teeth */}
            {[0.1, 0.2, 0.35].map((offset, i) => (
                <mesh key={i} position={[offset, -0.12, 0]}>
                    <boxGeometry args={[0.08, 0.15, 0.05]} />
                    <meshStandardMaterial
                        color={keyColor}
                        roughness={0.2}
                        metalness={0.9}
                    />
                </mesh>
            ))}

            {/* Glow ring underneath */}
            <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.3, 0.6, 32]} />
                <meshBasicMaterial
                    color={glowColor}
                    transparent
                    opacity={0.5}
                />
            </mesh>

            {/* Point light for glow effect */}
            <pointLight
                position={[0, 0, 0]}
                intensity={15}
                color={glowColor}
                distance={8}
                decay={2}
            />
        </group>
    );
}

export default KeyPickup;
