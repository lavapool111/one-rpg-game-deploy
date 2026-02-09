'use client';

import { memo, useMemo } from 'react';
import * as THREE from 'three';
import { Tuba } from './Tuba';
import { InstrumentCase } from './InstrumentCase';
import { Pillar } from '@/lib/game/pillars';

/**
 * PrisonCell Component
 * 
 * A small prison cell with half-barred walls (open at top).
 * Contains a level 15 Tuba enemy and a Tuba case.
 * 
 * Dimensions: 8x8 ft floor, 10ft tall bars (half the wall height)
 * The bars are vertical cylinders with gaps between them.
 */

interface PrisonCellProps {
    /** Unique identifier */
    id: string;
    /** World position for the cell */
    position: [number, number, number];
    /** Which side the cell opens to (determines bar placement) */
    openSide: 'left' | 'right' | 'front' | 'back';
}

// Cell dimensions
const CELL_WIDTH = 8;
const CELL_DEPTH = 8;
const BAR_HEIGHT = 10; // Half-barred - bars don't reach ceiling
const BAR_RADIUS = 0.15;
const BAR_SPACING = 1.2; // Space between bars
const BAR_COLOR = '#3a3a3a'; // Dark iron color

// Wall color (same as dungeon)
const WALL_COLOR = '#5a5a5a';

/**
 * Creates an array of bar positions along a wall
 */
function createBarPositions(length: number): number[] {
    const positions: number[] = [];
    const numBars = Math.floor(length / BAR_SPACING);
    const startOffset = (length - (numBars - 1) * BAR_SPACING) / 2;

    for (let i = 0; i < numBars; i++) {
        positions.push(-length / 2 + startOffset + i * BAR_SPACING);
    }
    return positions;
}

export const PrisonCell = memo(function PrisonCell({ id, position, openSide }: PrisonCellProps) {
    const barPositionsX = createBarPositions(CELL_WIDTH);
    const barPositionsZ = createBarPositions(CELL_DEPTH);

    // Determine which walls have bars vs solid walls
    // The open side has bars, other sides are solid walls
    const hasBarsFront = openSide === 'front';
    const hasBarsBack = openSide === 'back';
    const hasBarsLeft = openSide === 'left';
    const hasBarsRight = openSide === 'right';

    // Calculate local pillars for solid walls to block LOS
    // Walls are at +/- CELL_WIDTH/2 (4) and +/- CELL_DEPTH/2 (4)
    // We place pillars slightly outside the walls to ensure they block LOS
    const wallPillars = useMemo(() => {
        const pillars: Pillar[] = [];
        const wallOffset = 4.5; // Slightly outside the 4.0 wall
        const pillarRadius = 2.0; // Large enough to cover gaps
        const pillarHeight = 20;

        // Front Wall (Z-) - Solid if NO bars
        if (!hasBarsFront) {
            pillars.push({ id: 'wall-front-1', x: -2, z: -wallOffset, radius: pillarRadius, height: pillarHeight });
            pillars.push({ id: 'wall-front-2', x: 2, z: -wallOffset, radius: pillarRadius, height: pillarHeight });
        }

        // Back Wall (Z+) - Solid if NO bars
        if (!hasBarsBack) {
            pillars.push({ id: 'wall-back-1', x: -2, z: wallOffset, radius: pillarRadius, height: pillarHeight });
            pillars.push({ id: 'wall-back-2', x: 2, z: wallOffset, radius: pillarRadius, height: pillarHeight });
        }

        // Left Wall (X-) - Solid if NO bars
        if (!hasBarsLeft) {
            pillars.push({ id: 'wall-left-1', x: -wallOffset, z: -2, radius: pillarRadius, height: pillarHeight });
            pillars.push({ id: 'wall-left-2', x: -wallOffset, z: 2, radius: pillarRadius, height: pillarHeight });
        }

        // Right Wall (X+) - Solid if NO bars
        if (!hasBarsRight) {
            pillars.push({ id: 'wall-right-1', x: wallOffset, z: -2, radius: pillarRadius, height: pillarHeight });
            pillars.push({ id: 'wall-right-2', x: wallOffset, z: 2, radius: pillarRadius, height: pillarHeight });
        }

        return pillars;
    }, [hasBarsFront, hasBarsBack, hasBarsLeft, hasBarsRight]);

    return (
        <group position={position}>
            {/* Floor */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                <planeGeometry args={[CELL_WIDTH, CELL_DEPTH]} />
                <meshStandardMaterial color="#444444" roughness={0.9} />
            </mesh>

            {/* Front Wall (Z-) */}
            {hasBarsFront ? (
                <group position={[0, BAR_HEIGHT / 2, -CELL_DEPTH / 2]}>
                    {/* Vertical bars */}
                    {barPositionsX.map((x, i) => (
                        <mesh key={`front-bar-${i}`} position={[x, 0, 0]} raycast={() => null}>
                            <cylinderGeometry args={[BAR_RADIUS, BAR_RADIUS, BAR_HEIGHT, 8]} />
                            <meshStandardMaterial color={BAR_COLOR} roughness={0.7} metalness={0.3} />
                        </mesh>
                    ))}
                    {/* Horizontal bar at top */}
                    <mesh position={[0, BAR_HEIGHT / 2 - 0.2, 0]} rotation={[0, 0, Math.PI / 2]} raycast={() => null}>
                        <cylinderGeometry args={[BAR_RADIUS, BAR_RADIUS, CELL_WIDTH, 8]} />
                        <meshStandardMaterial color={BAR_COLOR} roughness={0.7} metalness={0.3} />
                    </mesh>
                    {/* Horizontal bar at bottom */}
                    <mesh position={[0, -BAR_HEIGHT / 2 + 0.2, 0]} rotation={[0, 0, Math.PI / 2]} raycast={() => null}>
                        <cylinderGeometry args={[BAR_RADIUS, BAR_RADIUS, CELL_WIDTH, 8]} />
                        <meshStandardMaterial color={BAR_COLOR} roughness={0.7} metalness={0.3} />
                    </mesh>
                </group>
            ) : (
                <mesh position={[0, BAR_HEIGHT / 2, -CELL_DEPTH / 2 - 0.25]}>
                    <boxGeometry args={[CELL_WIDTH, BAR_HEIGHT, 0.5]} />
                    <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                </mesh>
            )}

            {/* Back Wall (Z+) */}
            {hasBarsBack ? (
                <group position={[0, BAR_HEIGHT / 2, CELL_DEPTH / 2]}>
                    {barPositionsX.map((x, i) => (
                        <mesh key={`back-bar-${i}`} position={[x, 0, 0]} raycast={() => null}>
                            <cylinderGeometry args={[BAR_RADIUS, BAR_RADIUS, BAR_HEIGHT, 8]} />
                            <meshStandardMaterial color={BAR_COLOR} roughness={0.7} metalness={0.3} />
                        </mesh>
                    ))}
                    <mesh position={[0, BAR_HEIGHT / 2 - 0.2, 0]} rotation={[0, 0, Math.PI / 2]} raycast={() => null}>
                        <cylinderGeometry args={[BAR_RADIUS, BAR_RADIUS, CELL_WIDTH, 8]} />
                        <meshStandardMaterial color={BAR_COLOR} roughness={0.7} metalness={0.3} />
                    </mesh>
                    <mesh position={[0, -BAR_HEIGHT / 2 + 0.2, 0]} rotation={[0, 0, Math.PI / 2]} raycast={() => null}>
                        <cylinderGeometry args={[BAR_RADIUS, BAR_RADIUS, CELL_WIDTH, 8]} />
                        <meshStandardMaterial color={BAR_COLOR} roughness={0.7} metalness={0.3} />
                    </mesh>
                </group>
            ) : (
                <mesh position={[0, BAR_HEIGHT / 2, CELL_DEPTH / 2 + 0.25]}>
                    <boxGeometry args={[CELL_WIDTH, BAR_HEIGHT, 0.5]} />
                    <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                </mesh>
            )}

            {/* Left Wall (X-) */}
            {hasBarsLeft ? (
                <group position={[-CELL_WIDTH / 2, BAR_HEIGHT / 2, 0]}>
                    {barPositionsZ.map((z, i) => (
                        <mesh key={`left-bar-${i}`} position={[0, 0, z]} raycast={() => null}>
                            <cylinderGeometry args={[BAR_RADIUS, BAR_RADIUS, BAR_HEIGHT, 8]} />
                            <meshStandardMaterial color={BAR_COLOR} roughness={0.7} metalness={0.3} />
                        </mesh>
                    ))}
                    <mesh position={[0, BAR_HEIGHT / 2 - 0.2, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
                        <cylinderGeometry args={[BAR_RADIUS, BAR_RADIUS, CELL_DEPTH, 8]} />
                        <meshStandardMaterial color={BAR_COLOR} roughness={0.7} metalness={0.3} />
                    </mesh>
                    <mesh position={[0, -BAR_HEIGHT / 2 + 0.2, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
                        <cylinderGeometry args={[BAR_RADIUS, BAR_RADIUS, CELL_DEPTH, 8]} />
                        <meshStandardMaterial color={BAR_COLOR} roughness={0.7} metalness={0.3} />
                    </mesh>
                </group>
            ) : (
                <mesh position={[-CELL_WIDTH / 2 - 0.25, BAR_HEIGHT / 2, 0]}>
                    <boxGeometry args={[0.5, BAR_HEIGHT, CELL_DEPTH]} />
                    <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                </mesh>
            )}

            {/* Right Wall (X+) */}
            {hasBarsRight ? (
                <group position={[CELL_WIDTH / 2, BAR_HEIGHT / 2, 0]}>
                    {barPositionsZ.map((z, i) => (
                        <mesh key={`right-bar-${i}`} position={[0, 0, z]} raycast={() => null}>
                            <cylinderGeometry args={[BAR_RADIUS, BAR_RADIUS, BAR_HEIGHT, 8]} />
                            <meshStandardMaterial color={BAR_COLOR} roughness={0.7} metalness={0.3} />
                        </mesh>
                    ))}
                    <mesh position={[0, BAR_HEIGHT / 2 - 0.2, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
                        <cylinderGeometry args={[BAR_RADIUS, BAR_RADIUS, CELL_DEPTH, 8]} />
                        <meshStandardMaterial color={BAR_COLOR} roughness={0.7} metalness={0.3} />
                    </mesh>
                    <mesh position={[0, -BAR_HEIGHT / 2 + 0.2, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
                        <cylinderGeometry args={[BAR_RADIUS, BAR_RADIUS, CELL_DEPTH, 8]} />
                        <meshStandardMaterial color={BAR_COLOR} roughness={0.7} metalness={0.3} />
                    </mesh>
                </group>
            ) : (
                <mesh position={[CELL_WIDTH / 2 + 0.25, BAR_HEIGHT / 2, 0]}>
                    <boxGeometry args={[0.5, BAR_HEIGHT, CELL_DEPTH]} />
                    <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                </mesh>
            )}

            {/* Level 15 Tuba enemy inside the cell */}
            <Tuba
                id={`${id}-tuba`}
                initialPosition={[0, 2, 0]}
                level={15}
                maxRangeFromSpawn={3}
                // @ts-ignore - Prop will be added in next step
                localPillars={wallPillars}
            />

            {/* Tuba case in the corner of the cell */}
            <InstrumentCase
                id={`${id}-case`}
                position={[-2.5, 0.5, 2.5]}
                type="Tuba"
                level={1}
            />
        </group>
    );
});

export default PrisonCell;
