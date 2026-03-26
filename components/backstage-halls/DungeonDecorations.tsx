'use client';

import React, { useRef, useMemo, createContext, useContext } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Merged } from '@react-three/drei';

/**
 * Dungeon Decorations
 * 
 * Reusable visual decoration components for dungeon aesthetics.
 * These are purely visual - no collision registration.
 * Performance optimized with distance-based culling.
 */

// ============== COLORS ==============
const STONE_COLOR = '#5a5a5a';
const STONE_DARK = '#404040';
const WOOD_COLOR = '#5c4033';
const METAL_COLOR = '#3a3a3a';
const TORCH_FLAME_COLOR = '#ff6600';

// ============== CULLING DISTANCE ==============
const _DECORATION_CULL_DISTANCE = 80; // Don't render decorations beyond this distance
const LIGHT_CULL_DISTANCE = 100; // Only render lights within this distance

// ============== CULLED POINT LIGHT ==============
/**
 * CulledPointLight - A point light that only renders when:
 * 1. The player is within `cullDistance` feet
 * 2. The light is roughly in front of the camera (within FOV)
 * 
 * This dramatically improves performance by disabling off-screen and distant lights.
 */
export interface CulledPointLightProps {
    position: [number, number, number];
    intensity: number;
    color?: string;
    distance?: number;
    decay?: number;
    cullDistance?: number;
}

export function CulledPointLight({
    position,
    intensity,
    color = '#ff9955',
    distance = 60,
    decay = 2,
    cullDistance = LIGHT_CULL_DISTANCE,
}: CulledPointLightProps) {
    const lightRef = useRef<THREE.PointLight>(null);
    const isVisibleRef = useRef(false);
    const frameCount = useRef(-1);
    const shadowFrameCount = useRef(0); // Counter for throttling shadow updates
    const { camera } = useThree();

    // Reuse vectors to avoid GC
    const worldPos = useRef(new THREE.Vector3());
    const cameraDir = useRef(new THREE.Vector3());
    const toLight = useRef(new THREE.Vector3());

    useFrame(() => {
        // Throttle shadow updates to every 3rd frame, and only if casting shadows
        shadowFrameCount.current++;
        if (shadowFrameCount.current % 3 === 0) {
            if (lightRef.current && lightRef.current.castShadow) lightRef.current.shadow.needsUpdate = true;
        }

        // Throttle visibility check to every 10 frames (increase throttle to reduce overhead)
        frameCount.current++;
        if (frameCount.current % 10 !== 0) return;

        // CRITICAL FIX: Get true world position
        // If the light is inside a parent group (like a Corridor or Room), 
        // lightRef.current.position is relative to that parent.
        // We need the absolute world coordinates for distance culling.
        if (lightRef.current) {
            lightRef.current.getWorldPosition(worldPos.current);
        } else {
            // Fallback if ref not ready (should rarely happen)
            worldPos.current.set(...position);
        }

        const dx = camera.position.x - worldPos.current.x;
        const dy = camera.position.y - worldPos.current.y;
        const dz = camera.position.z - worldPos.current.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        const cullDistSq = cullDistance * cullDistance;

        // Distance check (use squared distance to avoid sqrt)
        if (distSq > cullDistSq) {
            if (lightRef.current) lightRef.current.visible = false;
            isVisibleRef.current = false;
            return;
        }

        // Frustum check - is the light roughly in front of the camera?
        camera.getWorldDirection(cameraDir.current);
        toLight.current.subVectors(worldPos.current, camera.position).normalize();
        const dot = cameraDir.current.dot(toLight.current);

        // dot > -0.3 means light is in front or to the side (within ~110° FOV)
        const shouldShow = dot > -0.3;

        if (lightRef.current) {
            lightRef.current.visible = shouldShow;
        }
        isVisibleRef.current = shouldShow;
    });

    // Always render the light but control visibility via ref (avoids React re-renders)
    // DEBUG: Disable all dynamic lights

    return (
        <pointLight
            ref={lightRef}
            position={position}
            intensity={intensity}
            color={color}
            distance={distance}
            decay={decay}
            visible={false}
        // Removing castShadow. This scene has ~30 point lights. If a large
        // mesh like the floor or stairs is in range of too many, the compiled
        // material tries to bind a shadow map for each one, exceeding the
        // max WebGL texture limit (usually 16). 
        />
    );
}

// ============== CULLED GROUP (GEOMETRY CULLING) ==============
export const GEOMETRY_CULL_DISTANCE = 150; // Don't render geometry beyond this distance

export interface CulledGroupProps {
    /** Position of this group (used for distance calculation) */
    position?: [number, number, number];
    /** Rotation of this group */
    rotation?: [number, number, number];
    /** Max distance before culling (default: GEOMETRY_CULL_DISTANCE) */
    cullDistance?: number;
    /** Children to render when visible */
    children: React.ReactNode;
}

/**
 * CulledGroup - A group that hides its children when the camera is far away. culled
 * Uses distance check every 15 frames for minimal overhead.
 * More aggressive than light culling since geometry is cheaper to re-show.
 */
export function CulledGroup({
    position,
    rotation,
    cullDistance = GEOMETRY_CULL_DISTANCE,
    children,
}: CulledGroupProps) {
    const groupRef = useRef<THREE.Group>(null);
    const frameCount = useRef(-1);
    const { camera } = useThree();
    const worldPos = useRef(new THREE.Vector3());

    useFrame(() => {
        // Throttle visibility check to every 15 frames
        frameCount.current++;
        if (frameCount.current % 15 !== 0) return;
        if (!groupRef.current) return;

        // Get world position of group center
        groupRef.current.getWorldPosition(worldPos.current);

        const dx = camera.position.x - worldPos.current.x;
        const dy = camera.position.y - worldPos.current.y;
        const dz = camera.position.z - worldPos.current.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        const cullDistSq = cullDistance * cullDistance;

        groupRef.current.visible = distSq <= cullDistSq;
    });

    return (
        <group ref={groupRef} position={position} rotation={rotation}>
            {children}
        </group>
    );
}

// ============== PILLAR ==============
export interface PillarProps {
    position: [number, number, number];
    height?: number;
    radius?: number;
    color?: string;
    basecolor?: string;
    hasBase?: boolean;
    hasCapital?: boolean;
}

/**
 * Stone Pillar - cylindrical column with optional base and capital
 */
export const PillarContext = createContext<any>(null);

export function PillarInstances({ children }: { children: (instances: any) => React.ReactNode }) {
    const meshes = useMemo(() => {
        return {
            base: new THREE.Mesh(new THREE.BoxGeometry(2.5, 1, 2.5), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 })),
            column: new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 1, 8), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 })),
            capital: new THREE.Mesh(new THREE.BoxGeometry(2.5, 1, 2.5), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 })),
        };
    }, []);

    return (
        <Merged castShadow receiveShadow meshes={meshes}>
            {(instances) => (
                <PillarContext.Provider value={instances}>
                    {children(instances)}
                </PillarContext.Provider>
            )}
        </Merged>
    );
}

export function Pillar({
    position,
    height = 20,
    radius = 1.5,
    color = STONE_COLOR,
    basecolor = STONE_DARK,
    hasBase = true,
    hasCapital = true,
}: PillarProps) {
    const models = useContext(PillarContext) as any;

    if (models) {
        return (
            <group position={position}>
                {/* Base */}
                {hasBase && (
                    <models.base position={[0, 0.5, 0]} scale={[radius, 1, radius]} color={basecolor} />
                )}

                {/* Main column */}
                <models.column position={[0, height / 2, 0]} scale={[radius, height, radius]} color={color} />

                {/* Capital (top) */}
                {hasCapital && (
                    <models.capital position={[0, height - 0.5, 0]} scale={[radius, 1, radius]} color={STONE_DARK} />
                )}
            </group>
        );
    }
    return (
        <group position={position}>
            {/* Base */}
            {hasBase && (
                <mesh position={[0, 0.5, 0]}>
                    <boxGeometry args={[radius * 2.5, 1, radius * 2.5]} />
                    <meshStandardMaterial color={basecolor} roughness={0.9} />
                </mesh>
            )}

            {/* Main column */}
            <mesh position={[0, height / 2, 0]}>
                <cylinderGeometry args={[radius, radius * 1.1, height, 8]} />
                <meshStandardMaterial color={color} roughness={0.85} />
            </mesh>

            {/* Capital (top) */}
            {hasCapital && (
                <mesh position={[0, height - 0.5, 0]}>
                    <boxGeometry args={[radius * 2.5, 1, radius * 2.5]} />
                    <meshStandardMaterial color={STONE_DARK} roughness={0.9} />
                </mesh>
            )}
        </group>
    );
}

// ============== ARCH ==============
export interface ArchProps {
    position: [number, number, number];
    rotation?: number;
    width?: number;
    height?: number;
    depth?: number;
    color?: string;
}

/**
 * Stone Arch - decorative archway with pillars and curved top
 */
export function Arch({
    position,
    rotation = 0,
    width = 10,
    height = 15,
    depth = 2,
    color = STONE_COLOR,
}: ArchProps) {
    const pillarWidth = width * 0.15;
    const archRadius = (width - pillarWidth * 2) / 2; // Inner radius of arch
    const legHeight = height - archRadius; // Height of legs (below arch curve)

    return (
        <group position={position} rotation={[0, rotation, 0]}>
            {/* Left pillar */}
            <mesh position={[-width / 2 + pillarWidth / 2, legHeight / 2, 0]}>
                <boxGeometry args={[pillarWidth, legHeight, depth]} />
                <meshStandardMaterial color={color} roughness={0.85} />
            </mesh>

            {/* Right pillar */}
            <mesh position={[width / 2 - pillarWidth / 2, legHeight / 2, 0]}>
                <boxGeometry args={[pillarWidth, legHeight, depth]} />
                <meshStandardMaterial color={color} roughness={0.85} />
            </mesh>

            {/* Curved arch top constructed from segments (voussoirs) to be hollow */}
            {Array.from({ length: 8 }).map((_, i) => {
                const angleStep = Math.PI / 8;
                // Angle from 0 to PI (0 is right, PI is left)
                // We want to span from 0 to PI.
                // i=0 -> angle = PI/16 (center of first segment)
                const angle = (i + 0.5) * angleStep;

                // Radius to center of arch stones
                // Arch spans from -width/2 to width/2
                // Pillar centers are at +/- (width/2 - pillarWidth/2)
                // Radius = (width/2 - pillarWidth/2)
                const radius = (width / 2) - (pillarWidth / 2);

                const x = radius * Math.cos(angle);
                const y = legHeight + radius * Math.sin(angle);

                // Length of outer arc segment roughly
                const segmentLength = (Math.PI * radius) / 8 + 0.2; // slight overlap

                return (
                    <group
                        key={i}
                        position={[x, y, 0]}
                        rotation={[0, 0, angle + Math.PI / 2]}
                    >
                        {/* Main Block */}
                        <mesh>
                            <boxGeometry args={[pillarWidth, segmentLength, depth]} />
                            <meshStandardMaterial color={STONE_DARK} roughness={0.9} />
                        </mesh>

                        {/* Carving Detail (Inset Cross Pattern) */}
                        <group position={[0, 0, depth / 2 + 0.05]}>
                            {/* Vertical Line */}
                            <mesh position={[0, 0, 0]}>
                                <boxGeometry args={[pillarWidth * 0.4, segmentLength * 0.7, 0.1]} />
                                <meshStandardMaterial color={STONE_COLOR} roughness={0.8} />
                            </mesh>
                            {/* Horizontal Line */}
                            <mesh position={[0, 0, 0]}>
                                <boxGeometry args={[pillarWidth * 0.7, segmentLength * 0.2, 0.1]} />
                                <meshStandardMaterial color={STONE_COLOR} roughness={0.8} />
                            </mesh>
                        </group>
                        {/* Carving Detail (Back side) */}
                        <group position={[0, 0, -depth / 2 - 0.05]}>
                            <mesh position={[0, 0, 0]}>
                                <boxGeometry args={[pillarWidth * 0.4, segmentLength * 0.7, 0.1]} />
                                <meshStandardMaterial color={STONE_COLOR} roughness={0.8} />
                            </mesh>
                            <mesh position={[0, 0, 0]}>
                                <boxGeometry args={[pillarWidth * 0.7, segmentLength * 0.2, 0.1]} />
                                <meshStandardMaterial color={STONE_COLOR} roughness={0.8} />
                            </mesh>
                        </group>
                    </group>
                );
            })}

            {/* Keystone at top of arch (decorative) */}
            <mesh position={[0, legHeight + (width / 2 - pillarWidth / 2) + pillarWidth / 4, depth / 2 + 0.1]}>
                <boxGeometry args={[pillarWidth * 1.2, pillarWidth * 1.5, 0.3]} />
                <meshStandardMaterial color={STONE_DARK} roughness={0.85} />
            </mesh>
        </group>
    );
}

// ============== WALL TORCH ==============
export interface WallTorchProps {
    position: [number, number, number];
    rotation?: number;
    /** Enable the point light (expensive - use sparingly!) */
    hasLight?: boolean;
    lightIntensity?: number;
    lightColor?: string;
    lightDistance?: number;
}

/**
 * Wall-mounted Torch with optional point light
 * Light is disabled by default for performance - only enable on key torches
 */
export function WallTorch({
    position,
    rotation = 0,
    hasLight = false,
    lightIntensity = 15,
    lightColor = TORCH_FLAME_COLOR,
    lightDistance = 25,
}: WallTorchProps) {
    return (
        <group position={position} rotation={[0, rotation, 0]}>
            {/* Bracket */}
            <mesh position={[0, 0, 0.3]}>
                <boxGeometry args={[0.3, 0.3, 0.6]} />
                <meshStandardMaterial color={METAL_COLOR} roughness={0.7} metalness={0.3} />
            </mesh>

            {/* Torch handle */}
            <mesh position={[0, 0.8, 0.5]}>
                <cylinderGeometry args={[0.1, 0.15, 1.2, 6]} />
                <meshStandardMaterial color={WOOD_COLOR} roughness={0.9} />
            </mesh>

            {/* Flame (emissive sphere - always visible) */}
            <mesh position={[0, 1.5, 0.5]}>
                <sphereGeometry args={[0.25, 6, 6]} />
                <meshStandardMaterial
                    color={lightColor}
                    emissive={lightColor}
                    emissiveIntensity={3}
                />
            </mesh>

            {/* Point light - only rendered when hasLight=true, uses CulledPointLight for culling */}
            {hasLight && (
                <CulledPointLight
                    position={[0, 1.5, 0.5]}
                    intensity={lightIntensity}
                    color={lightColor}
                    distance={lightDistance}
                    decay={2}
                />
            )}
        </group>
    );
}

// ============== CRATE ==============
export interface CrateProps {
    position: [number, number, number];
    rotation?: number;
    size?: number;
    color?: string;
}

/**
 * Wooden Crate - stackable storage box
 */
export function Crate({
    position,
    rotation = 0,
    size = 2,
    color = WOOD_COLOR,
}: CrateProps) {
    return (
        <group position={position} rotation={[0, rotation, 0]}>
            {/* Main box */}
            <mesh position={[0, size / 2, 0]}>
                <boxGeometry args={[size, size, size]} />
                <meshStandardMaterial color={color} roughness={0.95} />
            </mesh>

            {/* Metal bands */}
            <mesh position={[0, size * 0.25, 0]}>
                <boxGeometry args={[size + 0.1, size * 0.1, size + 0.1]} />
                <meshStandardMaterial color={METAL_COLOR} roughness={0.7} metalness={0.3} />
            </mesh>
            <mesh position={[0, size * 0.75, 0]}>
                <boxGeometry args={[size + 0.1, size * 0.1, size + 0.1]} />
                <meshStandardMaterial color={METAL_COLOR} roughness={0.7} metalness={0.3} />
            </mesh>
        </group>
    );
}

// ============== BARREL ==============
export interface BarrelProps {
    position: [number, number, number];
    rotation?: number;
    height?: number;
    radius?: number;
    color?: string;
}

/**
 * Wooden Barrel
 */
export function Barrel({
    position,
    rotation = 0,
    height = 3,
    radius = 1,
    color = WOOD_COLOR,
}: BarrelProps) {
    return (
        <group position={position} rotation={[0, rotation, 0]}>
            {/* Main barrel body */}
            <mesh position={[0, height / 2, 0]}>
                <cylinderGeometry args={[radius * 0.9, radius, height, 12]} />
                <meshStandardMaterial color={color} roughness={0.95} />
            </mesh>

            {/* Metal bands */}
            <mesh position={[0, height * 0.2, 0]}>
                <torusGeometry args={[radius * 0.95, 0.08, 8, 16]} />
                <meshStandardMaterial color={METAL_COLOR} roughness={0.7} metalness={0.3} />
            </mesh>
            <mesh position={[0, height * 0.8, 0]}>
                <torusGeometry args={[radius * 0.92, 0.08, 8, 16]} />
                <meshStandardMaterial color={METAL_COLOR} roughness={0.7} metalness={0.3} />
            </mesh>
        </group>
    );
}

// ============== CHAIN ==============
export interface ChainProps {
    position: [number, number, number];
    length?: number;
    linkCount?: number;
}

/**
 * Hanging Chain decoration
 */
export function Chain({
    position,
    length = 5,
    linkCount = 8,
}: ChainProps) {
    const linkHeight = length / linkCount;

    return (
        <group position={position}>
            {Array.from({ length: linkCount }).map((_, i) => (
                <mesh
                    key={i}
                    position={[0, -i * linkHeight - linkHeight / 2, 0]}
                    rotation={[0, (i % 2) * Math.PI / 2, 0]}
                >
                    <torusGeometry args={[0.15, 0.05, 6, 8]} />
                    <meshStandardMaterial color={METAL_COLOR} roughness={0.6} metalness={0.4} />
                </mesh>
            ))}
        </group>
    );
}

// ============== TORCH SCONCE ==============
export interface TorchSconceProps {
    position: [number, number, number];
}

/**
 * Torch Sconce with emissive glow
 */
export function TorchSconce({ position }: TorchSconceProps) {
    return (
        <group position={position}>
            {/* Bracket */}
            <mesh>
                <boxGeometry args={[0.4, 0.6, 0.3]} />
                <meshStandardMaterial color="#443322" roughness={0.8} />
            </mesh>

            {/* Flame */}
            <mesh position={[0, 0.5, 0.2]}>
                <sphereGeometry args={[0.25, 8, 8]} />
                <meshStandardMaterial
                    color="#ff6600"
                    emissive="#ff4400"
                    emissiveIntensity={4}
                />
            </mesh>
        </group>
    );
}
