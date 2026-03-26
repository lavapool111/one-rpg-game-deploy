import { memo } from 'react';
import { WALL_COLOR } from './BackstageHalls';

/**
 * Describes a rectangular opening cut into a wall.
 */
interface Opening {
    /** Position along the wall's span axis, relative to wall center (0 = center) */
    position: number;
    /** Width of the opening */
    width: number;
    /** Y position of the bottom of the opening (0 = floor level) */
    bottom: number;
    /** Height of the opening */
    height: number;
}

interface SplitWallProps {
    /** Total width of the wall along its span axis */
    width: number;
    /** Total height of the wall */
    height: number;
    /** Position of the wall group (bottom-center) */
    position?: [number, number, number];
    /** Which axis the wall spans: 'x' for north/south walls, 'z' for east/west walls */
    axis?: 'x' | 'z';
    /** Wall thickness (default 1) */
    thickness?: number;
    /** Rectangular openings in the wall */
    openings: Opening[];
    /** Wall color */
    color?: string;
    /** Material roughness */
    roughness?: number;
}

/**
 * Computes solid rectangular regions for a wall with rectangular openings.
 * Generates vertical strips between openings, plus bottom/top fill pieces
 * for each opening that doesn't span full height.
 */
function computeSolidRegions(
    wallWidth: number,
    wallHeight: number,
    openings: Opening[]
): { x: number; y: number; w: number; h: number }[] {
    if (openings.length === 0) {
        return [{ x: 0, y: wallHeight / 2, w: wallWidth, h: wallHeight }];
    }

    const regions: { x: number; y: number; w: number; h: number }[] = [];
    const sorted = [...openings].sort((a, b) => a.position - b.position);

    let cursor = -wallWidth / 2;

    for (const opening of sorted) {
        const openLeft = opening.position - opening.width / 2;
        const openRight = opening.position + opening.width / 2;
        const openBottom = opening.bottom;
        const openTop = opening.bottom + opening.height;

        // Solid strip from cursor to opening left edge (full height)
        if (openLeft > cursor + 0.01) {
            const stripWidth = openLeft - cursor;
            regions.push({
                x: cursor + stripWidth / 2,
                y: wallHeight / 2,
                w: stripWidth,
                h: wallHeight,
            });
        }

        // Bottom piece below opening
        if (openBottom > 0.01) {
            regions.push({
                x: opening.position,
                y: openBottom / 2,
                w: opening.width,
                h: openBottom,
            });
        }

        // Top piece above opening
        if (openTop < wallHeight - 0.01) {
            const topHeight = wallHeight - openTop;
            regions.push({
                x: opening.position,
                y: openTop + topHeight / 2,
                w: opening.width,
                h: topHeight,
            });
        }

        cursor = openRight;
    }

    // Final strip from last opening to right edge
    const rightEdge = wallWidth / 2;
    if (cursor < rightEdge - 0.01) {
        const stripWidth = rightEdge - cursor;
        regions.push({
            x: cursor + stripWidth / 2,
            y: wallHeight / 2,
            w: stripWidth,
            h: wallHeight,
        });
    }

    return regions;
}

/**
 * SplitWall — a wall with rectangular openings cut into it.
 *
 * Automatically computes the solid regions needed to fill around openings.
 * Supports multiple openings at different positions and heights.
 *
 * Example:
 * ```tsx
 * <SplitWall
 *     width={25} height={75}
 *     position={[0, 0, 18]}
 *     axis="x"
 *     openings={[{ position: 0, width: 12, bottom: 59, height: 16 }]}
 * />
 * ```
 */
export const SplitWall = memo(function SplitWall({
    width,
    height,
    position = [0, 0, 0],
    axis = 'x',
    thickness = 1,
    openings,
    color = WALL_COLOR,
    roughness = 0.9,
}: SplitWallProps) {
    const regions = computeSolidRegions(width, height, openings);

    return (
        <group position={position}>
            {regions.map((region, i) => (
                <mesh
                    key={i}
                    position={
                        axis === 'x'
                            ? [region.x, region.y, 0]
                            : [0, region.y, region.x]
                    }
                >
                    <boxGeometry
                        args={
                            axis === 'x'
                                ? [region.w, region.h, thickness]
                                : [thickness, region.h, region.w]
                        }
                    />
                    <meshStandardMaterial color={color} roughness={roughness} />
                </mesh>
            ))}
        </group>
    );
});
