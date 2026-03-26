import { memo } from 'react';
import * as THREE from 'three';
import { Room } from './Room';
import { Vault } from './Vault';
import { Stairs } from './Stairs';
import { InstrumentCase } from './InstrumentCase';
import { CulledPointLight } from './DungeonDecorations';
import { WALL_COLOR } from './BackstageHalls';

import { KeyPickup } from './KeyPickup';

export const RightMainZone = memo(function RightMainZone() {
    return (
        <Room
            position={[0, 0, 0]} // Position handled by Corridor offset (12.5)
            width={15}
            length={25}
            northWall={12}
            southWall={6}
        >
            {/* Room Light */}
            <CulledPointLight position={[0, 10, 10]} intensity={40} color="#ffaa66" distance={40} decay={2} />

            {/* 200g Vault against Left Wall */}
            <Vault type="gold" position={[-7, 0, 0]} rotation={-Math.PI / 2} goldAmount={200} />

            {/* Instrument Cases in corners */}
            <InstrumentCase id="right-room-case-2" position={[5, 0.5, -8]} type="Trombone" level={1} />

            {/* ========== RIGHT ROOM STAIRWELL ========== */}
            <group position={[0, 0, 12.5]}>
                <Stairs
                    id="right-room-stairs"
                    position={[0, 0, 0]}
                    stepCount={20}
                    stepWidth={6}
                    stepDepth={2}
                    stepHeight={1}
                    descending={true}
                    color="#7a7a7a"
                    roughness={0.85}
                />

                {/* Stairwell Walls mapped */}
                {[-3.5, 3.5].map(x => (
                    <mesh key={x} position={[x, 2.5, 19.5]}>
                        <boxGeometry args={[1, 45, 41]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>
                ))}

                {/* Back wall of shaft - above lower room entrance */}
                <mesh position={[0, 4.5, 39.5]}>
                    <boxGeometry args={[8, 21, 1]} />
                    <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                </mesh>

                {/* Cut the roof back to avoid clipping into room */}
                <mesh position={[0, 15, 20]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[6, 42]} />
                    <meshStandardMaterial color="#555555" roughness={0.9} side={THREE.DoubleSide} />
                </mesh>

                {/* Lighting */}
                <CulledPointLight position={[0, -5, 10]} intensity={20} color="#ff6644" distance={30} decay={2} />
                <CulledPointLight position={[0, -15, 30]} intensity={25} color="#ff6644" distance={25} decay={2} />
            </group>

            {/* ========== RIGHT UNDERGROUND ROOM ========== */}
            <Room
                position={[0, -20, 62.5]}
                width={20}
                length={20}
                height={14}
                northWall={6}
                hasCeiling={true}
                spawnZone={{
                    id: 'right_underground',
                    label: 'Right Underground Room',
                    triggerPoint: { x: 200, y: -20, z: 0 },
                    enemies: [
                        { type: 'trumpet', weight: 0.5, levelRange: [30, 48] },
                        { type: 'trombone', weight: 0.3, levelRange: [30, 48] },
                        { type: 'french_horn', weight: 0.14, levelRange: [40, 58] },
                        { type: 'tuba', weight: 0.06, levelRange: [40, 58] },
                    ],
                    maxEnemies: 5,
                    respawnDelay: 10000
                }}
            >
                <KeyPickup type='resonance' position={[0, 0.5, 5]} />
                <CulledPointLight position={[0, 10, 0]} intensity={50} color="#ffaa66" distance={40} decay={2} />
                <InstrumentCase id="right-under-case-1" position={[-6, 0.8, 6]} type="Horn" level={1} />
                <InstrumentCase id="right-under-case-2" position={[6, 0.8, 6]} type="Tuba" level={1} />
            </Room>
        </Room>
    );
});
