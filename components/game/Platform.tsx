'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { registerSurfaces, unregisterSurfaces, WalkableSurface } from '@/lib/game/stairCollision';

/**
 * Platform Component
 * 
 * A flat walkable platform with automatic collision registration.
 * Use for elevated floors, ledges, and landing areas.
 */

export interface PlatformProps {
    /** Unique ID for collision registration */
    id: string;
    /** Local position [x, y, z] relative to parent group */
    position: [number, number, number];
    /** Width (X axis) */
    width: number;
    /** Depth (Z axis) */
    depth: number;
    /** Height/thickness of the platform */
    height?: number;
    /** Material color */
    color?: string;
    /** Material roughness */
    roughness?: number;
    /** Show visual mesh (set false if you just want collision) */
    visible?: boolean;
}

export function Platform({
    id,
    position,
    width,
    depth,
    height = 1,
    color = '#666666',
    roughness = 0.8,
    visible = true,
}: PlatformProps) {
    const meshRef = useRef<THREE.Mesh>(null);

    // Register collision surface
    useEffect(() => {
        if (!meshRef.current) return;

        // Force update world matrix
        meshRef.current.updateMatrixWorld(true);

        const worldPos = new THREE.Vector3();
        meshRef.current.getWorldPosition(worldPos);

        const quaternion = new THREE.Quaternion();
        meshRef.current.getWorldQuaternion(quaternion);
        const euler = new THREE.Euler().setFromQuaternion(quaternion);
        const angle = euler.y;

        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        // AABB calculation for rotated platform
        const extentX = (width / 2) * Math.abs(cos) + (depth / 2) * Math.abs(sin);
        const extentZ = (width / 2) * Math.abs(sin) + (depth / 2) * Math.abs(cos);

        const surface: WalkableSurface = {
            id: `${id}-platform`,
            minX: worldPos.x - extentX,
            maxX: worldPos.x + extentX,
            minZ: worldPos.z - extentZ,
            maxZ: worldPos.z + extentZ,
            floorY: worldPos.y + height / 2, // Top of platform (mesh center + half height)
        };

        registerSurfaces(id, [surface]);
        console.log(`Registered platform "${id}" at world pos`, worldPos, `floorY: ${surface.floorY}`);

        return () => {
            unregisterSurfaces(id);
        };
    }, [id, width, depth, height, position]);

    if (!visible) return null;

    return (
        <mesh ref={meshRef} position={position}>
            <boxGeometry args={[width, height, depth]} />
            <meshStandardMaterial color={color} roughness={roughness} />
        </mesh>
    );
}

export default Platform;
