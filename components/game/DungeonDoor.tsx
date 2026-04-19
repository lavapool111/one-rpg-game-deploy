'use client';

import { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '@/lib/store';

/**
 * DungeonDoor Component
 * 
 * Interactive door in the south corridor that leads to Backstage Halls.
 * Fills the full corridor opening (10m wide x 12.5m tall x 3ft thick).
 */

// Door dimensions to match corridor (12.5ft tall to match corridorHeight)
const DOOR_WIDTH = 10;
const DOOR_HEIGHT = 12.5;
const DOOR_THICKNESS = 3; // 3 feet thick

interface DungeonDoorProps {
    /** Position of the door */
    position: [number, number, number];
    /** Rotation around Y axis */
    rotation?: number;
    /** Callback when door is activated */
    onEnter?: () => void;
    /** Whether the door is locked / inactive */
    locked?: boolean;
}

export function DungeonDoor({ position, rotation = 0, onEnter, locked = false }: DungeonDoorProps) {
    const groupRef = useRef<THREE.Group>(null);
    const meshRef = useRef<THREE.Mesh>(null);
    const [hovered, _setHovered] = useState(false);
    const [showPrompt, setShowPrompt] = useState(false);
    const [worldPos] = useState(() => new THREE.Vector3());
    const { camera } = useThree();
    const enterDungeon = useGameStore((state) => state.enterDungeon);
    const gameState = useGameStore((state) => state.gameState);

    const doorFrameCount = useRef(0);

    // Check if player is close enough to interact (throttled to every 10 frames)
    useFrame(() => {
        if (locked) {
            if (showPrompt) setShowPrompt(false);
            return;
        }

        doorFrameCount.current++;
        if (doorFrameCount.current % 10 !== 0) return;
        if (!groupRef.current) return;

        // Get world position of the door
        groupRef.current.getWorldPosition(worldPos);

        // Get camera position
        const distance = camera.position.distanceTo(worldPos);
        const isNear = distance < 30; // Within 30 feet for large door

        setShowPrompt(isNear && gameState === 'playing');
    });

    const handleClick = (e: { stopPropagation?: () => void }) => {
        if (e.stopPropagation) e.stopPropagation();
        if (locked) return;
        if (showPrompt) {
            console.log('DungeonDoor activated - entering Backstage Halls');
            enterDungeon();
            if (onEnter) onEnter();
        }
    };

    return (
        <group ref={groupRef} position={position} rotation={[0, rotation, 0]}>
            {/* Main door (interactive) - fills full corridor, 3ft thick */}
            <mesh
                ref={meshRef}
                position={[0, DOOR_HEIGHT / 2, 0]}
                onClick={handleClick}
                onPointerDown={handleClick}
            >
                <boxGeometry args={[DOOR_WIDTH, DOOR_HEIGHT, DOOR_THICKNESS]} />
                <meshStandardMaterial
                    color={hovered ? '#8B4513' : '#5c3d2e'}
                    roughness={0.7}
                    metalness={0.1}
                    emissive={showPrompt ? '#4a2510' : '#000000'}
                    emissiveIntensity={showPrompt ? 0.4 : 0}
                />
            </mesh>

            {/* Door arch cap - fills ceiling gap to match corridor walls */}
            <mesh position={[0, DOOR_HEIGHT, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[DOOR_WIDTH / 2, DOOR_WIDTH / 2, DOOR_THICKNESS, 32, 1, false, Math.PI / 2, Math.PI]} />
                <meshStandardMaterial
                    color="#5c3d2e"
                    roughness={0.7}
                    metalness={0.1}
                />
            </mesh>

            {/* Door handle */}
            <mesh position={[DOOR_WIDTH / 2 - 1.5, DOOR_HEIGHT / 2, DOOR_THICKNESS / 2 + 0.1]}>
                <sphereGeometry args={[0.4, 8, 8]} />
                <meshStandardMaterial color={locked ? "#666666" : "#DAA520"} roughness={0.3} metalness={0.8} />
            </mesh>

            {/* Decorative arch glow (magic effect) */}
            <mesh position={[0, DOOR_HEIGHT / 2, DOOR_THICKNESS / 2 + 0.1]}>
                <ringGeometry args={[4, 4.5, 32]} />
                <meshBasicMaterial
                    color={locked ? "#444444" : "#6a4fd1"}
                    transparent
                    opacity={locked ? 0.3 : (showPrompt ? 0.6 : 0.2)}
                />
            </mesh>

            {/* Point light for glow effect */}
            {!locked && (
                <pointLight
                    position={[0, DOOR_HEIGHT / 2, DOOR_THICKNESS / 2 + 2]}
                    intensity={showPrompt ? 50 : 15}
                    color="#6a4fd1"
                    distance={25}
                    decay={2}
                />
            )}
        </group>
    );
}

// Export door dimensions for collision detection
export const DUNGEON_DOOR_THICKNESS = DOOR_THICKNESS;

export default DungeonDoor;

