import { memo } from 'react';
import * as THREE from 'three';
import { ZoneCulled } from './UseZoneCulling';
import { Room } from './Room';
import { Hallway } from './Hallway';
import { Stairs } from './Stairs';
import { Platform } from './Platform';
import { CulledPointLight, WallTorch, Pillar } from './DungeonDecorations';
import { WALL_COLOR } from './BackstageHalls';

let DeepWallColor = "#444444";

export const DeepVaultTrialRoom = memo(function DeepVaultTrialRoom() {
    return (
        <ZoneCulled zone="deep_vault_lower">
            {/* The Trial Room starts precisely where the Deep Vault Prison left off at local Z = 120 (relative to Part 2) */}
            <group position={[0, 0, 120]}>

                {/* 1. STAIRWELL DOWN: Drops 20 feet from Y=0 to Y=-20 */}
                <Stairs
                    id="deep-vault-trial-stairs"
                    position={[0, 0, 0]}
                    stepCount={20}
                    stepWidth={20}
                    stepDepth={2}
                    stepHeight={1}
                    descending={true}
                    color={DeepWallColor}
                    roughness={0.9}
                />

                {/* Stairwell Walls */}
                {[-10.5, 10.5].map((x) => (
                    <mesh key={x} position={[x, -5, 20]}>
                        <boxGeometry args={[1, 40, 42]} />
                        <meshStandardMaterial color={DeepWallColor} roughness={0.9} />
                    </mesh>
                ))}

                {/* Stair Ceiling - Slanted to match stairs */}
                <mesh position={[0, 10, 20]} rotation={[-Math.PI / 2 + Math.atan(1 / 2), 0, 0]}>
                    <planeGeometry args={[20, 45]} />
                    <meshStandardMaterial color={DeepWallColor} roughness={0.9} side={THREE.DoubleSide} />
                </mesh>

                {/* Stair Lights */}
                <WallTorch position={[-9.5, -5, 20]} rotation={Math.PI / 2} lightIntensity={15} />
                <WallTorch position={[9.5, -5, 20]} rotation={-Math.PI / 2} lightIntensity={15} />

                {/* 2. LOWER CORRIDOR: 20 feet long. Starts at Z=40, Y=-20 */}
                <group position={[0, -20, 0]}>
                    <Hallway
                        position={[0, 0, 50]}
                        length={20}
                        width={20}
                        hasFloor={true}
                        hasCeiling={true}
                        hasFrontWall={false}
                        hasBackWall={false}
                        color={DeepWallColor}
                    />
                    <WallTorch position={[-9.5, 8, 50]} rotation={Math.PI / 2} lightIntensity={15} />
                    <WallTorch position={[9.5, 8, 50]} rotation={-Math.PI / 2} lightIntensity={15} />

                    {/* 3. TRIAL ROOM: 50x50 ft. Starts at Z=60 */}
                    <Room
                        position={[0, 0, 85]}
                        width={50}
                        length={50}
                        height={35}
                        northWall={20} // 20ft opening aligns seamlessly with the Hallway
                        southWall={true} // Solid south wall — staircase is elsewhere
                        color={DeepWallColor}
                        spawnZone={{
                            id: 'deep_vault_lower',
                            label: 'Trial of the Deep Vault',
                            triggerPoint: { x: 0, y: -40, z: 750 },
                            enemies: [
                                { type: 'tuba', weight: 0.3, levelRange: [60, 75] },
                                { type: 'euphonium', weight: 0.4, levelRange: [60, 75] },
                                { type: 'french_horn', weight: 0.3, levelRange: [60, 75] },
                            ],
                            maxEnemies: 8,
                            respawnDelay: 20000
                        }}
                    >
                        {/* Auto-bind floor physics */}
                        <Platform
                            id="trial-room-floor"
                            position={[0, 0, 0]}
                            width={50}
                            depth={50}
                            height={0.1}
                            visible={false}
                        />

                        {/* Grand Lighting */}
                        <CulledPointLight position={[0, 25, 0]} intensity={100} color="#ff3333" distance={80} decay={2} />

                        {/* 4 Massive Pillars in corners */}
                        <Pillar color="#222222" basecolor="#111111" position={[-15, 0, -15]} height={35} radius={2.5} />
                        <Pillar color="#222222" basecolor="#111111" position={[15, 0, -15]} height={35} radius={2.5} />
                        <Pillar color="#222222" basecolor="#111111" position={[-15, 0, 15]} height={35} radius={2.5} />
                        <Pillar color="#222222" basecolor="#111111" position={[15, 0, 15]} height={35} radius={2.5} />

                        {/* Torches on Pillars */}
                        <WallTorch position={[-12, 12, -15]} rotation={0} lightIntensity={20} />
                        <WallTorch position={[12, 12, -15]} rotation={0} lightIntensity={20} />
                        <WallTorch position={[-12, 12, 15]} rotation={Math.PI} lightIntensity={20} />
                        <WallTorch position={[12, 12, 15]} rotation={Math.PI} lightIntensity={20} />
                    </Room>
                </group>

            </group>
        </ZoneCulled>
    );
});

