'use client';

import React, { memo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { StoneTileFloor } from './StoneTileFloor';
import { WALL_HEIGHT, WALL_COLOR } from './BackstageHalls';
import { WallContext, CeilingContext } from './DungeonDecorations';
import { SpawnZoneProps, registerSpawnZone, unregisterSpawnZone } from '@/lib/game/spawnZoneRegistry';

export interface RoomProps {
    /** Room length (Z-axis depth) */
    length: number;
    /** Room width (X-axis) */
    width: number;
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

    color?: string;

    /** 
     * North wall (-Z direction) properties.
     * True means solid wall.
     * False means no wall.
     * Number means an opening of that width centered on the wall.
     */
    northWall?: boolean | number;

    /** South wall (+Z direction) properties. */
    southWall?: boolean | number;

    /** East wall (+X direction) properties. */
    eastWall?: boolean | number;

    /** 
     * West wall (-X direction) properties.
     */
    westWall?: boolean | number;

    /** Spawn zone config — registers this room as an enemy spawn area */
    spawnZone?: SpawnZoneProps;
    /** Child elements to render inside the room */
    children?: React.ReactNode;
}

/**
 * Reusable Room component for procedural dungeon generation.
 * Supports configurable walls, floor, ceiling, and openings for doors/corridors.
 */
export const Room = memo(function Room({
    length,
    width,
    height = WALL_HEIGHT,
    position = [0, 0, 0],
    rotation = 0,
    hasFloor = true,
    hasCeiling = true,
    northWall = true,
    southWall = true,
    eastWall = true,
    westWall = true,
    color = WALL_COLOR,
    spawnZone,
    children
}: RoomProps) {
    const wallModels = React.useContext(WallContext);
    const ceilingModels = React.useContext(CeilingContext);
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

            // Room extends ±length/2 along Z, ±width/2 along X (in local space)
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

    // Helper to render a wall section with a possible opening
    const renderWall = (
        wallSpec: boolean | number | undefined,
        wallWidth: number,
        xOffset: number,
        zOffset: number,
        isEastWest: boolean
    ) => {
        // No wall
        if (wallSpec === false) return null;

        // Solid wall
        if (wallSpec === true || wallSpec === undefined) {
            if (wallModels) {
                return (
                    <wallModels.wall
                        position={[xOffset, height / 2, zOffset]}
                        scale={isEastWest ? [1, height, wallWidth] : [wallWidth, height, 1]}
                        color={color}
                    />
                );
            }
            return (
                <mesh position={[xOffset, height / 2, zOffset]}>
                    <boxGeometry args={isEastWest ? [1, height, wallWidth] : [wallWidth, height, 1]} />
                    <meshStandardMaterial color={color} roughness={0.9} />
                </mesh>
            );
        }

        // Wall with an opening of width `wallSpec`
        const openingWidth = Number(wallSpec);
        // Ensure opening isn't larger than the wall itself
        const actualOpening = Math.min(openingWidth, wallWidth);
        const sidePanelWidth = (wallWidth - actualOpening) / 2;

        if (sidePanelWidth <= 0) return null; // Opening takes up whole wall

        // Render two side panels
        // For North/South walls (X-axis width), the panels are offset along X
        // For East/West walls (Z-axis width), the panels are offset along Z

        return (
            <group>
                {/* Left/Top Panel */}
                <mesh
                    position={[
                        xOffset + (isEastWest ? 0 : -wallWidth / 2 + sidePanelWidth / 2),
                        height / 2,
                        zOffset + (isEastWest ? -wallWidth / 2 + sidePanelWidth / 2 : 0)
                    ]}
                >
                    {wallModels ? (
                        <wallModels.wall
                            scale={isEastWest ? [1, height, sidePanelWidth] : [sidePanelWidth, height, 1]}
                            color={color}
                        />
                    ) : (
                        <>
                            <boxGeometry args={isEastWest ? [1, height, sidePanelWidth] : [sidePanelWidth, height, 1]} />
                            <meshStandardMaterial color={color} roughness={0.9} />
                        </>
                    )}
                </mesh>

                {/* Right/Bottom Panel */}
                <mesh
                    position={[
                        xOffset + (isEastWest ? 0 : wallWidth / 2 - sidePanelWidth / 2),
                        height / 2,
                        zOffset + (isEastWest ? wallWidth / 2 - sidePanelWidth / 2 : 0)
                    ]}
                >
                    {wallModels ? (
                        <wallModels.wall
                            scale={isEastWest ? [1, height, sidePanelWidth] : [sidePanelWidth, height, 1]}
                            color={color}
                        />
                    ) : (
                        <>
                            <boxGeometry args={isEastWest ? [1, height, sidePanelWidth] : [sidePanelWidth, height, 1]} />
                            <meshStandardMaterial color={color} roughness={0.9} />
                        </>
                    )}
                </mesh>

                {/* Lintel (Top piece above the door to close the gap) */}
                {/* Assuming all doorways are 15ft high standard like corridors */}
                {height > 15 && (
                    <mesh
                        position={[
                            xOffset,
                            15 + (height - 15) / 2,
                            zOffset
                        ]}
                    >
                        {wallModels ? (
                            <wallModels.wall
                                scale={isEastWest ? [1, height - 15, actualOpening] : [actualOpening, height - 15, 1]}
                                color={color}
                            />
                        ) : (
                            <>
                                <boxGeometry args={isEastWest ? [1, height - 15, actualOpening] : [actualOpening, height - 15, 1]} />
                                <meshStandardMaterial color={color} roughness={0.9} />
                            </>
                        )}
                    </mesh>
                )}
            </group>
        );
    };

    return (
        <group ref={groupRef} position={position} rotation={[0, rotation, 0]}>
            {/* Floor */}
            {hasFloor && (
                <group position={[0, 0.05, 0]}>
                    <StoneTileFloor width={width} depth={length} />
                </group>
            )}

            {/* Ceiling */}
            {hasCeiling && (
                ceilingModels ? (
                    <ceilingModels.ceiling
                        position={[0, height, 0]}
                        rotation={[-Math.PI / 2, 0, 0]}
                        scale={[width, length, 1]}
                        color={color}
                    />
                ) : (
                    <mesh position={[0, height, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                        <planeGeometry args={[width, length]} />
                        <meshStandardMaterial color={color} roughness={0.9} side={THREE.DoubleSide} />
                    </mesh>
                )
            )}

            {/* North Wall (-Z) */}
            {renderWall(northWall, width, 0, -length / 2, false)}

            {/* South Wall (+Z) */}
            {renderWall(southWall, width, 0, length / 2, false)}

            {/* East Wall (+X) */}
            {renderWall(eastWall, length, width / 2, 0, true)}

            {/* West Wall (-X) */}
            {renderWall(westWall, length, -width / 2, 0, true)}

            {/* Room Contents */}
            {children}
        </group>
    );
});

export default Room;
