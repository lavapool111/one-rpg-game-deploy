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

        let registeredId = '';
        let lastWorldPos = new THREE.Vector3(-999999, -999999, -999999);

        const registerStairs = () => {
            if (!groupRef.current) return;

            // Force update world matrix to ensure we get correct world coordinates
            groupRef.current.updateMatrixWorld(true);

            const worldPos = new THREE.Vector3();
            groupRef.current.getWorldPosition(worldPos);

            // Only update if position actually changed
            if (worldPos.distanceTo(lastWorldPos) < 0.01) return;
            lastWorldPos.copy(worldPos);

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
            registeredId = id;
            if (worldSurfaces.length > 0) {
                // console.log(`Registered ${worldSurfaces.length} stair surfaces for "${id}" at world pos`, worldSurfaces[0]);
            }
        };

        registerStairs();
        const interval = setInterval(registerStairs, 500); // Check twice a second

        return () => {
            clearInterval(interval);
            if (registeredId) {
                unregisterSurfaces(registeredId);
            }
        };
    }, [id, steps, stepWidth, stepDepth, stepHeight, position, rotation]);

    const instancedMeshRef = useRef<THREE.InstancedMesh>(null);

    // Update instance matrices
    useEffect(() => {
        if (!instancedMeshRef.current || steps.length === 0) return;

        const dummy = new THREE.Object3D();
        steps.forEach((step, i) => {
            dummy.position.fromArray(step.localPos);
            // Default rotation is 0, since steps are aligned along Z
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            instancedMeshRef.current!.setMatrixAt(i, dummy.matrix);
        });
        instancedMeshRef.current.instanceMatrix.needsUpdate = true;

        // CRITICAL FOR SHADOWS/CULLING: compute bounding sphere of all instances
        instancedMeshRef.current.computeBoundingSphere();
    }, [steps]);

    return (
        <group ref={groupRef} position={position} rotation={[0, rotation, 0]}>
            <instancedMesh
                ref={instancedMeshRef}
                args={[undefined, undefined, steps.length]}
                count={steps.length}
                castShadow
                receiveShadow
            >
                <boxGeometry args={[stepWidth, stepHeight, stepDepth]} />
                <meshStandardMaterial
                    color={color}
                    roughness={roughness}
                    metalness={metalness}
                    emissive={emissive}
                    emissiveIntensity={emissiveIntensity}
                />
            </instancedMesh>
        </group>
    );
}

export function getStairsDimensions(stepCount: number, stepDepth: number, stepHeight: number) {
    return {
        totalHeight: stepCount * stepHeight,
        totalDepth: stepCount * stepDepth,
    };
}

// ============================================================================
// SPIRAL STAIRS
// ============================================================================

/**
 * SpiralStairs Component
 * 
 * A spiral staircase with wedge-shaped steps arranged around a central column.
 * Each step is a flat box positioned and rotated around the center axis.
 * 
 * The spiral ascends in +Y from the position origin.
 * 
 * Collision: Automatically registers walkable surfaces using world coordinates.
 */

export interface SpiralStairsProps {
    /** Unique ID for collision registration */
    id: string;
    /** Local position of the stairs base [x, y, z] relative to parent group */
    position: [number, number, number];
    /** Rotation around Y axis in radians (default: 0) - initial rotation offset */
    rotation?: number;
    /** Number of steps */
    stepCount: number;
    /** Outer radius of the spiral (distance from center to step edge) */
    outerRadius: number;
    /** Inner radius / column radius (default: 0.8) */
    innerRadius?: number;
    /** Height of each step rise */
    stepHeight: number;
    /** Total rotation in radians for the full staircase (default: 2π = one full turn) */
    totalRotation?: number;
    /** Direction: 1 = counter-clockwise, -1 = clockwise (default: 1) */
    direction?: 1 | -1;
    /** Whether to render a central column (default: true) */
    showColumn?: boolean;
    /** Step material color */
    color?: string;
    /** Column material color */
    columnColor?: string;
    /** Material roughness (0-1) */
    roughness?: number;
    /** Material metalness (0-1) */
    metalness?: number;
}

export function SpiralStairs({
    id,
    position,
    rotation = 0,
    stepCount,
    outerRadius,
    innerRadius = 0.8,
    stepHeight,
    totalRotation = Math.PI * 2,
    direction = 1,
    showColumn = true,
    color = '#666666',
    columnColor = '#555555',
    roughness = 0.8,
    metalness = 0.1,
}: SpiralStairsProps) {
    const groupRef = useRef<THREE.Group>(null);

    // Angle per step
    const anglePerStep = (totalRotation / stepCount) * direction;
    // Step angular width (matches anglePerStep for seamless steps)
    const stepAngle = Math.abs(anglePerStep);
    // Gap between column and step inner edge
    const columnGap = 0.3;
    // Step inner edge starts after the column gap
    const stepInnerEdge = innerRadius + columnGap;
    // Step depth (radial length from inner edge to outer)
    const _stepDepth = outerRadius - stepInnerEdge;
    // Step visual thickness
    const stepThickness = 1.0;
    // Total height
    const totalHeight = stepCount * stepHeight;

    // Generate step data
    const steps = useMemo(() => {
        const stepData: Array<{
            index: number;
            y: number;
            angle: number;
            centerX: number;
            centerZ: number;
        }> = [];

        for (let i = 0; i < stepCount; i++) {
            // Angle around the Y axis
            const angle = i * anglePerStep;
            const y = (i + 0.5) * stepHeight;

            // To ensure 100% perfect collision mapping, we use Three.js's actual matrix math 
            // instead of trying to manually sync sin/cos with our ExtrudeGeometry's rotation changes.
            // The ExtrudeGeometry is drawn centered on +Y (which becomes +Z after X rotation).
            const dummyPoint = new THREE.Object3D();

            // The visual mesh dummy does this: dummy.position.set(0, y, 0); dummy.rotation.set(0, angle, 0);
            dummyPoint.position.set(0, y, 0);
            dummyPoint.rotation.set(0, angle, 0);

            // We want to find the world position of the "center" of the wedge.
            // The math is simple: default 'forward' (0 degrees) for Three.js rotations points along +X.
            // When we rotate `dummyPoint` by `angle` around Y, the point [r, 0, 0] orbits precisely
            // as expected. We just need to find the correct radius.
            const midRadius = (stepInnerEdge + outerRadius) / 2;
            const localCenter = new THREE.Vector3(0, 0, -midRadius);

            dummyPoint.updateMatrix();
            localCenter.applyMatrix4(dummyPoint.matrix);

            stepData.push({
                index: i,
                y,
                angle,
                centerX: localCenter.x,
                centerZ: localCenter.z
            });
        }

        return stepData;
    }, [stepCount, anglePerStep, stepHeight, stepInnerEdge, outerRadius]);

    // Register collision surfaces
    useEffect(() => {
        if (!groupRef.current) return;

        let registeredId = '';
        let lastWorldPos = new THREE.Vector3(-999999, -999999, -999999);

        const registerStairs = () => {
            if (!groupRef.current) return;

            groupRef.current.updateMatrixWorld(true);
            const worldPos = new THREE.Vector3();
            groupRef.current.getWorldPosition(worldPos);

            if (worldPos.distanceTo(lastWorldPos) < 0.01) return;
            lastWorldPos.copy(worldPos);

            const worldSurfaces: WalkableSurface[] = steps.map((step) => {
                // Use the exact calculated center
                const stepPos = new THREE.Vector3(step.centerX, step.y, step.centerZ);
                stepPos.applyMatrix4(groupRef.current!.matrixWorld);

                // Tighter AABB. Extent is based on step width + some buffer
                const extentRadius = (outerRadius - stepInnerEdge) / 2;
                const arcLength = outerRadius * stepAngle;
                // Use largest dimension to ensure coverage, add small buffer
                const extent = Math.max(extentRadius, arcLength / 2) + 0.1;

                return {
                    id: `${id}-step-${step.index}`,
                    minX: stepPos.x - extent,
                    maxX: stepPos.x + extent,
                    minZ: stepPos.z - extent,
                    maxZ: stepPos.z + extent,
                    floorY: stepPos.y + stepThickness / 2,
                };
            });

            registerSurfaces(id, worldSurfaces);
            registeredId = id;
            if (worldSurfaces.length > 0) {
                // console.log(`Registered ${worldSurfaces.length} spiral stair surfaces for "${id}"`);
            }
        };

        registerStairs();
        const interval = setInterval(registerStairs, 500);

        return () => {
            clearInterval(interval);
            if (registeredId) {
                unregisterSurfaces(registeredId);
            }
        };
    }, [id, steps, outerRadius, stepInnerEdge, stepThickness, position, rotation, stepAngle]);

    // Create a reusable wedge geometry for steps using ExtrudeGeometry
    const stepGeometry = useMemo(() => {
        const shape = new THREE.Shape();

        // Build shape symmetrically around the Y axis (from -stepAngle/2 to +stepAngle/2)
        // This makes the local center of the geometry exactly align with its pivot point.
        const halfAngle = stepAngle / 2;

        // In 2D Math and Three.js Shape: X = cos(angle) * r, Y = sin(angle) * r
        // By default +Y is "forward" when we rotate X by -90 deg.
        // We want an arc centered around +Y (90 deg or PI/2).
        // To draw a wedge, we must sweep from the smaller angle to the larger angle
        // when drawing counter-clockwise (false), otherwise it draws the entire outside of the circle.
        const startAngle = Math.PI / 2 - halfAngle;
        const endAngle = Math.PI / 2 + halfAngle;

        const startXInner = Math.cos(startAngle) * stepInnerEdge;
        const startYInner = Math.sin(startAngle) * stepInnerEdge;

        const startXOuter = Math.cos(startAngle) * outerRadius;
        const startYOuter = Math.sin(startAngle) * outerRadius;

        shape.moveTo(startXInner, startYInner);
        shape.lineTo(startXOuter, startYOuter);
        // absarc draws a circular curve: x, y, radius, startAngle, endAngle, clockwise
        shape.absarc(0, 0, outerRadius, startAngle, endAngle, false);

        const endXInner = Math.cos(endAngle) * stepInnerEdge;
        const endYInner = Math.sin(endAngle) * stepInnerEdge;
        shape.lineTo(endXInner, endYInner);

        shape.absarc(0, 0, stepInnerEdge, endAngle, startAngle, true);

        const extrudeSettings = {
            depth: stepThickness,
            bevelEnabled: false,
            curveSegments: 12,
        };

        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);

        // Extrude builds along Z. We want thickness along Y.
        // So we rotate -90 deg on X, which points +Z up to +Y.
        geo.rotateX(-Math.PI / 2);

        // Translate down so the surface is at y=0 instead of y=stepThickness
        geo.translate(0, -stepThickness / 2, 0);

        return geo;
    }, [stepInnerEdge, outerRadius, stepThickness, stepAngle]);

    const instancedMeshRef = useRef<THREE.InstancedMesh>(null);

    // Update instance matrices
    useEffect(() => {
        if (!instancedMeshRef.current) return;

        const dummy = new THREE.Object3D();
        steps.forEach((step, i) => {
            // Because the shape is drawn centered at +Y mapped to +Z (now flat)
            // It inherently points forward before rotation. 
            // We rotate it to its final angle around the Y axis.
            dummy.position.set(0, step.y, 0);
            dummy.rotation.set(0, step.angle, 0);

            dummy.updateMatrix();
            instancedMeshRef.current!.setMatrixAt(i, dummy.matrix);
        });
        instancedMeshRef.current.instanceMatrix.needsUpdate = true;

        // CRITICAL FOR SHADOWS: compute bounding sphere of all instances
        // Without this, the shadow map thinks the mesh is the size of 1 step
        // and creates massive shadow acne / z-fighting artifacts
        instancedMeshRef.current.computeBoundingSphere();
    }, [steps]);

    return (
        <group ref={groupRef} position={position} rotation={[0, rotation, 0]}>
            {/* Central Column */}
            {showColumn && (
                <mesh position={[0, totalHeight / 2, 0]}>
                    <cylinderGeometry args={[innerRadius * 0.7, innerRadius * 0.7, Math.abs(totalHeight) + Math.abs(stepHeight), 12]} />
                    <meshStandardMaterial color={columnColor} roughness={roughness} metalness={metalness} />
                </mesh>
            )}

            {/* Steps — InstancedMesh for performance */}
            <instancedMesh
                ref={instancedMeshRef}
                args={[stepGeometry, undefined, stepCount]}
                count={steps.length}
                castShadow
                receiveShadow
            >
                <meshStandardMaterial
                    color={color}
                    roughness={roughness}
                    metalness={metalness}
                />
            </instancedMesh>

            {/* DEBUG COLLISION SURFACES: Uncomment to see the generated AABBs 
            {steps.map((step) => {
                const extentRadius = (outerRadius - stepInnerEdge) / 2;
                const arcLength = outerRadius * stepAngle;
                // Use largest dimension to ensure coverage, add small buffer
                const extent = Math.max(extentRadius, arcLength / 2) + 0.1;
                return (
                    <mesh 
                        key={`debug-${step.index}`} 
                        position={[step.centerX, step.y + stepThickness / 2, step.centerZ]}
                    >
                        <boxGeometry args={[extent * 2, 0.1, extent * 2]} />
                        <meshBasicMaterial color="red" wireframe />
                    </mesh>
                );
            })}
            */}
        </group>
    );
}

export function getSpiralStairsDimensions(stepCount: number, stepHeight: number) {
    return {
        totalHeight: stepCount * stepHeight,
    };
}

export default Stairs;
