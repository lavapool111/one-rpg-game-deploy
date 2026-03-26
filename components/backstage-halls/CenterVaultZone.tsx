import { memo } from 'react';
import * as THREE from 'three';
import { ZoneCulled } from './UseZoneCulling';
import { Room } from './Room';
import { Shaft } from './Shaft';
import { Stairs } from './Stairs';
import { Hallway } from './Hallway';
import { Vault } from './Vault';
import { Pillar, CulledPointLight, WallTorch } from './DungeonDecorations';
import { InstrumentCase } from './InstrumentCase';
import { KeyPickup } from './KeyPickup';

interface CenterVaultZoneProps {
    children?: React.ReactNode;
}

export const CenterVaultZone = memo(function CenterVaultZone({ children }: CenterVaultZoneProps) {
    return (
        <>
            <Room
                position={[0, 0, 0]}
                width={25}
                length={60}
                height={25}
                northWall={12}
                southWall={12}
                hasCeiling={false}
                spawnZone={{
                    id: 'center_room',
                    label: 'Center Vault Room',
                    triggerPoint: { x: 0, y: 0, z: 156 },
                    enemies: [
                        { type: 'trumpet', weight: 0.5, levelRange: [20, 34] },
                        { type: 'trombone', weight: 0.5, levelRange: [20, 35] },
                    ],
                    respawnDelay: 10000
                }}
            >
                {/* Ceiling - shortened to stop before stairwell opening (prevents z-fighting) */}
                <mesh position={[0, 25, -2.5]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[25, 55]} />
                    <meshStandardMaterial color="#555555" roughness={0.9} side={THREE.DoubleSide} />
                </mesh>

                {/* Ceiling piece to fill gap before stairs */}
                <mesh position={[0, 25, 27.5]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[25, 5]} />
                    <meshStandardMaterial color="#555555" roughness={0.9} side={THREE.DoubleSide} />
                </mesh>

                {/* Room Lights */}
                <CulledPointLight position={[0, 20, -15]} intensity={60} color="#ffaa66" distance={50} decay={2} />
                <CulledPointLight position={[0, 20, 15]} intensity={60} color="#ffaa66" distance={50} decay={2} />

                {/* Resonance Key at back of room (vault moved to underground room) */}
                <KeyPickup type="resonance" position={[0, 1, 25]} />

                {/* Instrument Cases in corners */}
                <InstrumentCase id="center-room-case-1" position={[-10, 0.5, -25]} type="Tuba" level={1} />
                <InstrumentCase id="center-room-case-2" position={[10, 0.5, -25]} type="Euphonium" level={1} />
            </Room>

            {/* ========== BROKEN STAIR PARKOUR SECTION (Consolidated from UndergroundArea) ========== */}
            <group position={[0, 0, 30]}>
                <Stairs
                    id="parkour-stairs"
                    position={[0, 0, 0]}
                    stepCount={20}
                    stepWidth={6}
                    stepDepth={2}
                    stepHeight={1}
                    descending={true}
                    skipSteps={[1, 3, 5, 7, 9, 11, 13, 15, 17, 19]}
                    color="#7a7a7a"
                    roughness={0.85}
                />

                <Shaft
                    position={[0, -20, 19.5]}
                    width={9}
                    length={41}
                    height={45}
                    northWall={false}
                    southWall={{ present: true, height: 33, yOffset: 12 }}
                />

                <CulledPointLight position={[0, -5, 10]} intensity={20} color="#ff6644" distance={30} decay={2} />
                <CulledPointLight position={[0, -15, 30]} intensity={25} color="#ff6644" distance={25} decay={2} />
            </group>

            {/* ========== UNDERGROUND ROOM (Consolidated from UndergroundArea) ========== */}
            <ZoneCulled zone="underground_room">
                <Room
                    position={[0, -19.95, 85.5]}
                    width={30}
                    length={30}
                    height={14}
                    northWall={10}
                    southWall={12}
                    hasCeiling={false}
                    spawnZone={{
                        id: 'underground',
                        label: 'Underground Room',
                        triggerPoint: { x: 0, y: -20, z: 235 },
                        enemies: [
                            { type: 'trumpet', weight: 0.5, levelRange: [20, 35] },
                            { type: 'trombone', weight: 0.5, levelRange: [20, 35] },
                        ]
                    }}
                >
                    {/* Ceiling pieces around shaft opening */}
                    {[
                        { pos: [0, 14, -9.5], args: [30, 12] },
                        { pos: [0, 14, 12.5], args: [30, 4] },
                        { pos: [11, 14, 3.5], args: [8, 14] }
                    ].map((p, i) => (
                        <mesh key={i} position={p.pos as any} rotation={[-Math.PI / 2, 0, 0]}>
                            <planeGeometry args={p.args as any} />
                            <meshStandardMaterial color="#444444" roughness={0.9} side={THREE.DoubleSide} />
                        </mesh>
                    ))}

                    <Shaft
                        position={[-4, 14.4, 3.5]}
                        width={22}
                        length={14}
                        height={20.6}
                        hasCeiling={false}
                    />

                    <Vault type="gold" position={[0, 0, 9.5]} rotation={Math.PI} goldAmount={250} />

                    <CulledPointLight position={[0, 12, -0.5]} intensity={80} color="#ffaa66" distance={45} decay={2} />

                    {/* ========== HALLWAY EXTENSION ========== */}
                    <ZoneCulled zone="hallway_extension">
                        <group position={[0, 0, 15]}>
                            <Hallway
                                length={80}
                                position={[0, 0, 40]}
                                hasBackWall={false}
                                spawnZone={{
                                    id: 'corridor_extension',
                                    label: 'Corridor Extension',
                                    triggerPoint: { x: 0, y: -20, z: 255 },
                                    enemies: [
                                        { type: 'trumpet', weight: 0.6, levelRange: [28, 36] },
                                        { type: 'trombone', weight: 0.4, levelRange: [28, 36] },
                                    ]
                                }}
                            />

                            <CulledPointLight position={[0, 12, 20]} intensity={30} color="#ff8844" distance={40} decay={2} />
                            <CulledPointLight position={[0, 12, 60]} intensity={30} color="#ff8844" distance={40} decay={2} />

                            <WallTorch position={[-5.5, 8, 15]} rotation={Math.PI / 2} lightIntensity={10} />
                            <WallTorch position={[5.5, 8, 15]} rotation={-Math.PI / 2} lightIntensity={10} />
                            <WallTorch position={[-5.5, 8, 40]} rotation={Math.PI / 2} lightIntensity={10} />
                            <WallTorch position={[5.5, 8, 40]} rotation={-Math.PI / 2} lightIntensity={10} />
                            <WallTorch position={[-5.5, 8, 65]} rotation={Math.PI / 2} lightIntensity={10} />
                            <WallTorch position={[5.5, 8, 65]} rotation={-Math.PI / 2} lightIntensity={10} />

                            <Pillar position={[-3.5, 0, 25]} height={15} radius={0.8} />
                            <Pillar position={[3.5, 0, 25]} height={15} radius={0.8} />
                            <Pillar position={[-3.5, 0, 55]} height={15} radius={0.8} />
                            <Pillar position={[3.5, 0, 55]} height={15} radius={0.8} />

                            <InstrumentCase id="extension-case-1" position={[-3, 0.5, 10]} type="Trumpet" level={1} />
                            <InstrumentCase id="extension-case-2" position={[3, 0.5, 30]} type="Trombone" level={1} />
                            <InstrumentCase id="extension-case-3" position={[-3, 0.5, 50]} type="Euphonium" level={1} />
                            <InstrumentCase id="extension-case-4" position={[3, 0.5, 70]} type="Horn" level={1} />

                            <Vault type="gold" position={[0, 0, 75]} rotation={Math.PI} goldAmount={250} />

                            {/* Render deeper layers natively here */}
                            {children}
                        </group>
                    </ZoneCulled>
                </Room>
            </ZoneCulled>
        </>
    );
});
