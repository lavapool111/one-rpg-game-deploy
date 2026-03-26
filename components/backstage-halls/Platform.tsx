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
    /** Show railing on the North (-Z) edge */
    ifRailingNorth?: boolean;
    /** Show railing on the South (+Z) edge */
    ifRailingSouth?: boolean;
    /** Show railing on the East (+X) edge */
    ifRailingEast?: boolean;
    /** Show railing on the West (-X) edge */
    ifRailingWest?: boolean;
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
    ifRailingNorth = false,
    ifRailingSouth = false,
    ifRailingEast = false,
    ifRailingWest = false,
}: PlatformProps) {
    const meshRef = useRef<THREE.Mesh>(null);

    // Register collision surface
    useEffect(() => {
        if (!meshRef.current) return;

        let registeredId = '';
        let lastWorldPos = new THREE.Vector3(-999999, -999999, -999999); // Force initial update

        const registerPlatform = () => {
            if (!meshRef.current) return;

            // Force update world matrix
            meshRef.current.updateMatrixWorld(true);

            const worldPos = new THREE.Vector3();
            meshRef.current.getWorldPosition(worldPos);

            // Only update if position actually changed
            if (worldPos.distanceTo(lastWorldPos) < 0.01) return;
            lastWorldPos.copy(worldPos);

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
            registeredId = id;
            // console.log(`Registered platform "${id}" at world pos`, worldPos, `floorY: ${surface.floorY}`);
        };

        // Register immediately, then every 500ms
        registerPlatform();
        const interval = setInterval(registerPlatform, 500);

        return () => {
            clearInterval(interval);
            if (registeredId) {
                unregisterSurfaces(registeredId);
            }
        };
    }, [id, width, depth, height, position]);

    return (
        <group position={position} visible={visible}>
            <mesh ref={meshRef} position={[0, 0, 0]}>
                <boxGeometry args={[width, height, depth]} />
                <meshStandardMaterial color={color} roughness={roughness} />
            </mesh>

            {/* North railing (-Z edge) */}
            {ifRailingNorth && (
                <mesh position={[0, height / 2 + 1, -depth / 2 + 0.15]}>
                    <boxGeometry args={[width, 3, 0.3]} />
                    <meshStandardMaterial color="#888888" roughness={0.8} />
                </mesh>
            )}

            {/* South railing (+Z edge) */}
            {ifRailingSouth && (
                <mesh position={[0, height / 2 + 1, depth / 2 - 0.15]}>
                    <boxGeometry args={[width, 3, 0.3]} />
                    <meshStandardMaterial color="#888888" roughness={0.8} />
                </mesh>
            )}

            {/* East railing (+X edge) */}
            {ifRailingEast && (
                <mesh position={[width / 2 - 0.15, height / 2 + 1, 0]}>
                    <boxGeometry args={[0.3, 3, depth]} />
                    <meshStandardMaterial color="#888888" roughness={0.8} />
                </mesh>
            )}

            {/* West railing (-X edge) */}
            {ifRailingWest && (
                <mesh position={[-width / 2 + 0.15, height / 2 + 1, 0]}>
                    <boxGeometry args={[0.3, 3, depth]} />
                    <meshStandardMaterial color="#888888" roughness={0.8} />
                </mesh>
            )}
        </group>
    );
}

export default Platform;
