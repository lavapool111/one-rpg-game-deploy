'use client';

import { memo, useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { WALL_HEIGHT, WALL_COLOR, STONE_TILE_COLOR } from './BackstageHalls';
import { registerSurfaces, unregisterSurfaces, WalkableSurface } from '@/lib/game/stairCollision';
import { SpawnZoneProps, registerSpawnZone, unregisterSpawnZone } from '@/lib/game/spawnZoneRegistry';

export interface CircularRoomProps {
    /** Radius of the circular room */
    radius: number;
    /** Room height (Y-axis) */
    height?: number;
    /** World position */
    position?: [number, number, number];
    /** Y-axis rotation in radians */
    rotation?: number;
    /** Floor toggle */
    hasFloor?: boolean;
    /** Ceiling toggle */
    hasCeiling?: boolean;
    /** Width of the entrance opening on -Z side (in units). Set to 0 for no entrance. */
    entranceWidth?: number;
    /** Width of a west opening on -X side (in units). Set to 0 for no opening. */
    westEntranceWidth?: number;
    /** Width of a north opening on +Z side (in units). Set to 0 for no opening. */
    northEntranceWidth?: number;
    /** Radial segments for the cylinder (higher = smoother) */
    segments?: number;
    /** Spawn zone config — registers this room as an enemy spawn area */
    spawnZone?: SpawnZoneProps;
    /** Child elements to render inside the room */
    children?: React.ReactNode;
}

/**
 * Circular Room component for dungeon generation.
 * Renders a cylindrical room with entrance openings.
 * 
 * Three.js CylinderGeometry convention:
 *   x = radius * sin(theta), z = radius * cos(theta)
 *   theta=0 → +Z, theta=π/2 → +X, theta=π → -Z, theta=3π/2 → -X
 */
export const CircularRoom = memo(function CircularRoom({
    radius,
    height = WALL_HEIGHT,
    position = [0, 0, 0],
    rotation = 0,
    hasFloor = true,
    hasCeiling = true,
    entranceWidth = 12,
    westEntranceWidth = 0,
    northEntranceWidth = 0,
    segments = 64,
    spawnZone,
    children,
}: CircularRoomProps) {
    const groupRef = useRef<THREE.Group>(null);

    // Register spawn zone on mount
    useEffect(() => {
        if (!spawnZone || !groupRef.current) return;

        const timer = setTimeout(() => {
            if (!groupRef.current) return;
            groupRef.current.updateMatrixWorld(true);
            const worldPos = new THREE.Vector3();
            groupRef.current.getWorldPosition(worldPos);

            registerSpawnZone({
                ...spawnZone,
                shape: 'circle',
                minX: worldPos.x - radius, // roughly useful if someone asks for AABB
                maxX: worldPos.x + radius,
                minZ: worldPos.z - radius,
                maxZ: worldPos.z + radius,
                centerX: worldPos.x,
                centerZ: worldPos.z,
                radius: radius,
                floorY: worldPos.y,
            });
        }, 500);

        return () => {
            clearTimeout(timer);
            unregisterSpawnZone(spawnZone.id);
        };
    }, [spawnZone, radius]);

    // Calculate the angle that each opening spans (chord → central angle)
    // South entrance at theta=π (-Z)
    const southAngle = useMemo(() => {
        if (entranceWidth <= 0 || entranceWidth >= radius * 2) return 0;
        return 2 * Math.asin(entranceWidth / (2 * radius));
    }, [entranceWidth, radius]);

    // West entrance at theta=3π/2 (-X)
    const westAngle = useMemo(() => {
        if (westEntranceWidth <= 0 || westEntranceWidth >= radius * 2) return 0;
        return 2 * Math.asin(westEntranceWidth / (2 * radius));
    }, [westEntranceWidth, radius]);

    // North entrance at theta=0 (+Z)
    const northAngle = useMemo(() => {
        if (northEntranceWidth <= 0 || northEntranceWidth >= radius * 2) return 0;
        return 2 * Math.asin(northEntranceWidth / (2 * radius));
    }, [northEntranceWidth, radius]);

    // Create wall geometry segments — generic multi-opening approach
    // Collects all openings as [centerTheta, halfAngle] pairs, sorts by angle,
    // then generates arcs in the gaps between openings.
    const wallGeometries = useMemo(() => {
        const openings: { center: number; half: number }[] = [];

        if (southAngle > 0) openings.push({ center: Math.PI, half: southAngle / 2 });
        if (westAngle > 0) openings.push({ center: 3 * Math.PI / 2, half: westAngle / 2 });
        if (northAngle > 0) openings.push({ center: 0, half: northAngle / 2 });

        if (openings.length === 0) {
            // Full cylinder — no openings
            return [new THREE.CylinderGeometry(radius, radius, height, segments, 1, true)];
        }

        // Sort openings by center angle
        openings.sort((a, b) => a.center - b.center);

        const geos: THREE.CylinderGeometry[] = [];

        for (let i = 0; i < openings.length; i++) {
            const curr = openings[i];
            const next = openings[(i + 1) % openings.length];

            // Arc from end of current opening to start of next opening
            const arcStart = curr.center + curr.half;
            let arcEnd = next.center - next.half;

            // Wrap around 2π if needed
            if (arcEnd <= arcStart) arcEnd += 2 * Math.PI;

            const arcLength = arcEnd - arcStart;

            if (arcLength > 0.01) {
                const arcSegments = Math.max(4, Math.round(segments * arcLength / (2 * Math.PI)));
                geos.push(new THREE.CylinderGeometry(radius, radius, height, arcSegments, 1, true, arcStart, arcLength));
            }
        }

        return geos;
    }, [radius, height, segments, southAngle, westAngle, northAngle]);

    // Floor geometry - circle
    const floorGeometry = useMemo(() => {
        return new THREE.CircleGeometry(radius, segments);
    }, [radius, segments]);

    // Register floor as a walkable surface for collision
    const surfaceId = `circular-room-${position.join('-')}`;
    useEffect(() => {
        if (!groupRef.current || !hasFloor) return;

        let registeredId = '';

        const interval = setInterval(() => {
            if (!groupRef.current) return;

            groupRef.current.updateMatrixWorld(true);
            const worldPos = new THREE.Vector3();
            groupRef.current.getWorldPosition(worldPos);

            // Approximate circular floor as AABB
            const surface: WalkableSurface = {
                id: surfaceId,
                minX: worldPos.x - radius,
                maxX: worldPos.x + radius,
                minZ: worldPos.z - radius,
                maxZ: worldPos.z + radius,
                floorY: worldPos.y,
            };

            registerSurfaces(surfaceId, [surface]);
            registeredId = surfaceId;
        }, 500);

        return () => {
            clearInterval(interval);
            if (registeredId) {
                unregisterSurfaces(registeredId);
            }
        };
    }, [surfaceId, radius, hasFloor]);

    // Helper to render entrance frame (side walls + lintel)
    const renderEntranceFrame = (
        cx: number, cz: number,  // center position
        width: number,
        isEastWest: boolean,     // true = opening faces ±X, false = faces ±Z
    ) => {
        const hw = width / 2;
        if (isEastWest) {
            // Opening faces -X: side walls at ±Z offsets
            return (
                <>
                    <mesh position={[cx, height / 2, cz - hw - 0.25]}>
                        <boxGeometry args={[1, height, 0.5]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>
                    <mesh position={[cx, height / 2, cz + hw + 0.25]}>
                        <boxGeometry args={[1, height, 0.5]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>
                    {height > WALL_HEIGHT && (
                        <mesh position={[cx, WALL_HEIGHT + (height - WALL_HEIGHT) / 2, cz]}>
                            <boxGeometry args={[1, height - WALL_HEIGHT, width + 1]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>
                    )}
                </>
            );
        } else {
            // Opening faces -Z: side walls at ±X offsets
            return (
                <>
                    <mesh position={[cx - hw - 0.25, height / 2, cz]}>
                        <boxGeometry args={[0.5, height, 1]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>
                    <mesh position={[cx + hw + 0.25, height / 2, cz]}>
                        <boxGeometry args={[0.5, height, 1]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>
                    {height > WALL_HEIGHT && (
                        <mesh position={[cx, WALL_HEIGHT + (height - WALL_HEIGHT) / 2, cz]}>
                            <boxGeometry args={[width + 1, height - WALL_HEIGHT, 1]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>
                    )}
                </>
            );
        }
    };

    return (
        <group ref={groupRef} position={position} rotation={[0, rotation, 0]}>
            {/* Cylindrical Wall Segments */}
            {wallGeometries.map((geo, i) => (
                <mesh key={i} position={[0, height / 2, 0]} geometry={geo}>
                    <meshStandardMaterial
                        color={WALL_COLOR}
                        roughness={0.9}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            ))}

            {/* Floor */}
            {hasFloor && (
                <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={floorGeometry}>
                    <meshStandardMaterial
                        color={STONE_TILE_COLOR}
                        roughness={0.9}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}

            {/* Ceiling */}
            {hasCeiling && (
                <mesh position={[0, height, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={floorGeometry}>
                    <meshStandardMaterial
                        color={WALL_COLOR}
                        roughness={0.9}
                        side={THREE.DoubleSide}
                    />
                </mesh>
            )}

            {/* South entrance frame (-Z side) */}
            {entranceWidth > 0 && renderEntranceFrame(0, -radius + 0.5, entranceWidth, false)}

            {/* West entrance frame (-X side) */}
            {westEntranceWidth > 0 && renderEntranceFrame(-radius + 0.5, 0, westEntranceWidth, true)}

            {/* North entrance frame (+Z side) */}
            {northEntranceWidth > 0 && renderEntranceFrame(0, radius - 0.5, northEntranceWidth, false)}

            {/* Room Contents */}
            {children}
        </group>
    );
});

export default CircularRoom;
