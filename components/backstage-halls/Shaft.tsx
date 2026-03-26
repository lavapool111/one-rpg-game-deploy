import React from 'react';
import * as THREE from 'three';
import { WALL_COLOR } from './BackstageHalls';

interface ShaftWallProps {
    present: boolean;
    height?: number; // custom height
    yOffset?: number; // custom bottom offset
}

interface ShaftProps {
    position?: [number, number, number];
    width: number; // inner width along X
    length: number; // inner length along Z
    height: number; // default height for all walls
    thickness?: number; // default 1
    northWall?: boolean | ShaftWallProps; // -Z
    southWall?: boolean | ShaftWallProps; // +Z
    eastWall?: boolean | ShaftWallProps; // +X
    westWall?: boolean | ShaftWallProps; // -X
    hasCeiling?: boolean;
    color?: string; // default WALL_COLOR
    children?: React.ReactNode;
}

export function Shaft({
    position = [0, 0, 0],
    width,
    length,
    height,
    thickness = 1,
    northWall = true,
    southWall = true,
    eastWall = true,
    westWall = true,
    hasCeiling = true,
    color = WALL_COLOR,
    children
}: ShaftProps) {
    const renderWall = (
        wallConfig: boolean | ShaftWallProps | undefined,
        w: number,
        l: number,
        posX: number,
        posZ: number
    ) => {
        if (!wallConfig) return null;

        let h = height;
        let y = height / 2;

        if (typeof wallConfig === 'object' && wallConfig.present) {
            h = wallConfig.height ?? height;
            y = (wallConfig.yOffset ?? 0) + h / 2;
        } else if (typeof wallConfig === 'object' && !wallConfig.present) {
            return null;
        }

        return (
            <mesh position={[posX, y, posZ]}>
                <boxGeometry args={[w, h, l]} />
                <meshStandardMaterial color={color} roughness={0.9} />
            </mesh>
        );
    };

    return (
        <group position={position}>
            {/* North Wall (-Z) */}
            {renderWall(northWall, width, thickness, 0, -length / 2 - thickness / 2)}
            {/* South Wall (+Z) */}
            {renderWall(southWall, width, thickness, 0, length / 2 + thickness / 2)}
            {/* East Wall (+X) */}
            {renderWall(eastWall, thickness, length + thickness * 2, width / 2 + thickness / 2, 0)}
            {/* West Wall (-X) */}
            {renderWall(westWall, thickness, length + thickness * 2, -width / 2 - thickness / 2, 0)}

            {/* Ceiling */}
            {hasCeiling && (
                <mesh position={[0, height, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[width + thickness, length + thickness]} />
                    <meshStandardMaterial color={WALL_COLOR} roughness={0.9} side={THREE.DoubleSide} />
                </mesh>
            )}
            {children}
        </group>
    );
}
