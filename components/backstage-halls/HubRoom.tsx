import { memo } from 'react';
import { Room } from './Room';
import { Arch, Pillar } from './DungeonDecorations';
import { TorchSconce } from './DungeonDecorations';
import { Bridge } from './Bridge';
import { HUB_WIDTH, HUB_DEPTH, WALL_HEIGHT, CORRIDOR_WIDTH } from './BackstageHalls';

/**
 * Hub Room - the main entrance area
 * 
 * North wall (-Z) has:
 *  - Exit door centered (handled by ExitDoor component)
 *  - Two narrow openings behind the corner pillars at X=±12
 *    leading to the descent passages
 */
export const HubRoom = memo(function HubRoom() {
    const _halfW = HUB_WIDTH / 2; // 15
    const halfD = HUB_DEPTH / 2; // 25
    const wallZ = -halfD;        // -25

    // North wall segments:
    // Full wall width = 30 (HUB_WIDTH)
    // Openings: 5ft wide centered at X=-12 (range: -14.5 to -9.5)
    //           5ft wide centered at X=+12 (range: +9.5 to +14.5)
    // Segments: 
    //   Left edge:   X = -15 to -14.5 → width 0.5
    //   Left opening: X = -14.5 to -9.5 → 5ft (no wall)
    //   Center:      X = -9.5 to +9.5 → width 19 (contains exit door)
    //   Right opening: X = +9.5 to +14.5 → 5ft (no wall)
    //   Right edge:  X = +14.5 to +15 → width 0.5

    return (
        <Room
            width={HUB_WIDTH}
            length={HUB_DEPTH}
            height={WALL_HEIGHT}
            westWall={12} // Left wall opening for corridor
            eastWall={12} // Right wall opening for corridor
            northWall={false} // Custom north wall with openings
            southWall={10} // Front wall opening for center corridor
        >

            {/* Custom North Wall with two openings behind pillars */}
            {/* Left edge segment (X: -15 to -14.5) */}
            <mesh position={[-14.75, WALL_HEIGHT / 2, wallZ]}>
                <boxGeometry args={[0.5, WALL_HEIGHT, 1]} />
                <meshStandardMaterial color="#5a5a5a" roughness={0.9} />
            </mesh>
            {/* Center segment (X: -9.5 to +9.5, width=19) — exit door sits within */}
            <mesh position={[0, WALL_HEIGHT / 2, wallZ]}>
                <boxGeometry args={[19, WALL_HEIGHT, 1]} />
                <meshStandardMaterial color="#5a5a5a" roughness={0.9} />
            </mesh>
            {/* Right edge segment (X: +14.5 to +15) */}
            <mesh position={[14.75, WALL_HEIGHT / 2, wallZ]}>
                <boxGeometry args={[0.5, WALL_HEIGHT, 1]} />
                <meshStandardMaterial color="#5a5a5a" roughness={0.9} />
            </mesh>

            {/* Torches on walls */}
            <TorchSconce position={[-HUB_WIDTH / 2 + 0.5, 10, -10]} />
            <TorchSconce position={[-HUB_WIDTH / 2 + 0.5, 10, 10]} />
            <TorchSconce position={[HUB_WIDTH / 2 - 0.5, 10, -10]} />
            <TorchSconce position={[HUB_WIDTH / 2 - 0.5, 10, 10]} />

            {/* Corner Pillars - positioned in front of the openings */}
            <Pillar position={[-12, 0, -20]} height={WALL_HEIGHT} radius={1.0} />
            <Pillar position={[12, 0, -20]} height={WALL_HEIGHT} radius={1.0} />

            {/* Arches at corridor entrances */}
            {/* Front (center corridor) */}
            <Arch position={[0, 0, HUB_DEPTH / 2]} rotation={0} width={CORRIDOR_WIDTH} height={WALL_HEIGHT} depth={1.5} />
            {/* Left corridor */}
            <Arch position={[-HUB_WIDTH / 2, 0, 0]} rotation={Math.PI / 2} width={CORRIDOR_WIDTH} height={WALL_HEIGHT} depth={1.5} />
            {/* Right corridor */}
            <Arch position={[HUB_WIDTH / 2, 0, 0]} rotation={Math.PI / 2} width={CORRIDOR_WIDTH} height={WALL_HEIGHT} depth={1.5} />

            {/* Bridge Modules (Fill gap to corridors) */}
            <Bridge position={[-20, 0, 0]} />
            <Bridge position={[20, 0, 0]} />

        </Room>
    );
});

