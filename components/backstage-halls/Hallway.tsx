import React, { memo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { WALL_COLOR, WALL_HEIGHT } from './BackstageHalls';
import { StoneTileFloor } from './StoneTileFloor';
import { CulledPointLight, WallTorch, Pillar } from './DungeonDecorations';
import { SpawnZoneProps, registerSpawnZone, unregisterSpawnZone } from '@/lib/game/spawnZoneRegistry';

export interface HallwayProps {
    length: number;
    width?: number;
    height?: number;
    position?: [number, number, number];
    rotation?: [number, number, number] | [number, number, number, string]; // Euler args
    hasFloor?: boolean;
    hasCeiling?: boolean;
    hasLeftWall?: boolean;
    hasRightWall?: boolean;
    hasFrontWall?: boolean; // -Z side (local start)
    hasBackWall?: boolean; // +Z side (local end)
    color?: string;

    // Auto-decoration options
    ceilingLights?: boolean;
    wallTorches?: boolean;
    pillars?: boolean;

    /** Spawn zone config — registers this hallway as an enemy spawn area */
    spawnZone?: SpawnZoneProps;

    children?: React.ReactNode;
}

export const Hallway = memo(function Hallway({
    length,
    width = 12,
    height = WALL_HEIGHT,
    position = [0, 0.05, 0],
    rotation,
    hasFloor = true,
    hasCeiling = true,
    hasLeftWall = true,
    hasRightWall = true,
    hasFrontWall = false,
    hasBackWall = false,
    ceilingLights = false,
    wallTorches = false,
    pillars = false,
    color = WALL_COLOR,
    spawnZone,
    children
}: HallwayProps) {
    const groupRef = useRef<THREE.Group>(null);

    // Register spawn zone on mount
    useEffect(() => {
        if (!spawnZone || !groupRef.current) return;

        // Delay to let transforms settle
        const timer = setTimeout(() => {
            if (!groupRef.current) return;
            groupRef.current.updateMatrixWorld(true);
            const worldPos = new THREE.Vector3();
            groupRef.current.getWorldPosition(worldPos);

            // Hallway extends ±length/2 along Z, ±width/2 along X (in local space)
            // Apply rotation if present
            const worldQuat = new THREE.Quaternion();
            groupRef.current.getWorldQuaternion(worldQuat);
            const euler = new THREE.Euler().setFromQuaternion(worldQuat);
            const yaw = euler.y;

            const halfL = length / 2;
            const halfW = width / 2;
            const cosY = Math.abs(Math.cos(yaw));
            const sinY = Math.abs(Math.sin(yaw));

            // Rotated AABB
            const extentX = halfW * cosY + halfL * sinY;
            const extentZ = halfW * sinY + halfL * cosY;

            registerSpawnZone({
                ...spawnZone,
                shape: 'aabb',
                minX: worldPos.x - extentX,
                maxX: worldPos.x + extentX,
                minZ: worldPos.z - extentZ,
                maxZ: worldPos.z + extentZ,
                floorY: worldPos.y,
            });
        }, 500);

        return () => {
            clearTimeout(timer);
            unregisterSpawnZone(spawnZone.id);
        };
    }, [spawnZone, length, width]);
    // Generate decoration positions if enabled
    const decorPositions: number[] = [];
    const spacing = 30; // 30ft between decorations

    if (ceilingLights || wallTorches || pillars) {
        // Start from -length/2 + 15, go up to length/2 - 15
        const startZ = -length / 2 + 15;
        const endZ = length / 2 - 15;

        for (let z = startZ; z <= endZ; z += spacing) {
            decorPositions.push(z);
        }

        // If length is small (e.g. < 30) and we got no positions, just put one in the middle
        if (decorPositions.length === 0) {
            decorPositions.push(0);
        }
    }

    return (
        <group ref={groupRef} position={position} rotation={rotation as any}>
            {/* Floor */}
            {hasFloor && (
                <group position={[0, 0.05, 0]}>
                    <StoneTileFloor width={width} depth={length} />
                </group>
            )}

            {/* Left Wall (-X side) */}
            {hasLeftWall && (
                <mesh position={[-width / 2 - 0.5, height / 2, 0]}>
                    <boxGeometry args={[1, height, length]} />
                    <meshStandardMaterial color={color} roughness={0.9} />
                </mesh>
            )}

            {/* Right Wall (+X side) */}
            {hasRightWall && (
                <mesh position={[width / 2 + 0.5, height / 2, 0]}>
                    <boxGeometry args={[1, height, length]} />
                    <meshStandardMaterial color={color} roughness={0.9} />
                </mesh>
            )}

            {/* Front Wall (-Z side, closest to local origin) */}
            {hasFrontWall && (
                <mesh position={[0, height / 2, -length / 2 - 0.5]}>
                    <boxGeometry args={[width + 2, height, 1]} />
                    <meshStandardMaterial color={color} roughness={0.9} />
                </mesh>
            )}

            {/* Back Wall (+Z side, furthest from local origin) */}
            {hasBackWall && (
                <mesh position={[0, height / 2, length / 2 + 0.5]}>
                    <boxGeometry args={[width + 2, height, 1]} />
                    <meshStandardMaterial color={color} roughness={0.9} />
                </mesh>
            )}

            {/* Ceiling */}
            {hasCeiling && (
                <mesh position={[0, height, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[width, length]} />
                    <meshStandardMaterial color={color} roughness={0.9} side={THREE.DoubleSide} />
                </mesh>
            )}

            {/* Auto-decorations */}
            {decorPositions.map((z, i) => (
                <group key={`decor-${i}`} position={[0, 0, z]}>
                    {ceilingLights && (
                        <CulledPointLight position={[0, height - 3, 0]} intensity={35} color="#ff8844" distance={50} decay={2} />
                    )}

                    {wallTorches && hasLeftWall && (
                        <WallTorch position={[-width / 2 + 0.3, height * 0.5, 0]} rotation={Math.PI / 2} lightIntensity={10} />
                    )}

                    {wallTorches && hasRightWall && (
                        <WallTorch position={[width / 2 - 0.3, height * 0.5, 0]} rotation={-Math.PI / 2} lightIntensity={10} />
                    )}

                    {pillars && hasLeftWall && (
                        <Pillar position={[-width / 2 + 1.5, 0, 0]} height={height} radius={0.8} />
                    )}

                    {pillars && hasRightWall && (
                        <Pillar position={[width / 2 - 1.5, 0, 0]} height={height} radius={0.8} />
                    )}
                </group>
            ))}

            {children}
        </group>
    );
});
