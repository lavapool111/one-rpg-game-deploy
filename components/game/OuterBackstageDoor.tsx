'use client';

import { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '@/lib/store';
import { useInventoryStore } from '@/lib/store/inventoryStore';

/**
 * OuterBackstageDoor Component
 *
 * Interactive door at the end of East/West corridors that unlocks the Outer Backstage.
 * Costs 10 Infused Valves to permanently unlock.
 */

const DOOR_WIDTH = 10;
const DOOR_HEIGHT = 12.5;
const DOOR_THICKNESS = 3;
const UNLOCK_COST = 10;

interface OuterBackstageDoorProps {
    position: [number, number, number];
    rotation?: number;
}

export function OuterBackstageDoor({ position, rotation = 0 }: OuterBackstageDoorProps) {
    const groupRef = useRef<THREE.Group>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [worldPos] = useState(() => new THREE.Vector3());
    const { camera } = useThree();
    const frameCount = useRef(0);

    const unlocked = useGameStore((s) => s.outerBackstageUnlocked);
    const unlockAction = useGameStore((s) => s.unlockOuterBackstage);

    useFrame(() => {
        if (unlocked) return;

        frameCount.current++;
        if (frameCount.current % 10 !== 0) return;
        if (!groupRef.current) return;

        groupRef.current.getWorldPosition(worldPos);
        const distance = camera.position.distanceTo(worldPos);
        setShowPrompt(distance < 30);
    });

    const handleClick = (e: { stopPropagation?: () => void }) => {
        if (e.stopPropagation) e.stopPropagation();
        if (unlocked || !showPrompt) return;

        const inv = useInventoryStore.getState();
        const valves = inv.inventory.materials?.infused_valves ?? 0;
        if (valves < UNLOCK_COST) {
            console.log(`[OuterBackstageDoor] Not enough Infused Valves: ${valves}/${UNLOCK_COST}`);
            return;
        }

        // Consume valves
        inv.addMaterials({ infused_valves: -UNLOCK_COST });
        unlockAction();
        console.log('[OuterBackstageDoor] Outer Backstage unlocked!');
    };

    // When unlocked, render nothing — transparent passage
    if (unlocked) return null;

    return (
        <group ref={groupRef} position={position} rotation={[0, rotation, 0]}>
            {/* Main door */}
            <mesh
                position={[0, DOOR_HEIGHT / 2, 0]}
                onClick={handleClick}
                onPointerDown={handleClick}
            >
                <boxGeometry args={[DOOR_WIDTH, DOOR_HEIGHT, DOOR_THICKNESS]} />
                <meshStandardMaterial
                    color="#3d2a1f"
                    roughness={0.7}
                    metalness={0.1}
                    emissive={showPrompt ? '#4a2510' : '#000000'}
                    emissiveIntensity={showPrompt ? 0.4 : 0}
                />
            </mesh>

            {/* Door arch cap */}
            <mesh position={[0, DOOR_HEIGHT, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[DOOR_WIDTH / 2, DOOR_WIDTH / 2, DOOR_THICKNESS, 32, 1, false, Math.PI / 2, Math.PI]} />
                <meshStandardMaterial color="#3d2a1f" roughness={0.7} metalness={0.1} />
            </mesh>

            {/* Door handle — amber */}
            <mesh position={[DOOR_WIDTH / 2 - 1.5, DOOR_HEIGHT / 2, DOOR_THICKNESS / 2 + 0.1]}>
                <sphereGeometry args={[0.4, 8, 8]} />
                <meshStandardMaterial color="#cc8822" roughness={0.3} metalness={0.8} />
            </mesh>

            {/* Lock symbol ring — amber glow when affordable */}
            <mesh position={[0, DOOR_HEIGHT / 2, DOOR_THICKNESS / 2 + 0.1]}>
                <ringGeometry args={[4, 4.5, 32]} />
                <meshBasicMaterial
                    color={showPrompt ? '#cc8822' : '#555555'}
                    transparent
                    opacity={showPrompt ? 0.6 : 0.3}
                />
            </mesh>

            {/* Glow when player is near */}
            {showPrompt && (
                <pointLight
                    position={[0, DOOR_HEIGHT / 2, DOOR_THICKNESS / 2 + 2]}
                    intensity={40}
                    color="#cc8822"
                    distance={20}
                    decay={2}
                />
            )}
        </group>
    );
}

export default OuterBackstageDoor;
