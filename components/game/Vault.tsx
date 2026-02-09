'use client';

import { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '@/lib/store';

/**
 * Vault Component
 * 
 * Interactive vault/door that requires a specific key to open.
 * - Gold Vault: Requires Resonance Key, spawns gold loot
 * - Metal Door: Requires Melodic Key, gates deep areas
 */

// Vault dimensions
const VAULT_WIDTH = 10;
const VAULT_HEIGHT = 12.5;
const VAULT_DEPTH = 1;

interface VaultProps {
    /** Type of vault */
    type: 'gold' | 'metal';
    /** World position */
    position: [number, number, number];
    /** Y-axis rotation */
    rotation?: number;
    /** Callback when vault opens */
    onOpen?: () => void;
    /** Gold amount to spawn (for gold vault) */
    goldAmount?: number;
}

import { registerSurfaces, unregisterSurfaces, WalkableSurface } from '@/lib/game/stairCollision';

export function Vault({ type, position, rotation = 0, onOpen, goldAmount = 100 }: VaultProps) {
    const groupRef = useRef<THREE.Group>(null);
    const doorRef = useRef<THREE.Mesh>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [showMessage, setShowMessage] = useState<string | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [worldPos] = useState(() => new THREE.Vector3());
    const { camera } = useThree();

    const useKey = useGameStore((state) => state.useKey);
    const collectGold = useGameStore((state) => state.collectGold);
    const dungeonState = useGameStore((state) => state.dungeonState);
    const gameState = useGameStore((state) => state.gameState);

    // Auto-generate ID for collision registration
    const vaultId = `vault-${type}-${position.join('-')}`;

    // Register top of the vault frame as a walkable surface
    useEffect(() => {
        if (!groupRef.current) return;

        groupRef.current.updateMatrixWorld(true);

        const worldPos = new THREE.Vector3();
        groupRef.current.getWorldPosition(worldPos);

        const quaternion = new THREE.Quaternion();
        groupRef.current.getWorldQuaternion(quaternion);
        const euler = new THREE.Euler().setFromQuaternion(quaternion);
        const angle = euler.y;

        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        // Top Frame Dimensions
        const frameWidth = VAULT_WIDTH + 2; // 12
        const frameDepth = VAULT_DEPTH + 1; // 2
        const frameHeight = 1;
        // Local center Y of the top frame mesh is VAULT_HEIGHT + 0.5
        // Top surface Y relative to group origin is VAULT_HEIGHT + 0.5 + frameHeight/2 = 13.5
        const topSurfaceY = VAULT_HEIGHT + 0.5 + frameHeight / 2;

        // AABB calculation for rotated frame
        const extentX = (frameWidth / 2) * Math.abs(cos) + (frameDepth / 2) * Math.abs(sin);
        const extentZ = (frameWidth / 2) * Math.abs(sin) + (frameDepth / 2) * Math.abs(cos);

        const surface: WalkableSurface = {
            id: `${vaultId}-top`,
            minX: worldPos.x - extentX,
            maxX: worldPos.x + extentX,
            minZ: worldPos.z - extentZ,
            maxZ: worldPos.z + extentZ,
            floorY: worldPos.y + topSurfaceY,
        };

        registerSurfaces(vaultId, [surface]);
        console.log(`Registered vault top "${vaultId}" at floorY: ${surface.floorY}`);

        return () => {
            unregisterSurfaces(vaultId);
        };
    }, [vaultId]); // vaultId already contains position info

    // Key requirements
    const requiredKey = type === 'gold' ? 'resonance' : 'melodic';
    const keyName = type === 'gold' ? 'Resonance Key' : 'Melodic Key';

    // Colors based on type
    const doorColor = type === 'gold' ? '#8B7500' : '#4a4a4a';
    const trimColor = type === 'gold' ? '#FFD700' : '#888888';
    const glowColor = type === 'gold' ? '#ffaa00' : '#6688ff';

    // Check proximity and animate door
    useFrame((state, delta) => {
        if (!groupRef.current) return;

        // Get world position
        groupRef.current.getWorldPosition(worldPos);

        // Check player distance
        if (gameState === 'playing') {
            const distance = camera.position.distanceTo(worldPos);
            setShowPrompt(distance < 20 && !isOpen);
        }

        // Open animation
        if (isOpen && doorRef.current) {
            const targetRotation = -Math.PI / 2; // Swing open 90 degrees
            doorRef.current.rotation.y = THREE.MathUtils.lerp(
                doorRef.current.rotation.y,
                targetRotation,
                delta * 3
            );
        }

        // Clear message after 3 seconds
        if (showMessage) {
            setTimeout(() => setShowMessage(null), 3000);
        }
    });

    const handleClick = (e: { stopPropagation?: () => void }) => {
        if (e.stopPropagation) e.stopPropagation();
        if (!showPrompt || isOpen) return;

        // Check if player has required key
        const hasKey = dungeonState && dungeonState.keys[requiredKey] > 0;

        if (hasKey) {
            // Use the key
            const success = useKey(requiredKey);
            if (success) {
                setIsOpen(true);
                setShowMessage('Vault opened!');
                console.log(`Opened ${type} vault!`);

                // Spawn gold for gold vaults
                if (type === 'gold') {
                    collectGold(goldAmount);
                    console.log(`Collected ${goldAmount} gold!`);
                }

                if (onOpen) onOpen();
            }
        } else {
            // Show required key message
            setShowMessage(`Requires ${keyName}`);
            console.log(`Need ${keyName} to open this vault`);
        }
    };

    return (
        <group ref={groupRef} position={position} rotation={[0, rotation, 0]}>
            {/* Door frame */}
            <mesh position={[-VAULT_WIDTH / 2 - 0.5, VAULT_HEIGHT / 2, 0]}>
                <boxGeometry args={[1, VAULT_HEIGHT + 1, VAULT_DEPTH + 1]} />
                <meshStandardMaterial color="#333333" roughness={0.8} />
            </mesh>
            <mesh position={[VAULT_WIDTH / 2 + 0.5, VAULT_HEIGHT / 2, 0]}>
                <boxGeometry args={[1, VAULT_HEIGHT + 1, VAULT_DEPTH + 1]} />
                <meshStandardMaterial color="#333333" roughness={0.8} />
            </mesh>
            <mesh position={[0, VAULT_HEIGHT + 0.5, 0]}>
                <boxGeometry args={[VAULT_WIDTH + 2, 1, VAULT_DEPTH + 1]} />
                <meshStandardMaterial color="#333333" roughness={0.8} />
            </mesh>

            {/* ... rest of component ... */}

            {/* Main door - animated */}
            <group position={[-VAULT_WIDTH / 2, 0, 0]}>
                <mesh
                    ref={doorRef}
                    position={[VAULT_WIDTH / 2, VAULT_HEIGHT / 2, 0]}
                    onClick={handleClick}
                    onPointerDown={handleClick}
                >
                    <boxGeometry args={[VAULT_WIDTH, VAULT_HEIGHT, VAULT_DEPTH]} />
                    <meshStandardMaterial
                        color={doorColor}
                        roughness={0.6}
                        metalness={0.4}
                        emissive={showPrompt && !isOpen ? glowColor : '#000000'}
                        emissiveIntensity={showPrompt && !isOpen ? 0.2 : 0}
                    />
                </mesh>
            </group>

            {/* Decorative reinforcement strips */}
            {[-3, 0, 3].map((xOffset, i) => (
                <mesh key={i} position={[xOffset, VAULT_HEIGHT / 2, VAULT_DEPTH / 2 + 0.02]}>
                    <boxGeometry args={[0.5, VAULT_HEIGHT - 1, 0.1]} />
                    <meshStandardMaterial color={trimColor} roughness={0.3} metalness={0.8} />
                </mesh>
            ))}

            {/* Horizontal reinforcement */}
            {[VAULT_HEIGHT / 4, VAULT_HEIGHT * 3 / 4].map((yOffset, i) => (
                <mesh key={i} position={[0, yOffset, VAULT_DEPTH / 2 + 0.02]}>
                    <boxGeometry args={[VAULT_WIDTH - 1, 0.4, 0.1]} />
                    <meshStandardMaterial color={trimColor} roughness={0.3} metalness={0.8} />
                </mesh>
            ))}

            {/* Keyhole */}
            <mesh position={[2, VAULT_HEIGHT / 2, VAULT_DEPTH / 2 + 0.1]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.15, 0.1, 0.2, 8]} />
                <meshStandardMaterial
                    color="#111111"
                    emissive={glowColor}
                    emissiveIntensity={showPrompt && !isOpen ? 1 : 0.3}
                />
            </mesh>

            {/* Keyhole glow ring */}
            <mesh position={[2, VAULT_HEIGHT / 2, VAULT_DEPTH / 2 + 0.15]}>
                <ringGeometry args={[0.2, 0.35, 16]} />
                <meshBasicMaterial
                    color={glowColor}
                    transparent
                    opacity={showPrompt && !isOpen ? 0.7 : 0.2}
                />
            </mesh>

            {/* Point light for keyhole glow */}
            <pointLight
                position={[2, VAULT_HEIGHT / 2, VAULT_DEPTH / 2 + 0.5]}
                intensity={showPrompt && !isOpen ? 20 : 5}
                color={glowColor}
                distance={10}
                decay={2}
            />

            {/* Message display - 2D overlay would be better but this works for 3D */}
            {showMessage && (
                <group position={[0, VAULT_HEIGHT + 2, 0]}>
                    {/* Text would go here - using simple shape for now */}
                </group>
            )}
        </group>
    );
}

export default Vault;
