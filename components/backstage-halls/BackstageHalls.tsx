'use client';

import { useRef, useEffect, useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { KeyPickup } from './KeyPickup';
import { Vault } from './Vault';
import { BackstageSpawner } from '../enemies/BackstageSpawner';
import { InstrumentCase, InstrumentCaseInstances } from './InstrumentCase';
import { CulledPointLight, PillarInstances, WallTorchInstances, WallInstances, CeilingInstances } from './DungeonDecorations';
import { useZoneCulling, ZoneCullingContext } from './UseZoneCulling';
import { useGameStore } from '@/lib/store';
import AudioManager from '@/lib/audio/AudioManager';
import { ExitDoor } from './ExitDoor';
import { HubRoom } from './HubRoom';
import { HubDescent } from './HubDescent';

// Zones

import { Corridor } from './Corridor';
import { LeftRoomMainZone } from './LeftRoomMainZone';
import { LeftUpperVaultZone } from './LeftUpperVaultZone';
import { LeftPrisonCorridorZone } from './LeftPrisonCorridorZone';
import { RightMainZone } from './RightMainZone';
import { CenterVaultZone } from './CenterVaultZone';
import { CircularVaultZone } from './CircularVaultZone';

// Ambient music for the dungeon
const DUNGEON_MUSIC_KEY = 'backstage_ambient';
const DUNGEON_MUSIC_SRC = '/audio/Shadows Beneath the Gate.mp3';

/**
 * BackstageHalls Component
 * 
 * A megadungeon environment with:
 * - Grey stone tile floors (4x4 ft tiles) that look like rocks with cracks
 * - Tall stone walls (15 ft)
 * - Bright enough lighting to see
 * - Central hub room (30x50 ft) with three branching paths
 */

interface BackstageHallsProps {
    /** Quality setting */
    quality?: 'low' | 'normal' | 'high';
    /** Children */
    children?: React.ReactNode;
}

// Dimensions
export const HUB_WIDTH = 30;
export const HUB_DEPTH = 50;
export const WALL_HEIGHT = 15;

export const CORRIDOR_WIDTH = 12; // 12 feet wide corridors (3 tiles)
export const CORRIDOR_LENGTH = 100;
// Bump this version whenever floor surfaces change to force re-registration on hot reload
// Increment SURFACE_VERSION from 11 to 12 to force cache invalidation
const SURFACE_VERSION = 12;


// Colors - warmer stone palette
export const STONE_TILE_COLOR = '#6a6a6a';

export const WALL_COLOR = '#5a5a5a';
export const PILLAR_STONE_COLOR = '#9E9389'

export function BackstageHalls({
    quality: _quality = 'normal',
    children,
}: BackstageHallsProps) {
    useBackstageFloors();
    const zoneCulling = useZoneCulling();

    // Track component instance to distinguish remount from effect re-run
    const _instanceId = useRef(Math.random().toString(36).substring(7));

    // Ambient dungeon music - start on mount, stop on unmount
    useEffect(() => {
        // Load and play dungeon ambient music
        AudioManager.load(DUNGEON_MUSIC_KEY, DUNGEON_MUSIC_SRC);
        AudioManager.play(DUNGEON_MUSIC_KEY, 'music', {
            loop: true,
            volume: 0.4  // Lower volume for ambient
        });

        // Cleanup - stop music when leaving dungeon
        return () => {
            AudioManager.stop(DUNGEON_MUSIC_KEY);
        };
    }, []);

    return (
        <ZoneCullingContext.Provider value={zoneCulling}>
            <PillarInstances>
                {() => (
                    <InstrumentCaseInstances>
                        {() => (
                            <WallTorchInstances>
                                {() => (
                                    <WallInstances>
                                        {(wallModels) => (
                                            <CeilingInstances>
                                                {(ceilingModels) => (
                                                    <group>
                                                        {/* Balanced ambient light - neutral white */}
                                                        <ambientLight intensity={0.7} color="#ffffff" />

                                                        {/* Hemisphere light - warm top, cool bottom */}
                                                        <hemisphereLight
                                                            args={['#ffffee', '#554433', 0.5]}
                                                            position={[0, 20, 0]}
                                                        />

                                                        {/* Warm point lights for torch glow */}
                                                        <CulledPointLight position={[-12, 8, 0]} intensity={30} color="#ff9955" distance={60} decay={2} />
                                                        <CulledPointLight position={[12, 8, 0]} intensity={30} color="#ff9955" distance={60} decay={2} />
                                                        <CulledPointLight position={[0, 8, -15]} intensity={30} color="#ff9955" distance={60} decay={2} />
                                                        <CulledPointLight position={[0, 8, 15]} intensity={30} color="#ff9955" distance={60} decay={2} />

                                                        {/* Central Hub Room */}
                                                        <HubRoom />

                                                        {/* Exit door at back of hub */}
                                                        <ExitDoor />

                                                        {/* Hub Descent — two passages behind pillars converging to spiral staircase */}
                                                        <HubDescent />

                                                        {/* Three Branching Corridors */}
                                                        <Corridor
                                                            angle={-Math.PI / 2}
                                                            roomOffset={17.5}
                                                            spawnZone={{
                                                                id: 'left_corridor',
                                                                label: 'Left Path',
                                                                triggerPoint: { x: -25, z: 0 },
                                                                enemies: [
                                                                    { type: 'trumpet', weight: 0.5, levelRange: [10, 18] },
                                                                    { type: 'trombone', weight: 0.5, levelRange: [10, 18] },
                                                                ],
                                                                frenchHornChance: 0.075,
                                                                frenchHornLevelRange: [16, 21],
                                                                respawnDelay: 10000
                                                            }}
                                                        >
                                                            <LeftRoomMainZone>
                                                                <LeftUpperVaultZone />
                                                                <LeftPrisonCorridorZone />
                                                            </LeftRoomMainZone>
                                                        </Corridor>

                                                        <Corridor
                                                            angle={0}
                                                            roomOffset={30}
                                                            spawnZone={{
                                                                id: 'center_corridor',
                                                                label: 'Center Path',
                                                                triggerPoint: { x: 0, z: 25 },
                                                                enemies: [
                                                                    { type: 'trumpet', weight: 0.5, levelRange: [9, 12] },
                                                                    { type: 'trombone', weight: 0.5, levelRange: [9, 14] },
                                                                ],
                                                                frenchHornChance: 0.075,
                                                                frenchHornLevelRange: [16, 21],
                                                                respawnDelay: 10000

                                                            }}
                                                        >
                                                            <CenterVaultZone>
                                                                <CircularVaultZone />
                                                            </CenterVaultZone>
                                                        </Corridor>

                                                        <Corridor
                                                            angle={Math.PI / 2}
                                                            roomOffset={12.5}
                                                            spawnZone={{
                                                                id: 'right_corridor',
                                                                label: 'Right Path',
                                                                triggerPoint: { x: 25, z: 0 },
                                                                enemies: [
                                                                    { type: 'trumpet', weight: 1.0, levelRange: [18, 24] },
                                                                ],
                                                                frenchHornChance: 0.075,
                                                                frenchHornLevelRange: [26, 31],
                                                                respawnDelay: 10000

                                                            }}
                                                        >
                                                            <RightMainZone />
                                                        </Corridor>

                                                        {/* Test Key Spawns - 3 Resonance Keys in corridors */}
                                                        <KeyPickup type="resonance" position={[-20, 1, 0]} />
                                                        <KeyPickup type="resonance" position={[20, 1, 0]} />
                                                        <KeyPickup type="resonance" position={[0, 1, 40]} />

                                                        {/* Gold Vault at end of center corridor - rotated 180° to face player */}
                                                        <Vault type="gold" position={[0, 0, 85]} goldAmount={150} rotation={Math.PI} />

                                                        {/* Fog - not too dense */}
                                                        <fog attach="fog" args={['#1a1a2a', 20, 120]} />

                                                        {/* Enemy Spawner */}
                                                        <BackstageSpawner enabled={useGameStore(state => state.simulationActive)} />

                                                        {/* Instrument Cases scattered in corridors */}
                                                        {/* Hub corners */}
                                                        <InstrumentCase id="hub-case-1" position={[-12, 0.5, -22]} type="Trumpet" level={1} />
                                                        <InstrumentCase id="hub-case-2" position={[12, 0.5, -22]} type="Horn" level={1} />
                                                        {/* Left Corridor */}
                                                        <InstrumentCase id="left-corr-case-1" position={[-35, 0.5, 4]} type="Trombone" level={1} />
                                                        <InstrumentCase id="left-corr-case-2" position={[-65, 0.5, -4]} type="Euphonium" level={1} />
                                                        {/* Right Corridor */}
                                                        <InstrumentCase id="right-corr-case-1" position={[35, 0.5, -4]} type="Trumpet" level={1} />
                                                        <InstrumentCase id="right-corr-case-2" position={[65, 0.5, 4]} type="Horn" level={1} />
                                                        {/* Center Corridor */}
                                                        <InstrumentCase id="center-corr-case-1" position={[-4, 0.5, 45]} type="Tuba" level={1} />
                                                        <InstrumentCase id="center-corr-case-2" position={[4, 0.5, 85]} type="Euphonium" level={1} />
                                                    </group>
                                                )}
                                            </CeilingInstances>
                                        )}
                                    </WallInstances>
                                )}
                            </WallTorchInstances>
                        )}
                    </InstrumentCaseInstances>
                )}
            </PillarInstances>
        </ZoneCullingContext.Provider>
    );
}

import { registerSurfaces, unregisterSurfaces } from '@/lib/game/stairCollision';

/**
 * Register floors for the new expansion
 */
function useBackstageFloors() {
    useLayoutEffect(() => {
        // Lower Hall: Z 141 to 241, Y -4, Width 10 (X -5 to 5)
        // Boss Room: Circular, Center (0, 266), Radius 25, Y -5.5.
        // Approx boss room as a square for floor registry: X -20 to 20, Z 241 to 291.

        const surfaces = [
            // Hub & Main Corridors (Level 0)
            { id: 'hub-floor', minX: -15, maxX: 15, minZ: -25, maxZ: 25, floorY: 0 },
            { id: 'center-corridor-floor', minX: -6, maxX: 6, minZ: 25, maxZ: 125, floorY: 0 },
            { id: 'left-corridor-floor', minX: -125, maxX: -25, minZ: -6, maxZ: 6, floorY: 0 },
            { id: 'left-room-floor', minX: -160, maxX: -125, minZ: -12.5, maxZ: 12.5, floorY: 0 },
            { id: 'right-corridor-floor', minX: 25, maxX: 125, minZ: -6, maxZ: 6, floorY: 0 },
            { id: 'right-room-floor', minX: 125, maxX: 150, minZ: -7.5, maxZ: 7.5, floorY: 0 },
            // Center Vault Room - main floor (ends at Z=183 to avoid margin overlap with stairwell)
            { id: 'center-room-floor', minX: -12.5, maxX: 12.5, minZ: 125, maxZ: 183, floorY: 0 },
            // Stairwell catch floor at very low Y - prevents detecting Y=0 floors
            // Wide enough to cover entire stairwell and room (X: -16 to 16 for 30ft room)
            // Extends from Z=185 to Z=222 to overlap with underground room start
            { id: 'stairwell-catch-floor', minX: -16, maxX: 16, minZ: 185, maxZ: 222, floorY: -1000 },
            // Note: Stairs component (parkour-stairs) registers its own step surfaces
            // Underground Room (floor at Y=-20, 30x30 room, world Z=225-255)
            { id: 'underground-room-floor', minX: -15, maxX: 15, minZ: 225, maxZ: 255, floorY: -20 },
            // New Hallway Extension (floor at Y=-20, 12ft wide, world Z=255-366)
            { id: 'hallway-extension-floor', minX: -6, maxX: 6, minZ: 255, maxZ: 366, floorY: -20 },
            // Right Room Stairwell catch floor (Y=-1000 to catch falls)
            { id: 'right-stairwell-catch', minX: 150, maxX: 191, minZ: -3, maxZ: 3, floorY: -1000 },
            // Right Underground Room (floor at Y=-20, 20x20 room)
            { id: 'right-underground-floor', minX: 190, maxX: 211, minZ: -10, maxZ: 10, floorY: -20 },
            // Left Room South Extension Corridor (elevated at Y=15)
            // X extended to -160 to cover full platform width (platform extends to X=-158.5)
            { id: 'left-room-extension-floor', minX: -160, maxX: -141, minZ: 10, maxZ: 250, floorY: 15 },
            // Prison Cell Floors (elevated at Y=15, 8x8 ft each)
            // West cells (local Z=+11.5): X from -164 to -156
            // East cells (local Z=-11.5): X from -141 to -133
            // Cell Z positions: 47-55 and 67-75
            { id: 'prison-cell-west-1', minX: -164, maxX: -154, minZ: 47, maxZ: 55, floorY: 15 },
            { id: 'prison-cell-west-2', minX: -164, maxX: -154, minZ: 67, maxZ: 75, floorY: 15 },
            { id: 'prison-cell-east-1', minX: -143, maxX: -133, minZ: 47, maxZ: 55, floorY: 15 },
            { id: 'prison-cell-east-2', minX: -143, maxX: -133, minZ: 67, maxZ: 75, floorY: 15 },
            // Left Branch Corridor (elevated at Y=15, corridor part only — shaft area has no floor)
            // Runs east: X=-141 to X=-15 (shaft starts at X=-15)
            { id: 'left-branch-floor', minX: -141, maxX: -15, minZ: 237, maxZ: 251, floorY: 15 },
            // Left Room Upper Platform (third level at Y=20, 10x10ft)
            // Room local [-7, 20, 2] → World: X ≈ -150 to -140, Z ≈ -12 to -2
            { id: 'left-room-upper-platform', minX: -150, maxX: -139, minZ: -12, maxZ: -2, floorY: 20 },
            // Left Room Fourth Floor - auto-registered by Platform component, no manual entry needed
            // Upper Corridor & Vault Room (Y=60) - auto-registered by Platform components in LeftRoomUpperZone.tsx
            // West Tuba Corridor (from circular room going -X, floor at Y=-20)
            { id: 'west-tuba-corridor-floor', minX: -95, maxX: -23, minZ: 354, maxZ: 366, floorY: -20 },
            // West Vault Room (30x25ft room at end of west corridor, floor at Y=-20)
            { id: 'west-vault-room-floor', minX: -123, maxX: -83, minZ: 347, maxZ: 373, floorY: -20 },
            // Catch floors for underground areas (Y=-1000 prevents enemies defaulting to Y=1.5)
            { id: 'circular-room-catch', minX: -25, maxX: 25, minZ: 335, maxZ: 385, floorY: -1000 },
            { id: 'hallway-extension-catch', minX: -6, maxX: 6, minZ: 255, maxZ: 366, floorY: -1000 },
            { id: 'west-corridor-catch', minX: -98, maxX: -23, minZ: 354, maxZ: 366, floorY: -1000 },
            { id: 'west-vault-catch', minX: -123, maxX: -96, minZ: 347, maxZ: 373, floorY: -1000 },
            // Metal Door Vault corridor + room (hallway extended into circular room for overlap)
            { id: 'metal-door-hallway-floor', minX: -6, maxX: 6, minZ: 370, maxZ: 406, floorY: -20 },
            { id: 'metal-door-vault-floor', minX: -15, maxX: 15, minZ: 405, maxZ: 430, floorY: -20 },
            { id: 'deep-vault-prison-floor', minX: -18, maxX: 18, minZ: 430, maxZ: 670, floorY: -20 },
            // Hub Descent — passages behind pillars + antechamber
            { id: 'hub-descent-left-passage', minX: -15, maxX: -9, minZ: -40, maxZ: -25, floorY: 0 },
            { id: 'hub-descent-right-passage', minX: 9, maxX: 15, minZ: -40, maxZ: -25, floorY: 0 },
            { id: 'hub-descent-antechamber', minX: -15, maxX: 15, minZ: -55, maxZ: -40, floorY: 0 },
        ];

        registerSurfaces('backstage-expansion', surfaces);
        console.log('Registered Backstage Expansion floors:', surfaces.length);

        return () => unregisterSurfaces('backstage-expansion');
    }, [SURFACE_VERSION]);
}



export default BackstageHalls;
