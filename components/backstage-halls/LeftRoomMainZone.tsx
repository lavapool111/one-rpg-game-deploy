import { memo } from 'react';
import { Room } from './Room';
import { SplitWall } from './SplitWall';
import { CulledPointLight } from './DungeonDecorations';
import { Vault } from './Vault';
import { Stairs, SpiralStairs } from './Stairs';
import { Platform } from './Platform';
import { InstrumentCase } from './InstrumentCase';
import { WALL_HEIGHT, STONE_TILE_COLOR } from './BackstageHalls';

interface LeftRoomMainZoneProps {
    children?: React.ReactNode;
}

export const LeftRoomMainZone = memo(function LeftRoomMainZone({ children }: LeftRoomMainZoneProps) {
    return (
        <Room
            position={[0, 0, 0]} // Controlled by Corridor's roomOffset
            width={25}
            length={35}
            height={75}
            westWall={true}
            eastWall={false}
            southWall={false}
            northWall={false}
        >
            {/* Back Wall (West) - Split for upper corridor entrance */}
            <SplitWall
                width={25} height={75}
                position={[0, 0, 18]}
                axis="x"
                openings={[{ position: 0, width: 12, bottom: 59, height: 16 }]}
            />
            {/* Left Wall (South) - Split for extension corridor opening */}
            <SplitWall
                width={35} height={75}
                position={[13, 0, 0]}
                axis="z"
                openings={[{ position: 6, width: 14, bottom: 15, height: 20 }]}
            />

            {/* Front Wall (East - Entrance) - opening for corridor */}
            <SplitWall
                width={26} height={75}
                position={[0.5, 0, -18]}
                axis="x"
                openings={[{ position: -0.5, width: 12, bottom: 0, height: WALL_HEIGHT }]}
            />

            {/* Room Lights */}
            <CulledPointLight position={[0, 20, 10]} intensity={60} color="#ffaa66" distance={50} decay={2} />
            <CulledPointLight position={[0, 20, -10]} intensity={40} color="#ffaa66" distance={40} decay={2} />

            {/* 100g Vault */}
            <Vault type="gold" position={[0, 0, 12]} rotation={Math.PI} goldAmount={100} />

            {/* ========== STAIRS TO SECOND LEVEL ========== */}
            <Stairs
                id="left-room-stairs"
                position={[11, 0, -15]}
                rotation={0}
                stepCount={12}
                stepWidth={4}
                stepDepth={2}
                stepHeight={1}
                color="#7a7a7a"
                roughness={0.85}
            />

            {/* ========== SECOND LEVEL PLATFORM (12ft up) ========== */}
            <group position={[8, 12, 10]}>
                <Platform
                    id="left-room-platform"
                    position={[0, 0, 0]}
                    width={10}
                    depth={12}
                    height={1}
                    color={STONE_TILE_COLOR}
                    roughness={0.9}
                    ifRailingWest={true}
                />

                <InstrumentCase id="left-upper-case-1" position={[0, 0.5, 2]} type="Euphonium" level={1} />
                <InstrumentCase id="left-upper-case-2" position={[2, 0.5, -2]} type="Horn" level={1} />

                {/* ========== STAIRS TO THIRD LEVEL ========== */}
                <Stairs
                    id="left-room-stairs-2"
                    position={[-5, 2, 4]}
                    rotation={-Math.PI / 2}
                    stepCount={6}
                    stepWidth={4}
                    stepDepth={2}
                    stepHeight={1}
                    color="#7a7a7a"
                    roughness={0.85}
                />
            </group>

            {/* ========== THIRD LEVEL PLATFORM (20ft up) ========== */}
            <group position={[-7, 20, 2]}>
                <Platform
                    id="left-room-upper-platform"
                    position={[0, 0, 0]}
                    width={10}
                    depth={10}
                    height={1}
                    color={STONE_TILE_COLOR}
                    roughness={0.9}
                    ifRailingWest={true}
                    ifRailingEast={true}
                    ifRailingNorth={true}
                />

                <CulledPointLight position={[0, 8, 0]} intensity={40} color="#ffaa66" distance={30} decay={2} />

                <InstrumentCase id="left-upper2-case-1" position={[-2, 0.5, 2]} type="Tuba" level={1} />
                <InstrumentCase id="left-upper2-case-2" position={[2, 0.5, -2]} type="Trombone" level={1} />

                {/* ========== SPIRAL STAIRS TO FOURTH LEVEL ========== */}
                <SpiralStairs
                    id="left-room-spiral-stairs"
                    position={[4, 0, 0]}
                    rotation={Math.PI * 0.6}
                    stepCount={27}
                    outerRadius={6}
                    innerRadius={0.8}
                    stepHeight={1.5}
                    totalRotation={Math.PI * 2.25}
                    direction={-1}
                    color="#7a7a7a"
                    columnColor="#666666"
                    roughness={0.85}
                />
            </group>

            {/* ========== FOURTH LEVEL PLATFORM (35ft up) ========== */}
            <group position={[0, 60, 3]}>
                <Platform
                    id="left-room-fourth-platform"
                    position={[0, 0, 0]}
                    width={16}
                    depth={10}
                    height={1}
                    color={STONE_TILE_COLOR}
                    roughness={0.9}
                />

                <CulledPointLight position={[0, 8, 0]} intensity={50} color="#ffcc88" distance={35} decay={2} />

                <InstrumentCase id="left-upper3-case-1" position={[-2, 0.5, 2]} type="Tuba" level={1} />
                <InstrumentCase id="left-upper3-case-2" position={[2, 0.5, -2]} type="Euphonium" level={1} />
            </group>

            {/* Render the sub-zones (Upper Corridor/Vault, Extension Corridor/Cells) */}
            {children}
        </Room>
    );
});
