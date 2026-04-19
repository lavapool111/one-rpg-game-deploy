'use client';

import { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3 } from 'three';
import * as THREE from 'three';
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
        // No longer handling global input here, moved to FirstPersonController
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

            {/* === LEFT SIDE KEY MECHANISMS (lever arms + round pads) === */}
            {[
                { y: 0.35, padR: 0.022, armLen: 0.04 },
                { y: 0.20, padR: 0.020, armLen: 0.035 },
                { y: 0.05, padR: 0.022, armLen: 0.04 },
                { y: -0.10, padR: 0.018, armLen: 0.03 },
                { y: -0.25, padR: 0.020, armLen: 0.035 },
            ].map((key, i) => (
                <group key={`key-left-${i}`} position={[-CLARINET_RADIUS, key.y, 0]}>
                    {/* Lever arm */}
                    <mesh position={[-key.armLen / 2, 0, 0]} rotation={[0, 0, 0]}>
                        <boxGeometry args={[key.armLen, 0.006, 0.008]} />
                        <meshStandardMaterial color={KEY_COLOR} roughness={0.15} metalness={0.9} />
                    </mesh>
                    {/* Round pad at end */}
                    <mesh position={[-key.armLen, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                        <cylinderGeometry args={[key.padR, key.padR, 0.005, 12]} />
                        <meshStandardMaterial color={KEY_COLOR} roughness={0.2} metalness={0.85} />
                    </mesh>
                    {/* Hinge post */}
                    <mesh position={[-0.003, 0, 0]}>
                        <sphereGeometry args={[0.006, 6, 6]} />
                        <meshStandardMaterial color={KEY_COLOR} roughness={0.2} metalness={0.9} />
                    </mesh>
                </group>
            ))}

            {/* Left connecting rod (runs along body) */}
            <mesh position={[-CLARINET_RADIUS - 0.005, 0.05, 0]}>
                <cylinderGeometry args={[0.003, 0.003, 0.65, 6]} />
                <meshStandardMaterial color={KEY_COLOR} roughness={0.15} metalness={0.9} />
            </mesh>

            {/* === RIGHT SIDE KEY MECHANISMS === */}
            {[
                { y: 0.10, padR: 0.016, armLen: 0.03 },
                { y: -0.05, padR: 0.018, armLen: 0.035 },
                { y: -0.20, padR: 0.016, armLen: 0.03 },
            ].map((key, i) => (
                <group key={`key-right-${i}`} position={[CLARINET_RADIUS, key.y, 0]}>
                    {/* Lever arm */}
                    <mesh position={[key.armLen / 2, 0, 0]}>
                        <boxGeometry args={[key.armLen, 0.005, 0.007]} />
                        <meshStandardMaterial color={KEY_COLOR} roughness={0.15} metalness={0.9} />
                    </mesh>
                    {/* Round pad */}
                    <mesh position={[key.armLen, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                        <cylinderGeometry args={[key.padR, key.padR, 0.005, 12]} />
                        <meshStandardMaterial color={KEY_COLOR} roughness={0.2} metalness={0.85} />
                    </mesh>
                    {/* Hinge post */}
                    <mesh position={[0.003, 0, 0]}>
                        <sphereGeometry args={[0.005, 6, 6]} />
                        <meshStandardMaterial color={KEY_COLOR} roughness={0.2} metalness={0.9} />
                    </mesh>
                </group>
            ))}

            {/* Right connecting rod */}
            <mesh position={[CLARINET_RADIUS + 0.005, -0.05, 0]}>
                <cylinderGeometry args={[0.003, 0.003, 0.35, 6]} />
                <meshStandardMaterial color={KEY_COLOR} roughness={0.15} metalness={0.9} />
            </mesh>

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
    // Create the Viola body shape (hourglass)
    const violaShape = useMemo(() => {
        const shape = new THREE.Shape();
        const w = VIOLA_WIDTH;
        const h = VIOLA_HEIGHT * 0.6; // Body is roughly 60% of total height

        // Start at middle-left (waist)
        shape.moveTo(-w * 0.35, 0);

        // Upper bout (top bulge)
        shape.bezierCurveTo(
            -w * 0.8, h * 0.2,   // control point 1
            -w * 0.7, h * 0.5,   // control point 2
            0, h * 0.5           // top center
        );
        shape.bezierCurveTo(
            w * 0.7, h * 0.5,
            w * 0.8, h * 0.2,
            w * 0.35, 0
        );

        // Lower bout (bottom bulge)
        shape.bezierCurveTo(
            w * 0.9, -h * 0.3,
            w * 0.8, -h * 0.6,
            0, -h * 0.6
        );
        shape.bezierCurveTo(
            -w * 0.8, -h * 0.6,
            -w * 0.9, -h * 0.3,
            -w * 0.35, 0
        );

        return shape;
    }, []);

    const extrudeSettings = useMemo(() => ({
        depth: VIOLA_DEPTH,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.02,
        bevelSegments: 5
    }), []);

    // Bridge Shape (thin, arched)
    const bridgeShape = useMemo(() => {
        const shape = new THREE.Shape();
        const w = 0.08;
        const h = 0.07;
        shape.moveTo(-w / 2, 0);
        shape.lineTo(w / 2, 0);
        shape.lineTo(w / 2, h * 0.4);
        shape.quadraticCurveTo(0, h, -w / 2, h * 0.4);
        shape.closePath();
        return shape;
    }, []);

    // Tailpiece Shape (tapered)
    const tailpieceShape = useMemo(() => {
        const shape = new THREE.Shape();
        const wTop = 0.07;
        const wBot = 0.03;
        const h = 0.28;
        shape.moveTo(-wTop / 2, h);
        shape.lineTo(wTop / 2, h);
        shape.lineTo(wBot / 2, 0);
        shape.lineTo(-wBot / 2, 0);
        shape.closePath();
        return shape;
    }, []);

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

            {/* === NECK === */}
            <mesh position={[0, VIOLA_HEIGHT * 0.25, 0]}>
                <cylinderGeometry args={[0.018, 0.022, 0.45, 12]} />
                <meshStandardMaterial color={VIOLA_BODY_COLOR} roughness={0.35} />
            </mesh>

            {/* Fingerboard */}
            <mesh position={[0, VIOLA_HEIGHT * 0.25, 0.022]} scale={[1.1, 1, 0.3]}>
                <cylinderGeometry args={[0.016, 0.02, 0.48, 8]} />
                <meshStandardMaterial color={VIOLA_FINGERBOARD_COLOR} roughness={0.2} />
            </mesh>

            {/* === MAIN BODY (Extruded Shape) === */}
            <mesh position={[0, 0, -VIOLA_DEPTH / 2]}>
                <extrudeGeometry args={[violaShape, extrudeSettings]} />
                <meshStandardMaterial color={VIOLA_BODY_COLOR} roughness={0.35} />
            </mesh>

            {/* === F-HOLES === */}
            {[-0.09, 0.09].map((x, i) => (
                <mesh key={`f-hole-${i}`} position={[x, -0.05, VIOLA_DEPTH / 2 + 0.01]} rotation={[0, 0, i === 0 ? 0.3 : -0.3]} scale={[0.4, 1.2, 0.5]}>
                    <capsuleGeometry args={[0.015, 0.12, 4, 8]} />
                    <meshStandardMaterial color="#0a0a0a" />
                </mesh>
            ))}

            {/* === BRIDGE === */}
            <mesh position={[0, -0.06, VIOLA_DEPTH / 2 + 0.01]} rotation={[0, 0, 0]}>
                <extrudeGeometry args={[bridgeShape, { depth: 0.01, bevelEnabled: false }]} />
                <meshStandardMaterial color="#D2B48C" roughness={0.4} />
            </mesh>

            {/* === STRINGS === */}
            {[-0.025, -0.008, 0.008, 0.025].map((x, i) => (
                <mesh key={`string-${i}`} position={[x, VIOLA_HEIGHT * 0.1, VIOLA_DEPTH / 2 + 0.05]}>
                    <cylinderGeometry args={[0.002, 0.002, 1.0, 6]} />
                    <meshStandardMaterial color={VIOLA_STRING_COLOR} roughness={0.1} metalness={0.8} />
                </mesh>
            ))}

            {/* === TAILPIECE === */}
            <mesh position={[0, -VIOLA_HEIGHT / 2 + 0.1, VIOLA_DEPTH / 2 + 0.01]}>
                <extrudeGeometry args={[tailpieceShape, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01 }]} />
                <meshStandardMaterial color={VIOLA_FINGERBOARD_COLOR} roughness={0.3} />
            </mesh>

            {/* === CHINREST === */}
            <mesh position={[0.12, -VIOLA_HEIGHT / 2 + 0.38, VIOLA_DEPTH / 2 + 0.03]} scale={[1.3, 1.6, 0.35]}>
                <sphereGeometry args={[0.04, 12, 10]} />
                <meshStandardMaterial color={VIOLA_FINGERBOARD_COLOR} roughness={0.3} />
            </mesh>
        </>
    );
}

export default Player;
