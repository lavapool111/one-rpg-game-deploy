'use client';

import React, { useRef, useState, useMemo, createContext, useContext } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Merged, Text } from '@react-three/drei';
import { useGameStore } from '@/lib/store';
import { useInventoryStore } from '@/lib/store/inventoryStore';


/**
 * InstrumentCase Component
 * 
 * Replaces GoldPile. Can be Level 1, 2, or 3.
 * Types: Trumpet, Trombone, Horn, Euphonium, Tuba
 */

export type InstrumentCaseType = 'Trumpet' | 'Trombone' | 'Horn' | 'Euphonium' | 'Tuba';
export type InstrumentCaseLevel = 1 | 2 | 3;

interface InstrumentCaseProps {
    /** World position */
    position: [number, number, number];
    /** Case Type */
    type: InstrumentCaseType;
    /** Case Level (Default 1) */
    level?: InstrumentCaseLevel;
    /** Unique ID */
    id: string;
    /** Callback when collected/opened */
    onCollect?: (id: string) => void;
}

// Colors for cases based on type (just visual distinction)
const CASE_COLORS: Record<InstrumentCaseType, string> = {
    Trumpet: '#FFD700', // Gold
    Trombone: '#C0C0C0', // Silver
    Horn: '#CD7F32', // Bronze
    Euphonium: '#B8860B', // Dark Gold
    Tuba: '#8B4513', // Bronze/Brown
};

// Global Geometries & Handle Material
const caseBodyGeo = new THREE.BoxGeometry(0.8, 0.5, 0.3);
const caseHandleGeo = new THREE.TorusGeometry(0.1, 0.02, 8, 16, Math.PI);
const handleMat = new THREE.MeshStandardMaterial({ color: "#333333" });

export const InstrumentCaseContext = createContext<any>(null);

export function InstrumentCaseInstances({ children }: { children: (instances: any) => React.ReactNode }) {
    const meshes = useMemo(() => {
        return {
            body: new THREE.Mesh(
                caseBodyGeo,
                new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, metalness: 0.6 })
            ),
            handle: new THREE.Mesh(caseHandleGeo, handleMat),
        };
    }, []);

    return (
        <Merged castShadow receiveShadow meshes={meshes}>
            {(instances) => (
                <InstrumentCaseContext.Provider value={instances}>
                    {children(instances)}
                </InstrumentCaseContext.Provider>
            )}
        </Merged>
    );
}

export function InstrumentCase({ position, type, level = 1, id, onCollect }: InstrumentCaseProps) {
    const models = useContext(InstrumentCaseContext) as any;
    const groupRef = useRef<THREE.Group>(null);
    const [opened, setOpened] = useState(false);
    const [showPrompt, setShowPrompt] = useState(false);
    const { camera } = useThree();

    const collectGold = useGameStore((state) => state.collectGold);
    const gameState = useGameStore((state) => state.gameState);

    // Player store actions to add items
    const addMaterial = useInventoryStore((state) => state.addMaterial);

    const caseWorldPos = useRef(new THREE.Vector3());
    const caseFrameCount = useRef(0);

    // Spin animation and proximity detection
    useFrame((state, delta) => {
        if (!groupRef.current || opened) return;

        // Gentle spin
        groupRef.current.rotation.y += delta * 0.5;

        // Bobbing motion
        groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 2) * 0.1;

        // Proximity check for glow (throttled to every 10 frames)
        caseFrameCount.current++;
        if (caseFrameCount.current % 10 !== 0) return;
        if (gameState === 'playing' && groupRef.current) {
            groupRef.current.getWorldPosition(caseWorldPos.current);
            const distance = camera.position.distanceTo(caseWorldPos.current);
            setShowPrompt(distance < 5); // Closer range than gold pile
        }
    });

    const handleOpen = (e: { stopPropagation?: () => void }) => {
        if (opened || !showPrompt) return;
        if (e.stopPropagation) e.stopPropagation();

        setOpened(true);
        grantRewards();
        onCollect?.(id);
    };

    const grantRewards = () => {
        // ... Logic from USER_REQUEST (keep exactly as it was by not touching the grantRewards function)
        let gold = 0;
        let _valveChance = 0; // standard valve chance or guaranteed count

        // Helper for chance
        const roll = (percent: number) => Math.random() < (percent / 100);
        // Helper for range
        const range = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

        console.log(`Opening Level ${level} ${type} Case`);

        if (level === 1) {
            // Level 1 logic
            switch (type) {
                case 'Trumpet':
                    gold = 10;
                    addMaterial('valves', range(1, 2));
                    break;
                case 'Trombone':
                    gold = 20;
                    if (roll(50)) addMaterial('trombone_slides', 1);
                    break;
                case 'Horn':
                    gold = 30;
                    addMaterial('spit_valve_liquid', range(40, 60));
                    break;
                case 'Euphonium':
                    gold = 40;
                    addMaterial('valves', 1);
                    break;
                case 'Tuba':
                    gold = 50;
                    addMaterial('spit_valve_liquid', 100);
                    addMaterial('valves', 4);
                    break;
            }
            if (roll(30)) addMaterial('valve_oil', 1);

        } else if (level === 2) {
            // Level 2 logic
            switch (type) {
                case 'Trumpet':
                    gold = 50;
                    addMaterial('valves', range(3, 5));
                    addMaterial('brass_ingots', 1);
                    break;
                case 'Trombone':
                    gold = 100;
                    addMaterial('trombone_slides', range(2, 4));
                    break;
                case 'Horn':
                    gold = 75;
                    addMaterial('spit_valve_liquid', range(115, 135));
                    break;
                case 'Euphonium':
                    gold = 150;
                    addMaterial('valves', 2);
                    addMaterial('brass_ingots', 1);
                    break;
                case 'Tuba':
                    gold = 200;
                    addMaterial('spit_valve_liquid', 200);
                    addMaterial('valves', 8);
                    if (roll(50)) addMaterial('reinforced_brass_ingots', 1);
                    break;
            }
            if (roll(60)) addMaterial('valve_oil', 1);

        } else if (level >= 3) {
            // Level 3 logic
            switch (type) {
                case 'Trumpet':
                    gold = 250;
                    addMaterial('valves', range(4, 10));
                    addMaterial('brass_ingots', range(1, 3));
                    break;
                case 'Trombone':
                    gold = 450;
                    addMaterial('trombone_slides', range(5, 7));
                    break;
                case 'Horn':
                    gold = 125;
                    addMaterial('spit_valve_liquid', range(260, 290));
                    break;
                case 'Euphonium':
                    gold = 500;
                    addMaterial('valves', range(3, 6));
                    addMaterial('brass_ingots', range(2, 4));
                    break;
                case 'Tuba':
                    gold = 600;
                    addMaterial('spit_valve_liquid', 500);
                    addMaterial('valves', 16);
                    addMaterial('reinforced_brass_ingots', range(1, 2));
                    break;
            }
            if (roll(90)) addMaterial('valve_oil', range(2, 3));
        }

        // Grant Gold
        if (gold > 0) {
            collectGold(gold);
            console.log(`InstrumentCase: Collected ${gold} gold`);
        }
    };

    if (opened) return null;

    // Visuals
    // A suitcase-like box
    const color = CASE_COLORS[type];
    const hoverColor = '#FFFFFF';

    // Scale slightly by level
    const scale = 1 + (level - 1) * 0.2;

    return (
        <group ref={groupRef} position={position} onClick={handleOpen} onPointerDown={handleOpen}>
            {/* Case Body */}
            {models && !showPrompt ? (
                <models.body
                    scale={[scale, scale, scale]}
                    color={color}
                />
            ) : (
                <mesh scale={[scale, scale, scale]} geometry={caseBodyGeo}>
                    <meshStandardMaterial
                        color={color}
                        roughness={0.4}
                        metalness={0.6}
                        emissive={showPrompt ? hoverColor : '#000000'}
                        emissiveIntensity={showPrompt ? 0.2 : 0}
                    />
                </mesh>
            )}

            {/* Handle */}
            {models ? (
                <models.handle position={[0, 0.25 * scale, 0]} scale={[scale, scale, scale]} />
            ) : (
                <mesh position={[0, 0.25 * scale, 0]} scale={[scale, scale, scale]} geometry={caseHandleGeo} material={handleMat} />
            )}

            {/* Label Text for Debug/Clarity */}
            {showPrompt && (
                <Text
                    position={[0, 0.6 * scale, 0]}
                    fontSize={0.2}
                    color="white"
                    anchorX="center"
                    anchorY="middle"
                >
                    {`L${level} ${type} Case`}
                </Text>
            )}

            {/* Point light for glow effect */}
            {showPrompt && (
                <pointLight
                    position={[0, 0.5, 0]}
                    intensity={1}
                    color={color}
                    distance={3}
                    decay={2}
                />
            )}
        </group>
    );
}
