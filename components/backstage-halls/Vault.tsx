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

import { registerSurfaces, unregisterSurfaces, WalkableSurface, registerObstacles, unregisterObstacles, Obstacle } from '@/lib/game/stairCollision';

export function Vault({ type, position, rotation = 0, onOpen, goldAmount = 100 }: VaultProps) {
    const groupRef = useRef<THREE.Group>(null);
    const doorRef = useRef<THREE.Mesh>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [showMessage, setShowMessage] = useState<string | null>(null);
    const showPromptRef = useRef(false);
    const doorMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
    const keyholeMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
    const keyholeRingMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
    const keyholePointLightRef = useRef<THREE.PointLight>(null);
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

        let registeredId = '';
        let lastWorldPosX = -999999;

        const interval = setInterval(() => {
            if (!groupRef.current) return;

            groupRef.current.updateMatrixWorld(true);

            const worldPos = new THREE.Vector3();
            groupRef.current.getWorldPosition(worldPos);

            // Only update if position changed
            if (Math.abs(worldPos.x - lastWorldPosX) < 0.01) return;
            lastWorldPosX = worldPos.x;

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
            registeredId = vaultId;
        }, 500);

        return () => {
            clearInterval(interval);
            if (registeredId) {
                unregisterSurfaces(registeredId);
            }
        };
    }, [vaultId]); // vaultId already contains position info

    // Register closed vault door as an obstacle for collision
    useEffect(() => {
        if (!groupRef.current || isOpen) return;

        let registeredId = '';
        let lastWorldPosX = -999999; // Force initial update

        const interval = setInterval(() => {
            if (!groupRef.current || isOpen) return;

            groupRef.current.updateMatrixWorld(true);

            const worldPos = new THREE.Vector3();
            groupRef.current.getWorldPosition(worldPos);

            // Only update if position actually changed (like after initial scene graph composition)
            if (Math.abs(worldPos.x - lastWorldPosX) < 0.01) return;
            lastWorldPosX = worldPos.x;

            const quaternion = new THREE.Quaternion();
            groupRef.current.getWorldQuaternion(quaternion);
            const euler = new THREE.Euler().setFromQuaternion(quaternion);
            const angle = euler.y;

            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            // The door bounds
            const doorWidth = VAULT_WIDTH;
            const doorDepth = VAULT_DEPTH;

            const extentX = (doorWidth / 2) * Math.abs(cos) + (doorDepth / 2) * Math.abs(sin);
            const extentZ = (doorWidth / 2) * Math.abs(sin) + (doorDepth / 2) * Math.abs(cos);

            const obstacle: Obstacle = {
                id: `${vaultId}-door`,
                minX: worldPos.x - extentX,
                maxX: worldPos.x + extentX,
                minZ: worldPos.z - extentZ,
                maxZ: worldPos.z + extentZ,
                minY: worldPos.y,
                maxY: worldPos.y + VAULT_HEIGHT,
            };

            registerObstacles(vaultId, [obstacle]);
            registeredId = vaultId;
            // Removed console log to avoid spam
        }, 500); // Check twice a second

        return () => {
            clearInterval(interval);
            if (registeredId) {
                unregisterObstacles(registeredId);
            }
        };
    }, [vaultId, isOpen]);

    // Key requirements
    const requiredKey = type === 'gold' ? 'resonance' : 'melodic';
    const keyName = type === 'gold' ? 'Resonance Key' : 'Melodic Key';

    // Colors based on type
    const doorColor = type === 'gold' ? '#8B7500' : '#4a4a4a';
    const trimColor = type === 'gold' ? '#FFD700' : '#888888';
    const glowColor = type === 'gold' ? '#ffaa00' : '#6688ff';

    const vaultFrameCount = useRef(0);

    // Check proximity and animate door
    useFrame((_state, delta) => {
        if (!groupRef.current) return;

        // Open animation (runs every frame for smooth motion)
        if (isOpen && doorRef.current) {
            const targetRotation = -Math.PI / 2; // Swing open 90 degrees
            doorRef.current.rotation.y = THREE.MathUtils.lerp(
                doorRef.current.rotation.y,
                targetRotation,
                delta * 3
            );
        }

        // Throttle proximity check to every 8 frames
        vaultFrameCount.current++;
        if (vaultFrameCount.current % 8 !== 0) return;

        // Get world position
        groupRef.current.getWorldPosition(worldPos);

        // Check player distance — update ref (no React re-render)
        if (gameState === 'playing') {
            const distance = camera.position.distanceTo(worldPos);
            const shouldPrompt = distance < 20 && !isOpen;
            if (shouldPrompt !== showPromptRef.current) {
                showPromptRef.current = shouldPrompt;
                // Imperatively update materials to avoid re-renders
                if (doorMaterialRef.current) {
                    doorMaterialRef.current.emissive.set(shouldPrompt ? glowColor : '#000000');
                    doorMaterialRef.current.emissiveIntensity = shouldPrompt ? 0.2 : 0;
                }
                if (keyholeMaterialRef.current) {
                    keyholeMaterialRef.current.emissiveIntensity = shouldPrompt ? 1 : 0.3;
                }
                if (keyholeRingMaterialRef.current) {
                    keyholeRingMaterialRef.current.opacity = shouldPrompt ? 0.7 : 0.2;
                }
                if (keyholePointLightRef.current) {
                    keyholePointLightRef.current.intensity = shouldPrompt ? 20 : 5;
                }
            }
        }

        // Clear message after 3 seconds
        if (showMessage) {
            setTimeout(() => setShowMessage(null), 3000);
        }
    });

    const handleClick = (e: { stopPropagation?: () => void }) => {
        if (e.stopPropagation) e.stopPropagation();
        if (!showPromptRef.current || isOpen) return;

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
                        ref={doorMaterialRef}
                        color={doorColor}
                        roughness={0.6}
                        metalness={0.4}
                        emissive={'#000000'}
                        emissiveIntensity={0}
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
                    ref={keyholeMaterialRef}
                    color="#111111"
                    emissive={glowColor}
                    emissiveIntensity={0.3}
                />
            </mesh>

            {/* Keyhole glow ring */}
            <mesh position={[2, VAULT_HEIGHT / 2, VAULT_DEPTH / 2 + 0.15]}>
                <ringGeometry args={[0.2, 0.35, 16]} />
                <meshBasicMaterial
                    ref={keyholeRingMaterialRef}
                    color={glowColor}
                    transparent
                    opacity={0.2}
                />
            </mesh>

            {/* Point light for keyhole glow */}
            <pointLight
                ref={keyholePointLightRef}
                position={[2, VAULT_HEIGHT / 2, VAULT_DEPTH / 2 + 0.5]}
                intensity={5}
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
