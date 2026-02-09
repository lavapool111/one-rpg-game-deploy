'use client';

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import { usePlayerStore } from '@/lib/store';

/**
 * Player Component - Instrument Model
 * 
 * 3D representation of the player character as their chosen instrument.
 * Bb Clarinet: Dark cylindrical body with silver keys
 * Viola: Warm wooden body with strings and scroll
 * 
 * Features:
 * - Follows camera position (first-person weapon view)
 * - Attack animation state
 * - Class-specific visual appearance
 */

// Clarinet Dimensions
const CLARINET_HEIGHT = 1.5;
const CLARINET_RADIUS = 0.08;

// Viola Dimensions
const VIOLA_HEIGHT = 1.4;
const VIOLA_WIDTH = 0.35;
const VIOLA_DEPTH = 0.08;

// Colors
const CLARINET_BODY_COLOR = '#1a1a1a';
const KEY_COLOR = '#C0C0C0';
const BELL_COLOR = '#2a2a2a';

const VIOLA_BODY_COLOR = '#8B4513'; // Warm brown wood
const VIOLA_DARK_COLOR = '#5C3317'; // Darker accents
const VIOLA_STRING_COLOR = '#E8E8E8'; // Silver strings
const VIOLA_FINGERBOARD_COLOR = '#1a1a1a'; // Black ebony

interface PlayerProps {
    offset?: [number, number, number];
    visible?: boolean;
}

export function Player({
    offset = [0.3, -0.4, -0.8],
    visible = true
}: PlayerProps) {
    const groupRef = useRef<Group>(null);
    const animRef = useRef<Group>(null);
    const { camera } = useThree();

    const isAttacking = usePlayerStore((state) => state.isAttacking);
    const stopAttack = usePlayerStore((state) => state.stopAttack);
    const playerClass = usePlayerStore((state) => state.playerClass);

    const attackProgress = useRef(0);
    const baseRotation = useRef({ x: -0.2, y: 0.1, z: 0 });

    useFrame((state, delta) => {
        if (!groupRef.current) return;

        groupRef.current.position.copy(camera.position);
        groupRef.current.rotation.copy(camera.rotation);

        if (animRef.current) {
            animRef.current.position.set(offset[0], offset[1], offset[2]);
            animRef.current.rotation.set(
                baseRotation.current.x,
                baseRotation.current.y,
                baseRotation.current.z
            );

            if (isAttacking) {
                attackProgress.current += delta * 8;
                const attackPhase = Math.sin(attackProgress.current * Math.PI);

                animRef.current.position.z -= attackPhase * 0.4;
                animRef.current.rotation.x += attackPhase * 0.2;
                animRef.current.rotation.z -= attackPhase * 0.05;

                if (attackProgress.current >= 1) {
                    attackProgress.current = 0;
                    stopAttack();
                }
            }
        }
    });

    useEffect(() => {
        const handleMouseDown = (event: MouseEvent) => {
            const isLocked = document.pointerLockElement !== null;
            if (event.button === 0 && isLocked) {
                usePlayerStore.getState().attack();
            }
        };

        window.addEventListener('mousedown', handleMouseDown);
        return () => window.removeEventListener('mousedown', handleMouseDown);
    }, []);

    if (!visible) return null;

    return (
        <group ref={groupRef}>
            <group ref={animRef}>
                {playerClass === 'viola' ? <ViolaModel /> : <ClarinetModel />}
            </group>
        </group>
    );
}

/** Clarinet Model - Original dark woodwind with silver keys */
function ClarinetModel() {
    return (
        <>
            {/* Mouthpiece */}
            <mesh position={[0, CLARINET_HEIGHT / 2 + 0.18, 0]} rotation={[0.15, 0, 0]}>
                <cylinderGeometry args={[CLARINET_RADIUS * 0.4, CLARINET_RADIUS * 0.7, 0.12, 16]} />
                <meshStandardMaterial color="#0a0a0a" roughness={0.1} metalness={0.2} />
            </mesh>

            {/* Barrel */}
            <mesh position={[0, CLARINET_HEIGHT / 2 + 0.06, 0]}>
                <cylinderGeometry args={[CLARINET_RADIUS * 0.95, CLARINET_RADIUS * 0.95, 0.1, 16]} />
                <meshStandardMaterial color={CLARINET_BODY_COLOR} roughness={0.3} metalness={0.1} />
            </mesh>

            {/* Upper joint ring */}
            <mesh position={[0, CLARINET_HEIGHT / 2 + 0.01, 0]}>
                <cylinderGeometry args={[CLARINET_RADIUS * 1.02, CLARINET_RADIUS * 1.02, 0.02, 16]} />
                <meshStandardMaterial color={KEY_COLOR} roughness={0.2} metalness={0.9} />
            </mesh>

            {/* Main body */}
            <mesh position={[0, 0, 0]}>
                <cylinderGeometry args={[CLARINET_RADIUS, CLARINET_RADIUS, CLARINET_HEIGHT, 16]} />
                <meshStandardMaterial color={CLARINET_BODY_COLOR} roughness={0.3} metalness={0.1} />
            </mesh>

            {/* Left side keys */}
            {[0.35, 0.2, 0.05, -0.1, -0.25].map((yOffset, i) => (
                <mesh key={`key-left-${i}`} position={[-CLARINET_RADIUS - 0.015, yOffset, 0]} rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[0.025, 0.025, 0.015, 8]} />
                    <meshStandardMaterial color={KEY_COLOR} roughness={0.15} metalness={0.9} />
                </mesh>
            ))}

            {/* Right side keys */}
            {[-0.2, -0.05, 0.1].map((yOffset, i) => (
                <mesh key={`key-right-${i}`} position={[CLARINET_RADIUS + 0.015, yOffset, 0]} rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[0.018, 0.018, 0.01, 8]} />
                    <meshStandardMaterial color={KEY_COLOR} roughness={0.15} metalness={0.9} />
                </mesh>
            ))}

            {/* Tone holes */}
            {[0.45, 0.32, 0.19, 0.06, -0.07, -0.2].map((yOffset, i) => (
                <mesh key={`hole-${i}`} position={[0, yOffset, CLARINET_RADIUS + 0.005]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.018, 0.018, 0.01, 12]} />
                    <meshStandardMaterial color="#000000" />
                </mesh>
            ))}

            {/* Lower joint ring */}
            <mesh position={[0, -CLARINET_HEIGHT / 2 + 0.01, 0]}>
                <cylinderGeometry args={[CLARINET_RADIUS * 1.02, CLARINET_RADIUS * 1.02, 0.02, 16]} />
                <meshStandardMaterial color={KEY_COLOR} roughness={0.2} metalness={0.9} />
            </mesh>

            {/* Bell */}
            <mesh position={[0, -CLARINET_HEIGHT / 2 - 0.08, 0]}>
                <cylinderGeometry args={[CLARINET_RADIUS * 1.05, CLARINET_RADIUS * 1.6, 0.18, 16]} />
                <meshStandardMaterial color={BELL_COLOR} roughness={0.25} metalness={0.15} />
            </mesh>

            {/* Bell ring */}
            <mesh position={[0, -CLARINET_HEIGHT / 2 - 0.16, 0]}>
                <cylinderGeometry args={[CLARINET_RADIUS * 1.62, CLARINET_RADIUS * 1.65, 0.02, 16]} />
                <meshStandardMaterial color={KEY_COLOR} roughness={0.2} metalness={0.9} />
            </mesh>
        </>
    );
}

/** Viola Model - Warm wooden string instrument with elegant curves */
function ViolaModel() {
    return (
        <>
            {/* === SCROLL (Top ornamental curl) === */}
            <mesh position={[0, VIOLA_HEIGHT / 2 + 0.12, 0]} rotation={[0.1, 0, 0]}>
                <sphereGeometry args={[0.04, 12, 12]} />
                <meshStandardMaterial color={VIOLA_DARK_COLOR} roughness={0.4} />
            </mesh>

            {/* Pegbox - slightly rounded */}
            <mesh position={[0, VIOLA_HEIGHT / 2 + 0.04, 0]} scale={[1.2, 3, 1]}>
                <sphereGeometry args={[0.02, 8, 8]} />
                <meshStandardMaterial color={VIOLA_DARK_COLOR} roughness={0.4} />
            </mesh>

            {/* Tuning pegs */}
            {[-0.03, 0.03].map((x, i) => (
                <mesh key={`peg-${i}`} position={[x, VIOLA_HEIGHT / 2 + 0.06, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.01, 0.008, 0.04, 8]} />
                    <meshStandardMaterial color={VIOLA_DARK_COLOR} roughness={0.3} />
                </mesh>
            ))}

            {/* === NECK - rounded cylinder === */}
            <mesh position={[0, VIOLA_HEIGHT / 2 - 0.1, 0]}>
                <cylinderGeometry args={[0.018, 0.022, 0.28, 12]} />
                <meshStandardMaterial color={VIOLA_BODY_COLOR} roughness={0.35} />
            </mesh>

            {/* Fingerboard (black, slightly rounded) */}
            <mesh position={[0, VIOLA_HEIGHT / 2 - 0.1, 0.018]} scale={[1, 1, 0.3]}>
                <cylinderGeometry args={[0.016, 0.02, 0.3, 8]} />
                <meshStandardMaterial color={VIOLA_FINGERBOARD_COLOR} roughness={0.2} />
            </mesh>

            {/* === MAIN BODY (Organic figure-8 using ellipsoids) === */}

            {/* Upper bout - ellipsoid (smaller top bulge) */}
            <mesh position={[0, 0.18, 0]} scale={[VIOLA_WIDTH * 1.8, 0.42, VIOLA_DEPTH * 1.2]}>
                <sphereGeometry args={[0.5, 24, 16]} />
                <meshStandardMaterial color={VIOLA_BODY_COLOR} roughness={0.35} />
            </mesh>

            {/* C-bout (waist) - narrower ellipsoid */}
            <mesh position={[0, -0.02, 0]} scale={[VIOLA_WIDTH * 1.4, 0.2, VIOLA_DEPTH * 1.1]}>
                <sphereGeometry args={[0.5, 24, 16]} />
                <meshStandardMaterial color={VIOLA_BODY_COLOR} roughness={0.35} />
            </mesh>

            {/* Lower bout - larger ellipsoid (bottom bulge) */}
            <mesh position={[0, -0.28, 0]} scale={[VIOLA_WIDTH * 2.2, 0.52, VIOLA_DEPTH * 1.3]}>
                <sphereGeometry args={[0.5, 24, 16]} />
                <meshStandardMaterial color={VIOLA_BODY_COLOR} roughness={0.35} />
            </mesh>

            {/* === F-HOLES (Sound holes) - curved slits === */}
            {[-0.08, 0.08].map((x, i) => (
                <mesh key={`f-hole-${i}`} position={[x, -0.15, VIOLA_DEPTH / 2 + 0.015]} rotation={[0, 0, i === 0 ? 0.25 : -0.25]} scale={[0.3, 1, 0.5]}>
                    <capsuleGeometry args={[0.015, 0.08, 4, 8]} />
                    <meshStandardMaterial color="#0a0a0a" />
                </mesh>
            ))}

            {/* === BRIDGE - curved top === */}
            <mesh position={[0, -0.18, VIOLA_DEPTH / 2 + 0.02]} scale={[1, 0.7, 0.3]}>
                <sphereGeometry args={[0.06, 12, 8]} />
                <meshStandardMaterial color="#D2B48C" roughness={0.4} />
            </mesh>

            {/* === STRINGS (4 strings) === */}
            {[-0.022, -0.007, 0.007, 0.022].map((x, i) => (
                <mesh key={`string-${i}`} position={[x, VIOLA_HEIGHT / 2 - 0.32, VIOLA_DEPTH / 2 + 0.025]}>
                    <cylinderGeometry args={[0.002, 0.002, 0.85, 6]} />
                    <meshStandardMaterial color={VIOLA_STRING_COLOR} roughness={0.1} metalness={0.8} />
                </mesh>
            ))}

            {/* === TAILPIECE - rounded === */}
            <mesh position={[0, -VIOLA_HEIGHT / 2 + 0.08, VIOLA_DEPTH / 2 + 0.015]} scale={[1.5, 2.5, 0.5]}>
                <sphereGeometry args={[0.025, 10, 8]} />
                <meshStandardMaterial color={VIOLA_FINGERBOARD_COLOR} roughness={0.3} />
            </mesh>

            {/* === CHINREST - organic curve === */}
            <mesh position={[0.1, -VIOLA_HEIGHT / 2 + 0.18, VIOLA_DEPTH / 2 + 0.025]} scale={[1.2, 1.5, 0.4]}>
                <sphereGeometry args={[0.035, 10, 8]} />
                <meshStandardMaterial color={VIOLA_FINGERBOARD_COLOR} roughness={0.3} />
            </mesh>
        </>
    );
}

export default Player;
