'use client';

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import { usePlayerStore } from '@/lib/store';

/**
 * Player Component - Bb Clarinet
 * 
 * 3D representation of the player character as a Bb Clarinet.
 * Dimensions: 1.5 feet tall × 0.25 feet wide × 0.25 feet deep
 * 
 * Features:
 * - Follows camera position (first-person weapon view)
 * - Attack animation state
 * - Visual keys on the clarinet body
 */

// Dimensions in feet
const CLARINET_HEIGHT = 1.5;
const CLARINET_RADIUS = 0.08; // Thinner clarinet
const KEY_RADIUS = 0.03;

// Colors
const BODY_COLOR = '#1a1a1a'; // Dark black/ebony wood
const KEY_COLOR = '#C0C0C0'; // Silver keys
const BELL_COLOR = '#2a2a2a'; // Slightly lighter black

interface PlayerProps {
    /** Offset from camera position */
    offset?: [number, number, number];
    /** Whether player is visible */
    visible?: boolean;
}

export function Player({ 
    offset = [0.3, -0.4, -0.8], // Right, down, forward from camera
    visible = true 
}: PlayerProps) {
    const groupRef = useRef<Group>(null);
    const { camera } = useThree();
    
    // Player store state
    const isAttacking = usePlayerStore((state) => state.isAttacking);
    const stopAttack = usePlayerStore((state) => state.stopAttack);
    
    // Attack animation progress
    const attackProgress = useRef(0);
    const baseRotation = useRef({ x: -0.2, y: 0.1, z: 0 });

    // Reusable vectors to avoid garbage collection
    const cameraPosition = useRef(new Vector3());
    const cameraDirection = useRef(new Vector3());
    const rightVec = useRef(new Vector3());
    const upVec = useRef(new Vector3());
    const offsetPosition = useRef(new Vector3());

    // Follow camera position each frame
    useFrame((state, delta) => {
        if (!groupRef.current) return;

        // Get camera world position and direction (reusing vectors)
        camera.getWorldPosition(cameraPosition.current);
        camera.getWorldDirection(cameraDirection.current);

        // Calculate offset position relative to camera
        rightVec.current.crossVectors(cameraDirection.current, camera.up).normalize();
        upVec.current.copy(camera.up);

        // Apply offset: right, up, forward
        offsetPosition.current.copy(cameraPosition.current)
            .addScaledVector(rightVec.current, offset[0])
            .addScaledVector(upVec.current, offset[1])
            .addScaledVector(cameraDirection.current, -offset[2]);

        groupRef.current.position.copy(offsetPosition.current);

        // Match camera rotation
        groupRef.current.rotation.copy(camera.rotation);

        // Apply base rotation offset (clarinet angled)
        groupRef.current.rotation.x += baseRotation.current.x;
        groupRef.current.rotation.y += baseRotation.current.y;
        groupRef.current.rotation.z += baseRotation.current.z;

        // Attack animation
        if (isAttacking) {
            attackProgress.current += delta * 8; // Fast attack
            
            // Quick thrust forward and rotate
            const attackPhase = Math.sin(attackProgress.current * Math.PI);
            groupRef.current.position.addScaledVector(cameraDirection.current, attackPhase * 0.3);
            groupRef.current.rotation.x += attackPhase * 0.3;
            
            // End attack after full cycle
            if (attackProgress.current >= 1) {
                attackProgress.current = 0;
                stopAttack();
            }
        }
    });

    // Handle mouse click for attack
    useEffect(() => {
        const handleClick = (event: MouseEvent) => {
            // Only attack on left click when pointer is locked
            if (event.button === 0 && document.pointerLockElement) {
                usePlayerStore.getState().attack();
            }
        };

        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    if (!visible) return null;

    return (
        <group ref={groupRef}>
            {/* === UPPER JOINT (Top section with mouthpiece) === */}
            
            {/* Mouthpiece - tapered black piece at very top */}
            <mesh position={[0, CLARINET_HEIGHT / 2 + 0.18, 0]} rotation={[0.15, 0, 0]}>
                <cylinderGeometry args={[CLARINET_RADIUS * 0.4, CLARINET_RADIUS * 0.7, 0.12, 16]} />
                <meshStandardMaterial color="#0a0a0a" roughness={0.1} metalness={0.2} />
            </mesh>
            
            {/* Barrel - short cylindrical connector */}
            <mesh position={[0, CLARINET_HEIGHT / 2 + 0.06, 0]}>
                <cylinderGeometry args={[CLARINET_RADIUS * 0.95, CLARINET_RADIUS * 0.95, 0.1, 16]} />
                <meshStandardMaterial color={BODY_COLOR} roughness={0.3} metalness={0.1} />
            </mesh>
            
            {/* Upper joint ring (metal) */}
            <mesh position={[0, CLARINET_HEIGHT / 2 + 0.01, 0]}>
                <cylinderGeometry args={[CLARINET_RADIUS * 1.02, CLARINET_RADIUS * 1.02, 0.02, 16]} />
                <meshStandardMaterial color={KEY_COLOR} roughness={0.2} metalness={0.9} />
            </mesh>
            
            {/* === MAIN BODY (Upper and Lower Joints) === */}
            
            {/* Main body - long black cylinder */}
            <mesh position={[0, 0, 0]}>
                <cylinderGeometry args={[CLARINET_RADIUS, CLARINET_RADIUS, CLARINET_HEIGHT, 16]} />
                <meshStandardMaterial color={BODY_COLOR} roughness={0.3} metalness={0.1} />
            </mesh>
            
            {/* === KEY MECHANISMS - Left side (flat keys without rods) === */}
            
            {/* Flat keys on left side */}
            {[0.35, 0.2, 0.05, -0.1, -0.25].map((yOffset, i) => (
                <mesh key={`key-left-${i}`} position={[-CLARINET_RADIUS - 0.015, yOffset, 0]} rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[0.025, 0.025, 0.015, 8]} />
                    <meshStandardMaterial color={KEY_COLOR} roughness={0.15} metalness={0.9} />
                </mesh>
            ))}
            
            {/* === KEY MECHANISMS - Right side === */}
            
            {/* Flat keys on right side */}
            {[-0.2, -0.05, 0.1].map((yOffset, i) => (
                <mesh key={`key-right-${i}`} position={[CLARINET_RADIUS + 0.015, yOffset, 0]} rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[0.018, 0.018, 0.01, 8]} />
                    <meshStandardMaterial color={KEY_COLOR} roughness={0.15} metalness={0.9} />
                </mesh>
            ))}
            
            {/* === TONE HOLES (covered by keys) === */}
            {[0.45, 0.32, 0.19, 0.06, -0.07, -0.2].map((yOffset, i) => (
                <mesh key={`hole-${i}`} position={[0, yOffset, CLARINET_RADIUS + 0.005]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.018, 0.018, 0.01, 12]} />
                    <meshStandardMaterial color="#000000" />
                </mesh>
            ))}
            
            {/* === BELL (Flared bottom end) === */}
            
            {/* Lower joint ring */}
            <mesh position={[0, -CLARINET_HEIGHT / 2 + 0.01, 0]}>
                <cylinderGeometry args={[CLARINET_RADIUS * 1.02, CLARINET_RADIUS * 1.02, 0.02, 16]} />
                <meshStandardMaterial color={KEY_COLOR} roughness={0.2} metalness={0.9} />
            </mesh>
            
            {/* Bell - flared section */}
            <mesh position={[0, -CLARINET_HEIGHT / 2 - 0.08, 0]}>
                <cylinderGeometry args={[CLARINET_RADIUS * 1.05, CLARINET_RADIUS * 1.6, 0.18, 16]} />
                <meshStandardMaterial color={BELL_COLOR} roughness={0.25} metalness={0.15} />
            </mesh>
            
            {/* Bell ring (metal trim at bottom) */}
            <mesh position={[0, -CLARINET_HEIGHT / 2 - 0.16, 0]}>
                <cylinderGeometry args={[CLARINET_RADIUS * 1.62, CLARINET_RADIUS * 1.65, 0.02, 16]} />
                <meshStandardMaterial color={KEY_COLOR} roughness={0.2} metalness={0.9} />
            </mesh>
        </group>
    );
}

export default Player;
