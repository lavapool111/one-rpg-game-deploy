import { memo } from 'react';
import { ZoneCulled } from './UseZoneCulling';
import { CircularRoom } from './CircularRoom';
import { Room } from './Room';
import { Hallway } from './Hallway';
import { KeyPickup } from './KeyPickup';
import { Vault } from './Vault';
import { InstrumentCase } from './InstrumentCase';
import { DeepVaultTrialRoom } from './DeepVaultTrialRoom';
import { PrisonCell } from './PrisonCell';
import { SplitWall } from './SplitWall';
import { CulledPointLight, Pillar, WallTorch } from './DungeonDecorations';
import { PILLAR_STONE_COLOR, WALL_COLOR, WALL_HEIGHT } from './BackstageHalls';

export const CircularVaultZone = memo(function CircularVaultZone() {
    return (
        <ZoneCulled zone="circular_room">
            <CircularRoom
                radius={25}
                height={20}
                position={[0, 0, 105]}
                hasCeiling={true}
                entranceWidth={12}
                westEntranceWidth={12}
                northEntranceWidth={12}
                spawnZone={{
                    id: 'circular_room',
                    label: 'Circular Vault Room',
                    triggerPoint: { x: 0, y: -20, z: 360 },
                    enemies: [
                        { type: 'trumpet', weight: 0.53, levelRange: [43, 51] },
                        { type: 'trombone', weight: 0.33, levelRange: [40, 45] },
                        { type: 'french_horn', weight: 0.14, levelRange: [40, 45] },
                    ],
                    maxEnemies: 5,
                    respawnDelay: 10000
                }}
            >
                {/* Central Lighting */}
                <CulledPointLight position={[0, 16, 0]} intensity={60} color="#ffcc88" distance={35} decay={2} />
                <CulledPointLight position={[-12, 14, -8]} intensity={20} color="#ff8844" distance={20} decay={2} />
                <CulledPointLight position={[12, 14, 8]} intensity={20} color="#ff8844" distance={20} decay={2} />

                {/* Pillars */}
                <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[-16, 0, -12]} height={20} radius={1.25} />
                <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[16, 0, -12]} height={20} radius={1.25} />
                <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[-16, 0, 12]} height={20} radius={1.25} />
                <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[16, 0, 12]} height={20} radius={1.25} />
                <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[20, 0, 0]} height={20} radius={1.25} />
                <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[0, 0, 18]} height={20} radius={1.25} />

                {/* Wall Torches */}
                <WallTorch position={[-22, 10, -5]} rotation={Math.PI / 4} lightIntensity={10} />
                <WallTorch position={[22, 10, -5]} rotation={-Math.PI / 4} lightIntensity={10} />
                <WallTorch position={[-22, 10, 8]} rotation={Math.PI / 3} lightIntensity={10} />
                <WallTorch position={[22, 10, 8]} rotation={-Math.PI / 3} lightIntensity={10} />

                {/* Metal Door flush with far wall (+Z side) */}
                <Vault type="metal" position={[0, 0, 24.5]} rotation={Math.PI} />

                {/* Horn Cases on the far end */}
                <InstrumentCase id="circular-room-case-1" position={[-10, 0.5, 22]} type="Horn" level={1} />
                <InstrumentCase id="circular-room-case-2" position={[10, 0.5, 22]} type="Horn" level={1} />

                {/* ========== VAULT ROOM BEHIND METAL DOOR ========== */}
                <ZoneCulled zone="metal_door_vault">
                    <group position={[0, 0, 25]}>
                        <Hallway
                            length={20}
                            position={[0, 0, 10]}
                            ceilingLights={false}
                            wallTorches={true}
                        />

                        <Room
                            position={[0, 0.05, 32.5]}
                            width={30}
                            length={25}
                            height={20}
                            northWall={12}
                            southWall={20}
                            hasCeiling={true}
                            spawnZone={{
                                id: 'metal_door_vault',
                                label: 'Metal Door Vault',
                                triggerPoint: { x: 0, y: -20, z: 417 },
                                enemies: [
                                    { type: 'tuba', weight: 0.25, levelRange: [46, 58] },
                                    { type: 'trumpet', weight: 0.25, levelRange: [43, 51] },
                                    { type: 'trombone', weight: 0.25, levelRange: [43, 51] },
                                    { type: 'french_horn', weight: 0.25, levelRange: [43, 51] },
                                ],
                                maxEnemies: 5,
                                respawnDelay: 5000
                            }}
                        >
                            <CulledPointLight position={[0, 16, 0]} intensity={50} color="#ffcc88" distance={35} decay={2} />
                            <CulledPointLight position={[-8, 14, -6]} intensity={15} color="#ff8844" distance={20} decay={2} />
                            <CulledPointLight position={[8, 14, 6]} intensity={15} color="#ff8844" distance={20} decay={2} />

                            <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[-10, 0, -8]} height={20} radius={1.0} />
                            <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[10, 0, -8]} height={20} radius={1.0} />
                            <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[-10, 0, 8]} height={20} radius={1.0} />
                            <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[10, 0, 8]} height={20} radius={1.0} />

                            <WallTorch position={[0, 10, -12]} rotation={0} lightIntensity={10} />
                            <WallTorch position={[0, 10, 12]} rotation={Math.PI} lightIntensity={10} />

                            <Vault type="gold" position={[0, 0, 0]} goldAmount={500} />
                        </Room>

                        {/* ========== DEEP VAULT PRISON HALLWAY PART 1 ========== */}
                        <ZoneCulled zone="deep_vault_prison_1">
                            <group position={[0, 0, 45]}>
                                {/* Hallway Floor, Ceiling, and back wall. Length 120, width 20 */}
                                <Hallway
                                    length={120}
                                    width={20}
                                    position={[0, 0, 60]}
                                    hasFrontWall={false}
                                    hasLeftWall={false}
                                    hasRightWall={false}
                                    hasBackWall={false}
                                    spawnZone={{
                                        id: 'deep_vault_prison_1',
                                        label: 'Deep Vault Prison',
                                        triggerPoint: { x: 0, y: -20, z: 460 },
                                        enemies: [
                                            { type: 'trumpet', weight: 0.3, levelRange: [50, 65] },
                                            { type: 'trombone', weight: 0.3, levelRange: [50, 65] },
                                            { type: 'french_horn', weight: 0.2, levelRange: [50, 65] },
                                            { type: 'tuba', weight: 0.2, levelRange: [50, 65] },
                                        ],
                                        maxEnemies: 10,
                                        respawnDelay: 10000
                                    }}
                                />

                                {/* Light and torches for the prison hallway Part 1 */}
                                <CulledPointLight position={[0, 16, 40]} intensity={50} color="#ff8844" distance={60} decay={2} />
                                <CulledPointLight position={[0, 16, 120]} intensity={50} color="#ff8844" distance={60} decay={2} />

                                <WallTorch position={[-9.5, 10, 30]} rotation={Math.PI / 2} lightIntensity={10} />
                                <WallTorch position={[9.5, 10, 30]} rotation={-Math.PI / 2} lightIntensity={10} />
                                <WallTorch position={[-9.5, 10, 110]} rotation={Math.PI / 2} lightIntensity={10} />
                                <WallTorch position={[9.5, 10, 110]} rotation={-Math.PI / 2} lightIntensity={10} />

                                {/* Split Walls (Left/Right) to accommodate Prison Cells */}
                                <SplitWall
                                    width={120} height={WALL_HEIGHT}
                                    position={[-10, 0, 60]}
                                    axis="z"
                                    openings={[
                                        { position: -20, width: 8, bottom: 0, height: 10 }, // z=40
                                        { position: 30, width: 8, bottom: 0, height: 10 },  // z=90
                                    ]}
                                />
                                <SplitWall
                                    width={120} height={WALL_HEIGHT}
                                    position={[10, 0, 60]}
                                    axis="z"
                                    openings={[
                                        { position: -20, width: 8, bottom: 0, height: 10 }, // z=40
                                        { position: 30, width: 8, bottom: 0, height: 10 },  // z=90
                                    ]}
                                />

                                {/* 4 Prison Cells (2 per side) */}
                                <PrisonCell id="deep-prison-left-1" position={[-14, 0, 40]} openSide="right" enemyLevel={60} caseLevel={2} />
                                <PrisonCell id="deep-prison-left-2" position={[-14, 0, 90]} openSide="right" enemyLevel={60} caseLevel={2} />

                                <PrisonCell id="deep-prison-right-1" position={[14, 0, 40]} openSide="left" enemyLevel={60} caseLevel={2} />
                                <PrisonCell id="deep-prison-right-2" position={[14, 0, 90]} openSide="left" enemyLevel={60} caseLevel={2} />
                            </group>
                        </ZoneCulled>

                        {/* ========== DEEP VAULT PRISON HALLWAY PART 2 ========== */}
                        <ZoneCulled zone="deep_vault_prison_2">
                            <group position={[0, 0, 165]}>
                                {/* Hallway Floor, Ceiling, and back wall. Length 120, width 20 */}
                                <Hallway
                                    length={120}
                                    width={20}
                                    position={[0, 0, 60]}
                                    hasFrontWall={false}
                                    hasLeftWall={false}
                                    hasRightWall={false}
                                    hasBackWall={false}
                                    spawnZone={{
                                        id: 'deep_vault_prison_2',
                                        label: 'Deep Vault Prison',
                                        triggerPoint: { x: 0, y: -20, z: 580 },
                                        enemies: [
                                            { type: 'trumpet', weight: 0.3, levelRange: [50, 65] },
                                            { type: 'trombone', weight: 0.3, levelRange: [50, 65] },
                                            { type: 'french_horn', weight: 0.2, levelRange: [50, 65] },
                                            { type: 'tuba', weight: 0.2, levelRange: [50, 65] },
                                        ],
                                        maxEnemies: 10,
                                        respawnDelay: 10000
                                    }}
                                />

                                {/* Light and torches for the prison hallway Part 2 */}
                                <CulledPointLight position={[0, 16, 80]} intensity={50} color="#ff8844" distance={60} decay={2} />

                                <WallTorch position={[-9.5, 10, 70]} rotation={Math.PI / 2} lightIntensity={10} />
                                <WallTorch position={[9.5, 10, 70]} rotation={-Math.PI / 2} lightIntensity={10} />

                                {/* Split Walls (Left/Right) to accommodate Prison Cells */}
                                <SplitWall
                                    width={120} height={WALL_HEIGHT}
                                    position={[-10, 0, 60]}
                                    axis="z"
                                    openings={[
                                        { position: -30, width: 8, bottom: 0, height: 10 }, // z=30
                                        { position: 20, width: 8, bottom: 0, height: 10 },  // z=80
                                    ]}
                                />
                                <SplitWall
                                    width={120} height={WALL_HEIGHT}
                                    position={[10, 0, 60]}
                                    axis="z"
                                    openings={[
                                        { position: -30, width: 8, bottom: 0, height: 10 }, // z=30
                                        { position: 20, width: 8, bottom: 0, height: 10 },  // z=80
                                    ]}
                                />

                                {/* 4 Prison Cells (2 per side) */}
                                <PrisonCell id="deep-prison-left-3" position={[-14, 0, 30]} openSide="right" enemyLevel={60} caseLevel={2} />
                                <PrisonCell id="deep-prison-left-4" position={[-14, 0, 80]} openSide="right" enemyLevel={60} caseLevel={2} />

                                <PrisonCell id="deep-prison-right-3" position={[14, 0, 30]} openSide="left" enemyLevel={60} caseLevel={2} />
                                <PrisonCell id="deep-prison-right-4" position={[14, 0, 80]} openSide="left" enemyLevel={60} caseLevel={2} />

                                {/* ========== DEEP VAULT TRIAL ROOM ========== */}
                                <DeepVaultTrialRoom />
                            </group>
                        </ZoneCulled>
                    </group>
                </ZoneCulled>

                {/* ========== WEST CORRIDOR & VAULT ROOM ========== */}
                <ZoneCulled zone="west_corridor">
                    <group position={[-25, 0, 0]}>
                        <Hallway
                            length={70}
                            position={[-35, 0, 0]}
                            rotation={[0, -Math.PI / 2, 0]}
                            ceilingLights={false}
                            wallTorches={true}
                            pillars={true}
                            spawnZone={{
                                id: 'west_corridor',
                                label: 'West Tuba Corridor',
                                triggerPoint: { x: -60, y: -20, z: 360 },
                                enemies: [
                                    { type: 'tuba', weight: 1.0, levelRange: [56, 70] }
                                ],
                                maxEnemies: 5,
                                respawnDelay: 12000
                            }}
                        />

                        {/* ========== WEST VAULT ROOM ========== */}
                        <Room
                            position={[-83, 0.05, 0]}
                            width={30}
                            length={25}
                            height={20}
                            eastWall={12}
                            hasCeiling={true}
                            spawnZone={{
                                id: 'west_vault',
                                label: 'West Vault Room',
                                triggerPoint: { x: -108, y: -20, z: 360 },
                                enemies: [
                                    { type: 'trumpet', weight: 0.53, levelRange: [56, 70] },
                                    { type: 'trombone', weight: 0.33, levelRange: [56, 70] },
                                    { type: 'french_horn', weight: 0.14, levelRange: [56, 70] },
                                ],
                                maxEnemies: 5,
                                respawnDelay: 12000
                            }}
                        >
                            <CulledPointLight position={[0, 16, 0]} intensity={50} color="#ffcc88" distance={35} decay={2} />

                            <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[-10, 0, -8]} height={20} radius={1.0} />
                            <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[10, 0, -8]} height={20} radius={1.0} />
                            <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[-10, 0, 8]} height={20} radius={1.0} />
                            <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[10, 0, 8]} height={20} radius={1.0} />

                            <WallTorch position={[0, 10, -12]} rotation={0} lightIntensity={10} />
                            <WallTorch position={[0, 10, 12]} rotation={Math.PI} lightIntensity={10} />

                            <Vault type="gold" position={[0, 0, 0]} goldAmount={300} />

                            <KeyPickup type="melodic" position={[-8, 1, -8]} />
                            <KeyPickup type="resonance" position={[8, 1, -8]} />

                            <InstrumentCase id="west-vault-case-1" position={[-8, 0.5, 8]} type="Horn" level={1} />
                        </Room>
                    </group>
                </ZoneCulled>
            </CircularRoom>
        </ZoneCulled>
    );
});
