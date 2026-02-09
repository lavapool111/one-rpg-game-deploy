'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { registerSurfaces, unregisterSurfaces, WalkableSurface } from '@/lib/game/stairCollision';

/**
 * Stairs Component
 * 
 * Reusable stairs with configurable dimensions and automatic collision registration.
 * Players can climb by jumping onto each step.
 * 
 * Orientation: Steps ascend in +Z direction (local), with depth along Z and width along X.
 * 
 * Collision: Automatically detects world position and rotation using the group ref.
 */

export interface StairsProps {
    /** Unique ID for collision registration */
    id: string;
    /** Local position of the stairs base [x, y, z] relative to parent group */
    position: [number, number, number];
    /** Rotation around Y axis in radians (default: 0) - LOCAL rotation */
    rotation?: number;
    /** Number of steps */
    stepCount: number;
    /** Width of each step (X axis, perpendicular to climb direction) */
    stepWidth: number;
    /** Depth of each step (Z axis, along climb direction) */
    stepDepth: number;
    /** Height of each step rise (Y axis) */
    stepHeight: number;
    /** If true, stairs descend (go down) in +Z direction instead of ascending */
    descending?: boolean;
    /** Array of step indices to skip (for broken stair effect) */
    skipSteps?: number[];
    /** Material color */
    color?: string;
    /** Material roughness (0-1) */
    roughness?: number;
    /** Material metalness (0-1) */
    metalness?: number;
    /** Emissive color (glow) */
    emissive?: string;
    /** Emissive intensity */
    emissiveIntensity?: number;
}

export function Stairs({
    id,
    position,
    rotation = 0,
    stepCount,
    stepWidth,
    stepDepth,
    stepHeight,
    descending = false,
    skipSteps = [],
    color = '#666666',
    roughness = 0.8,
    metalness = 0.1,
    emissive,
    emissiveIntensity = 0,
}: StairsProps) {
    const groupRef = useRef<THREE.Group>(null);

    // Create a Set for O(1) lookup of skipped steps
    const skipSet = useMemo(() => new Set(skipSteps), [skipSteps]);

    // Generate step data (skip specified steps)
    const steps = useMemo(() => {
        const stepData: Array<{
            originalIndex: number;
            localPos: [number, number, number];
            size: [number, number, number];
        }> = [];

        for (let i = 0; i < stepCount; i++) {
            // Skip this step if in skipSteps array
            if (skipSet.has(i)) continue;

            // Each step position based on original index (so gaps appear)
            // For descending stairs, Y goes down; for ascending, Y goes up
            const yOffset = descending ? -(i + 0.5) * stepHeight : (i + 0.5) * stepHeight;
            const z = i * stepDepth + stepDepth / 2; // Positioned along Z

            stepData.push({
                originalIndex: i,
                localPos: [0, yOffset, z],
                size: [stepWidth, stepHeight, stepDepth],
            });
        }

        return stepData;
    }, [stepCount, stepWidth, stepDepth, stepHeight, descending, skipSet]);

    // Register collision surfaces using actual world coordinates
    useEffect(() => {
        if (!groupRef.current) return;

        // Force update world matrix to ensure we get correct world coordinates
        groupRef.current.updateMatrixWorld(true);

        // Get total rotation (including parent transforms)
        const quaternion = new THREE.Quaternion();
        groupRef.current.getWorldQuaternion(quaternion);
        const euler = new THREE.Euler().setFromQuaternion(quaternion);
        const angle = euler.y; // Rotation around vertical axis

        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        const worldSurfaces: WalkableSurface[] = steps.map((step, i) => {
            // Calculate world position for this step
            const stepPos = new THREE.Vector3().fromArray(step.localPos);
            stepPos.applyMatrix4(groupRef.current!.matrixWorld);

            // Calculate rotated AABB extents
            // We use abs() because for AABB size, direction doesn't matter, only axis alignment match
            const extentX = (stepWidth / 2) * Math.abs(cos) + (stepDepth / 2) * Math.abs(sin);
            const extentZ = (stepWidth / 2) * Math.abs(sin) + (stepDepth / 2) * Math.abs(cos);

            return {
                id: `${id}-step-${i}`,
                minX: stepPos.x - extentX,
                maxX: stepPos.x + extentX,
                minZ: stepPos.z - extentZ,
                maxZ: stepPos.z + extentZ,
                // Top of step: for descending, floor is at step center + half height
                // (since yOffset already accounts for descending direction)
                floorY: stepPos.y + stepHeight / 2,
            };
        });

        registerSurfaces(id, worldSurfaces);
        if (worldSurfaces.length > 0) {
            console.log(`Registered ${worldSurfaces.length} stair surfaces for "${id}" at world pos`, worldSurfaces[0]);
        }

        return () => {
            unregisterSurfaces(id);
        };
    }, [id, steps, stepWidth, stepDepth, stepHeight, position, rotation]);

    return (
        <group ref={groupRef} position={position} rotation={[0, rotation, 0]}>
            {steps.map((step, i) => (
                <mesh
                    key={i}
                    position={step.localPos}
                    castShadow
                    receiveShadow
                >
                    <boxGeometry args={step.size} />
                    <meshStandardMaterial
                        color={color}
                        roughness={roughness}
                        metalness={metalness}
                        emissive={emissive}
                        emissiveIntensity={emissiveIntensity}
                    />
                </mesh>
            ))}
        </group>
    );
}

export function getStairsDimensions(stepCount: number, stepDepth: number, stepHeight: number) {
    return {
        totalHeight: stepCount * stepHeight,
        totalDepth: stepCount * stepDepth,
    };
}

export default Stairs;
