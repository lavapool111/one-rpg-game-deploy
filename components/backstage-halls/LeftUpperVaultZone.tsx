import { memo } from 'react';
import { ZoneCulled } from './UseZoneCulling';
import { Hallway } from './Hallway';
import { Room } from './Room';
import { Vault } from './Vault';
import { KeyPickup } from './KeyPickup';
import { CulledPointLight, WallTorch, Pillar, CulledGroup } from './DungeonDecorations';

import { STONE_TILE_COLOR, PILLAR_STONE_COLOR, WALL_COLOR } from './BackstageHalls';
import { Platform } from './Platform';

export const LeftUpperVaultZone = memo(function LeftUpperVaultZone() {
    return (
        <ZoneCulled zone="left_room_upper">
            <CulledGroup cullDistance={150}>
                {/* ========== UPPER CORRIDOR (Y=60, 40ft long) ========== */}
                <group position={[0, 60, 34]}>
                    <Hallway length={40} hasFloor={false}>
                        {/* Corridor Floor - replaced with Platform for auto collision */}
                        <Platform
                            id="upper-corridor-platform"
                            position={[0, 0, -3]}
                            width={12}
                            depth={46}
                            height={0.1}
                            color={STONE_TILE_COLOR}
                            roughness={0.9}
                        />
                    </Hallway>
                    {/* Corridor Light */}
                    <CulledPointLight position={[0, 12, 0]} intensity={30} color="#ffaa66" distance={30} decay={2} />
                </group>

                {/* ========== UPPER VAULT ROOM (55×55, Y=60) ========== */}
                <Room
                    position={[0, 60, 81.5]}
                    width={55}
                    length={55}
                    height={25}
                    northWall={12}
                    spawnZone={{
                        id: 'left_room_upper',
                        label: 'Upper Vault Room',
                        triggerPoint: { x: -180, y: 55, z: 0 },
                        enemies: [
                            { type: 'trumpet', weight: 0.53, levelRange: [45, 60] },
                            { type: 'trombone', weight: 0.33, levelRange: [45, 60] },
                            { type: 'tuba', weight: 0.14, levelRange: [45, 60] },
                        ],
                        maxEnemies: 5,
                        respawnDelay: 5000
                    }}
                >
                    {/* Vault Room auto-floor for perfect Y=60 collision mapping */}
                    <Platform
                        id="upper-vault-platform"
                        position={[0, 0, 0]}
                        width={55}
                        depth={55}
                        height={0.1}
                        visible={false}
                    />

                    {/* Vault Room Light */}
                    <CulledPointLight position={[0, 20, 0]} intensity={60} color="#ffcc88" distance={40} decay={2} />

                    {/* Corner Pillars */}
                    <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[-20, 0, -20]} height={25} radius={1.25} />
                    <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[20, 0, -20]} height={25} radius={1.25} />
                    <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[-20, 0, 20]} height={25} radius={1.25} />
                    <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[20, 0, 20]} height={25} radius={1.25} />

                    <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[-10, 0, -20]} height={25} radius={1.25} />
                    <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[10, 0, -20]} height={25} radius={1.25} />
                    <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[-10, 0, 20]} height={25} radius={1.25} />
                    <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[10, 0, 20]} height={25} radius={1.25} />

                    <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[-20, 0, -10]} height={25} radius={1.25} />
                    <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[20, 0, -10]} height={25} radius={1.25} />
                    <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[-20, 0, 10]} height={25} radius={1.25} />
                    <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[20, 0, 10]} height={25} radius={1.25} />

                    <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[-20, 0, 0]} height={25} radius={1.25} />
                    <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[20, 0, 0]} height={25} radius={1.25} />
                    <Pillar color={PILLAR_STONE_COLOR} basecolor={WALL_COLOR} position={[0, 0, 20]} height={25} radius={1.25} />

                    <KeyPickup type="resonance" position={[-16, 1, 16]} />

                    {/* Wall Torches */}
                    <WallTorch position={[27, 10, 0]} rotation={Math.PI / 2} lightIntensity={10} />
                    <WallTorch position={[-27, 10, 0]} rotation={-Math.PI / 2} lightIntensity={10} />

                    {/* 500g Vault - Center of room */}
                    <Vault type="gold" position={[0, 0, 5]} rotation={Math.PI} goldAmount={500} />
                </Room>
            </CulledGroup>
        </ZoneCulled>
    );
});
