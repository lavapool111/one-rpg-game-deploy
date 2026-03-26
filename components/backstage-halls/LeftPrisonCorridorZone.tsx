import { memo } from 'react';
import * as THREE from 'three';
import { ZoneCulled } from './UseZoneCulling';
import { StoneTileFloor } from './StoneTileFloor';
import { SplitWall } from './SplitWall';
import { Room } from './Room';
import { Hallway } from './Hallway';
import { Shaft } from './Shaft';
import { PrisonCell } from './PrisonCell';
import { CulledPointLight, WallTorch, Pillar } from './DungeonDecorations';
import { InstrumentCase } from './InstrumentCase';
import { WALL_HEIGHT, WALL_COLOR } from './BackstageHalls';

export const LeftPrisonCorridorZone = memo(function LeftPrisonCorridorZone() {
    return (
        <ZoneCulled zone="left_extension">
            <group position={[13, 15, 6]}>
                {/* Extension Corridor Floor - extends 237ft to reach world Z=250 */}
                <group position={[118.5, 0.05, 0]}>
                    <StoneTileFloor width={237} depth={14} />
                </group>

                {/* Invisible Spawners */}
                <Room
                    width={14} length={100} position={[50, 0, 0]} rotation={Math.PI / 2}
                    hasFloor={false} northWall={false} southWall={false} eastWall={false} westWall={false}
                    spawnZone={{
                        id: 'left_extension',
                        label: 'Left Extension',
                        triggerPoint: { x: -150, y: 15, z: 65 },
                        enemies: [
                            { type: 'trumpet', weight: 0.7, levelRange: [30, 48] },
                            { type: 'trombone', weight: 0.3, levelRange: [30, 48] },
                        ],
                        maxEnemies: 5,
                        respawnDelay: 10000
                    }}
                />
                <Room
                    width={14} length={100} position={[170, 0, 0]} rotation={Math.PI / 2}
                    hasFloor={false} northWall={false} southWall={false} eastWall={false} westWall={false}
                    spawnZone={{
                        id: 'far_left_extension',
                        label: 'Far Left Extension',
                        triggerPoint: { x: -150, y: 15, z: 185 },
                        enemies: [
                            { type: 'trumpet', weight: 0.7, levelRange: [35, 55] },
                            { type: 'trombone', weight: 0.3, levelRange: [35, 55] },
                        ],
                        maxEnemies: 5,
                        respawnDelay: 10000
                    }}
                />

                {/* Left Wall (West side) - with prison cell openings */}
                <SplitWall
                    width={237} height={WALL_HEIGHT}
                    position={[118.5, 0, 7.5]}
                    axis="x"
                    openings={[
                        { position: -83.5, width: 8, bottom: 0, height: 10 },
                        { position: -63.5, width: 8, bottom: 0, height: 10 },
                    ]}
                />

                {/* Right Wall (East side) - with prison cell + branch openings */}
                <SplitWall
                    width={237} height={WALL_HEIGHT}
                    position={[118.5, 0, -7.5]}
                    axis="x"
                    openings={[
                        { position: -83.5, width: 8, bottom: 0, height: 10 },
                        { position: -63.5, width: 8, bottom: 0, height: 10 },
                        { position: 112.5, width: 12, bottom: 0, height: WALL_HEIGHT },
                    ]}
                />

                {/* End Wall (South end - furthest from room, at local X=237) */}
                <mesh position={[237.5, WALL_HEIGHT / 2, 0]}>
                    <boxGeometry args={[1, WALL_HEIGHT, 14]} />
                    <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                </mesh>

                {/* Ceiling */}
                <mesh position={[118.5, WALL_HEIGHT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[237, 14]} />
                    <meshStandardMaterial color={WALL_COLOR} roughness={0.9} side={THREE.DoubleSide} />
                </mesh>

                {/* Corridor Lights */}
                <CulledPointLight position={[45, 12, 0]} intensity={35} color="#ff8844" distance={70} decay={2} />
                <CulledPointLight position={[100, 12, 0]} intensity={35} color="#ff8844" distance={70} decay={2} />
                <CulledPointLight position={[160, 12, 0]} intensity={35} color="#ff8844" distance={70} decay={2} />
                <CulledPointLight position={[220, 12, 0]} intensity={35} color="#ff8844" distance={70} decay={2} />

                {/* Wall Torches */}
                <WallTorch position={[20, 8, -6.5]} rotation={0} lightIntensity={10} />
                <WallTorch position={[50, 8, 6.5]} rotation={Math.PI} lightIntensity={10} />
                <WallTorch position={[80, 8, -6.5]} rotation={0} lightIntensity={10} />
                <WallTorch position={[110, 8, 6.5]} rotation={Math.PI} lightIntensity={10} />
                <WallTorch position={[140, 8, -6.5]} rotation={0} lightIntensity={10} />
                <WallTorch position={[170, 8, 6.5]} rotation={Math.PI} lightIntensity={10} />
                <WallTorch position={[200, 8, -6.5]} rotation={0} lightIntensity={10} />
                <WallTorch position={[230, 8, 6.5]} rotation={Math.PI} lightIntensity={10} />

                {/* ========== PRISON CELLS ========== */}
                <PrisonCell id="prison-cell-left-1" position={[35, 0, 11.5]} openSide="front" enemyLevel={30} caseLevel={1} />
                <PrisonCell id="prison-cell-left-2" position={[55, 0, 11.5]} openSide="front" enemyLevel={30} caseLevel={1} />
                <PrisonCell id="prison-cell-right-1" position={[35, 0, -11.5]} openSide="back" enemyLevel={30} caseLevel={1} />
                <PrisonCell id="prison-cell-right-2" position={[55, 0, -11.5]} openSide="back" enemyLevel={30} caseLevel={1} />

                {/* Instrument Cases */}
                <InstrumentCase id="left-ext-case-1" position={[15, 0.5, 5]} type="Trumpet" level={1} />
                <InstrumentCase id="left-ext-case-2" position={[40, 0.5, -5]} type="Trumpet" level={1} />
                <InstrumentCase id="left-ext-case-3" position={[65, 0.5, 5]} type="Trombone" level={1} />
                <InstrumentCase id="left-ext-case-4" position={[90, 0.5, -5]} type="Trumpet" level={1} />
                <InstrumentCase id="left-ext-case-5" position={[115, 0.5, 5]} type="Trumpet" level={1} />

                {/* ========== LEFT BRANCH CORRIDOR ========== */}
                <ZoneCulled zone="left_branch">
                    // to prevent z-fighting, floor at 0.05
                    <group position={[231, 0.05, -7.5]}>
                        <Hallway length={126} position={[0, 0, -63]} hasFrontWall={true} />

                        {/* Corridor-level walls around the shaft opening */}
                        <Shaft
                            position={[0, 0, -137]}
                            width={12}
                            length={22}
                            height={WALL_HEIGHT}
                            southWall={false}
                        />

                        {/* Shaft Light */}
                        <CulledPointLight position={[0, -5, -137]} intensity={25} color="#ff6633" distance={50} decay={2} />

                        {/* Branch Lights */}
                        <CulledPointLight position={[0, 12, -25]} intensity={35} color="#ff8844" distance={70} decay={2} />
                        <CulledPointLight position={[0, 12, -75]} intensity={35} color="#ff8844" distance={70} decay={2} />
                        <CulledPointLight position={[0, 12, -115]} intensity={35} color="#ff8844" distance={70} decay={2} />

                        {/* Branch Wall Torches */}
                        <WallTorch position={[5.5, 8, -15]} rotation={-Math.PI / 2} lightIntensity={10} />
                        <WallTorch position={[-5.5, 8, -40]} rotation={Math.PI / 2} lightIntensity={10} />
                        <WallTorch position={[5.5, 8, -65]} rotation={-Math.PI / 2} lightIntensity={10} />
                        <WallTorch position={[-5.5, 8, -90]} rotation={Math.PI / 2} lightIntensity={10} />
                        <WallTorch position={[5.5, 8, -115]} rotation={-Math.PI / 2} lightIntensity={10} />

                        {/* Decorative Pillars */}
                        <Pillar position={[-4, 0, -37]} height={15} radius={0.8} />
                        <Pillar position={[4, 0, -37]} height={15} radius={0.8} />
                        <Pillar position={[-4, 0, -100]} height={15} radius={0.8} />
                        <Pillar position={[4, 0, -100]} height={15} radius={0.8} />

                        {/* Instrument Cases */}
                        <InstrumentCase id="branch-case-1" position={[-3, 0.5, -30]} type="Trombone" level={1} />
                        <InstrumentCase id="branch-case-2" position={[3, 0.5, -70]} type="Euphonium" level={1} />
                        <InstrumentCase id="branch-case-3" position={[-3, 0.5, -110]} type="Horn" level={1} />
                    </group>
                </ZoneCulled>
            </group>
        </ZoneCulled>
    );
});
