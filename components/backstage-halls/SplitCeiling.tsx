import { memo } from 'react';
import * as THREE from 'three';

interface SplitCeilingProps {
    width: number;
    length: number;
    height: number;
    hole: {
        x: number; // Center X of the hole
        z: number; // Center Z of the hole
        width: number;
        length: number;
    };
    color?: string;
}

/**
 * Renders a ceiling with a rectangular cutout (hole) in it.
 * Used for stairwell openings, shafts, etc.
 */
export const SplitCeiling = memo(function SplitCeiling({
    width,
    length,
    height,
    hole,
    color = "#444444"
}: SplitCeilingProps) {

    // Calculate the 4 potential pieces
    const pieces = [];

    // Room boundaries
    const minX = -width / 2;
    const maxX = width / 2;
    const minZ = -length / 2;
    const maxZ = length / 2;

    // Hole boundaries
    const hMinX = hole.x - hole.width / 2;
    const hMaxX = hole.x + hole.width / 2;
    const hMinZ = hole.z - hole.length / 2;
    const hMaxZ = hole.z + hole.length / 2;

    // 1. Front piece (South, Z direction)
    if (hMinZ > minZ) {
        const pLen = hMinZ - minZ;
        pieces.push({
            x: 0,
            z: minZ + pLen / 2,
            w: width,
            l: pLen
        });
    }

    // 2. Back piece (North, Z direction)
    if (hMaxZ < maxZ) {
        const pLen = maxZ - hMaxZ;
        pieces.push({
            x: 0,
            z: hMaxZ + pLen / 2,
            w: width,
            l: pLen
        });
    }

    // 3. Left piece (X direction) - placed alongside the hole's Z bounds
    if (hMinX > minX) {
        const pWid = hMinX - minX;
        pieces.push({
            x: minX + pWid / 2,
            z: hole.z,
            w: pWid,
            l: hole.length
        });
    }

    // 4. Right piece (X direction) - placed alongside the hole's Z bounds
    if (hMaxX < maxX) {
        const pWid = maxX - hMaxX;
        pieces.push({
            x: hMaxX + pWid / 2,
            z: hole.z,
            w: pWid,
            l: hole.length
        });
    }

    return (
        <group position={[0, height, 0]}>
            {pieces.map((p, i) => (
                <mesh key={i} position={[p.x, 0, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[p.w, p.l]} />
                    <meshStandardMaterial color={color} roughness={0.9} side={THREE.DoubleSide} />
                </mesh>
            ))}
        </group>
    );
});
