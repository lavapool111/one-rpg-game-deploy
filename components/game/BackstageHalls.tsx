'use client';

import { useMemo, useRef, useState, useEffect, useLayoutEffect, memo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '@/lib/store';
import { KeyPickup } from './KeyPickup';
import { Vault } from './Vault';
import { BackstageSpawner } from './BackstageSpawner';
import { InstrumentCase } from './InstrumentCase';
import { Stairs } from './Stairs';
import { Platform } from './Platform';
import { Pillar, WallTorch, Crate, Barrel, Arch, CulledPointLight } from './DungeonDecorations';
import AudioManager from '@/lib/audio/AudioManager';
import { Tuba } from './Tuba';
import { Trumpet } from './Trumpet';
import { Trombone } from './Trombone';
import { FrenchHorn } from './FrenchHorn';
import { PrisonCell } from './PrisonCell';

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
const HUB_WIDTH = 30;
const HUB_DEPTH = 50;
const WALL_HEIGHT = 15;
const TILE_SIZE = 4;
const CORRIDOR_WIDTH = 12; // 12 feet wide corridors (3 tiles)
const CORRIDOR_LENGTH = 100;

// Colors - warmer stone palette
const STONE_TILE_COLOR = '#6a6a6a';
const STONE_TILE_DARK = '#555555';
const CRACK_COLOR = '#252525';
const WALL_COLOR = '#5a5a5a';

export function BackstageHalls({
    quality = 'normal',
    children,
}: BackstageHallsProps) {
    useBackstageFloors();

    // Track component instance to distinguish remount from effect re-run
    const instanceId = useRef(Math.random().toString(36).substring(7));

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
        <group>
            {/* Balanced ambient light - neutral white */}
            <ambientLight intensity={0.7} color="#ffffff" />

            {/* Hemisphere light - warm top, cool bottom */}
            <hemisphereLight
                args={['#ffffee', '#554433', 0.5]}
                position={[0, 20, 0]}
            />

            {/* Warm point lights for torch glow */}
            <CulledPointLight position={[-12, 8, 0]} intensity={50} color="#ff9955" distance={60} decay={2} />
            <CulledPointLight position={[12, 8, 0]} intensity={50} color="#ff9955" distance={60} decay={2} />
            <CulledPointLight position={[0, 8, -15]} intensity={50} color="#ff9955" distance={60} decay={2} />
            <CulledPointLight position={[0, 8, 15]} intensity={50} color="#ff9955" distance={60} decay={2} />

            {/* Central Hub Room */}
            <HubRoom />

            {/* Exit door at back of hub */}
            <ExitDoor />

            {/* Three Branching Corridors */}
            <Corridor name="left" angle={-Math.PI / 2} />
            <Corridor name="center" angle={0} />
            <Corridor name="right" angle={Math.PI / 2} />

            {/* Test Key Spawns - 3 Resonance Keys in corridors */}
            <KeyPickup type="resonance" position={[-20, 1, 0]} />
            <KeyPickup type="resonance" position={[20, 1, 0]} />
            <KeyPickup type="resonance" position={[0, 1, 40]} />

            {/* Gold Vault at end of center corridor - rotated 180° to face player */}
            <Vault type="gold" position={[0, 0, 85]} goldAmount={150} rotation={Math.PI} />

            {/* Fog - not too dense */}
            <fog attach="fog" args={['#1a1a2a', 20, 120]} />

            {/* Enemy Spawner */}
            <BackstageSpawner />

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

            {children}
        </group>
    );
}

import { registerSurfaces, unregisterSurfaces } from '@/lib/game/stairCollision';

/**
 * Register floors for the new expansion
 */
function useBackstageFloors() {
    useEffect(() => {
        // Lower Hall: Z 141 to 241, Y -4, Width 10 (X -5 to 5)
        // Boss Room: Circular, Center (0, 266), Radius 25, Y -5.5.
        // Approx boss room as a square for floor registry: X -20 to 20, Z 241 to 291.

        const surfaces = [
            // Hub & Main Corridors (Level 0)
            { id: 'hub-floor', minX: -15, maxX: 15, minZ: -25, maxZ: 25, floorY: 0 },
            { id: 'center-corridor-floor', minX: -6, maxX: 6, minZ: 25, maxZ: 125, floorY: 0 },
            { id: 'left-corridor-floor', minX: -125, maxX: -25, minZ: -6, maxZ: 6, floorY: 0 },
            { id: 'right-corridor-floor', minX: 25, maxX: 125, minZ: -6, maxZ: 6, floorY: 0 },
            // Center Vault Room - main floor (ends at Z=183 to avoid margin overlap with stairwell)
            { id: 'center-room-floor', minX: -12.5, maxX: 12.5, minZ: 125, maxZ: 183, floorY: 0 },
            // Stairwell catch floor at very low Y - prevents detecting Y=0 floors
            // Wide enough to cover entire stairwell and room (X: -16 to 16 for 30ft room)
            // Extends from Z=185 to Z=222 to overlap with underground room start
            { id: 'stairwell-catch-floor', minX: -16, maxX: 16, minZ: 185, maxZ: 222, floorY: -100 },
            // Note: Stairs component (parkour-stairs) registers its own step surfaces
            // Underground Room (floor at Y=-20, 30x30 room spans Z=220-255)
            { id: 'underground-room-floor', minX: -15, maxX: 15, minZ: 220, maxZ: 255, floorY: -20 },
            // Left Room South Extension Corridor (elevated at Y=15)
            // Corridor is 14ft wide centered at world X=-148.5, extends Z=13 to Z=148
            { id: 'left-room-extension-floor', minX: -156, maxX: -141, minZ: 10, maxZ: 150, floorY: 15 },
            // Prison Cell Floors (elevated at Y=15, 8x8 ft each)
            // West cells (local Z=+11.5): X from -164 to -156
            // East cells (local Z=-11.5): X from -141 to -133
            // Cell Z positions: 47-55 and 67-75
            { id: 'prison-cell-west-1', minX: -164, maxX: -154, minZ: 47, maxZ: 55, floorY: 15 },
            { id: 'prison-cell-west-2', minX: -164, maxX: -154, minZ: 67, maxZ: 75, floorY: 15 },
            { id: 'prison-cell-east-1', minX: -143, maxX: -133, minZ: 47, maxZ: 55, floorY: 15 },
            { id: 'prison-cell-east-2', minX: -143, maxX: -133, minZ: 67, maxZ: 75, floorY: 15 },
        ];

        registerSurfaces('backstage-expansion', surfaces);
        console.log('Registered Backstage Expansion floors:', surfaces.length);

        return () => unregisterSurfaces('backstage-expansion');
    }, []);
}

/**
 * Hub Room
 */
const HubRoom = memo(function HubRoom() {
    return (
        <group>
            {/* Stone Tile Floor */}
            <StoneTileFloor width={HUB_WIDTH} depth={HUB_DEPTH} />

            {/* Walls */}
            {/* Left Wall (Split for door) */}
            <mesh position={[-HUB_WIDTH / 2 - 0.5, WALL_HEIGHT / 2, -15.5]}>
                <boxGeometry args={[1, WALL_HEIGHT, 19]} />
                <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
            </mesh>
            <mesh position={[-HUB_WIDTH / 2 - 0.5, WALL_HEIGHT / 2, 15.5]}>
                <boxGeometry args={[1, WALL_HEIGHT, 19]} />
                <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
            </mesh>

            {/* Right Wall (Split for door) */}
            <mesh position={[HUB_WIDTH / 2 + 0.5, WALL_HEIGHT / 2, -15.5]}>
                <boxGeometry args={[1, WALL_HEIGHT, 19]} />
                <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
            </mesh>
            <mesh position={[HUB_WIDTH / 2 + 0.5, WALL_HEIGHT / 2, 15.5]}>
                <boxGeometry args={[1, WALL_HEIGHT, 19]} />
                <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
            </mesh>

            {/* Back Wall */}
            <mesh position={[0, WALL_HEIGHT / 2, -HUB_DEPTH / 2 - 0.5]}>
                <boxGeometry args={[HUB_WIDTH, WALL_HEIGHT, 1]} />
                <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
            </mesh>

            {/* Front Wall - with opening for center corridor */}
            <mesh position={[-HUB_WIDTH / 2 + 5, WALL_HEIGHT / 2, HUB_DEPTH / 2 + 0.5]}>
                <boxGeometry args={[10, WALL_HEIGHT, 1]} />
                <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
            </mesh>
            <mesh position={[HUB_WIDTH / 2 - 5, WALL_HEIGHT / 2, HUB_DEPTH / 2 + 0.5]}>
                <boxGeometry args={[10, WALL_HEIGHT, 1]} />
                <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
            </mesh>

            {/* Ceiling */}
            <mesh position={[0, WALL_HEIGHT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[HUB_WIDTH, HUB_DEPTH]} />
                <meshStandardMaterial color="#555555" roughness={0.9} side={THREE.DoubleSide} />
            </mesh>

            {/* Torches on walls */}
            <TorchSconce position={[-HUB_WIDTH / 2 + 0.5, 10, -10]} />
            <TorchSconce position={[-HUB_WIDTH / 2 + 0.5, 10, 10]} />
            <TorchSconce position={[HUB_WIDTH / 2 - 0.5, 10, -10]} />
            <TorchSconce position={[HUB_WIDTH / 2 - 0.5, 10, 10]} />

            {/* Corner Pillars - positioned away from doors */}
            <Pillar position={[-12, 0, -20]} height={WALL_HEIGHT} radius={1.0} />
            <Pillar position={[12, 0, -20]} height={WALL_HEIGHT} radius={1.0} />

            {/* Arches at corridor entrances */}
            {/* Front (center corridor) */}
            <Arch position={[0, 0, HUB_DEPTH / 2]} rotation={0} width={CORRIDOR_WIDTH} height={WALL_HEIGHT} depth={1.5} />
            {/* Left corridor */}
            <Arch position={[-HUB_WIDTH / 2, 0, 0]} rotation={Math.PI / 2} width={CORRIDOR_WIDTH} height={WALL_HEIGHT} depth={1.5} />
            {/* Right corridor */}
            <Arch position={[HUB_WIDTH / 2, 0, 0]} rotation={Math.PI / 2} width={CORRIDOR_WIDTH} height={WALL_HEIGHT} depth={1.5} />

            {/* Bridge Floors (Fill gap to corridors) - Slightly offset Y to prevent Z-fighting */}
            <group position={[-20, 0.051, 0]}>
                <StoneTileFloor width={10} depth={12} />
            </group>
            <group position={[20, 0.051, 0]}>
                <StoneTileFloor width={10} depth={12} />
            </group>

            {/* Bridge Walls */}
            {/* Left Bridge Walls */}
            <mesh position={[-20, WALL_HEIGHT / 2, -6 - 0.5]}>
                <boxGeometry args={[10, WALL_HEIGHT, 1]} />
                <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
            </mesh>
            <mesh position={[-20, WALL_HEIGHT / 2, 6 + 0.5]}>
                <boxGeometry args={[10, WALL_HEIGHT, 1]} />
                <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
            </mesh>

            {/* Right Bridge Walls */}
            <mesh position={[20, WALL_HEIGHT / 2, -6 - 0.5]}>
                <boxGeometry args={[10, WALL_HEIGHT, 1]} />
                <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
            </mesh>
            <mesh position={[20, WALL_HEIGHT / 2, 6 + 0.5]}>
                <boxGeometry args={[10, WALL_HEIGHT, 1]} />
                <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
            </mesh>

            {/* Bridge Ceilings */}
            <mesh position={[-20, WALL_HEIGHT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[10, 12]} />
                <meshStandardMaterial color="#555555" roughness={0.9} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[20, WALL_HEIGHT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[10, 12]} />
                <meshStandardMaterial color="#555555" roughness={0.9} side={THREE.DoubleSide} />
            </mesh>

            {/* Bridge Lights */}
            <CulledPointLight position={[-20, 10, 0]} intensity={30} color="#ffaa66" distance={30} decay={2} />
            <CulledPointLight position={[20, 10, 0]} intensity={30} color="#ffaa66" distance={30} decay={2} />
        </group>
    );
});

/**
 * Stone Tile Floor - individual tiles with dark cracks between them
 */
/**
 * Stone Tile Floor - Optimized with InstancedMesh
 */
const StoneTileFloor = memo(function StoneTileFloor({ width, depth }: { width: number; depth: number }) {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const tilesX = Math.ceil(width / TILE_SIZE);
    const tilesZ = Math.ceil(depth / TILE_SIZE);
    const count = tilesX * tilesZ;

    // Pre-calculate random shades once to ensure stability
    const tileData = useMemo(() => {
        const data: { x: number; z: number; color: THREE.Color }[] = [];
        const baseColor = new THREE.Color(STONE_TILE_DARK);
        const highlightColor = new THREE.Color(STONE_TILE_COLOR);

        for (let ix = 0; ix < tilesX; ix++) {
            for (let iz = 0; iz < tilesZ; iz++) {
                const x = -width / 2 + ix * TILE_SIZE + TILE_SIZE / 2;
                const z = -depth / 2 + iz * TILE_SIZE + TILE_SIZE / 2;

                // Random shade mixing
                const shade = Math.random();
                const color = baseColor.clone().lerp(highlightColor, shade > 0.6 ? 1 : 0);
                // Add slight random variation to roughness simulation implies color variation too
                if (Math.random() > 0.8) color.offsetHSL(0, 0, 0.05);

                data.push({ x, z, color });
            }
        }
        return data;
    }, [width, depth, tilesX, tilesZ]);

    useLayoutEffect(() => {
        if (!meshRef.current) return;

        const dummy = new THREE.Object3D();

        tileData.forEach((tile, i) => {
            dummy.position.set(tile.x, 0.02, tile.z);
            dummy.rotation.set(-Math.PI / 2, 0, 0);
            dummy.updateMatrix();
            meshRef.current!.setMatrixAt(i, dummy.matrix);
            meshRef.current!.setColorAt(i, tile.color);
        });

        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    }, [tileData]);

    return (
        <group>
            {/* Dark base (shows as cracks between tiles) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
                <planeGeometry args={[width, depth]} />
                <meshStandardMaterial color={CRACK_COLOR} roughness={1} />
            </mesh>

            {/* Instanced Tiles */}
            <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
                <planeGeometry args={[TILE_SIZE - 0.3, TILE_SIZE - 0.3]} />
                <meshStandardMaterial roughness={0.9} />
            </instancedMesh>
        </group>
    );
});

/**
 * Corridor
 */
const Corridor = memo(function Corridor({ name, angle }: { name: string; angle: number }) {
    // Position corridor adjacent to hub (no gap)
    const offsetX = Math.sin(angle) * (HUB_DEPTH / 2 + CORRIDOR_LENGTH / 2);
    const offsetZ = Math.cos(angle) * (HUB_DEPTH / 2 + CORRIDOR_LENGTH / 2);

    return (
        <group position={[offsetX, 0, offsetZ]} rotation={[0, angle, 0]}>
            {/* Floor - raised slightly to be above hub floor and prevent z-fighting */}
            <group position={[0, 0.05, 0]}>
                <StoneTileFloor width={CORRIDOR_WIDTH} depth={CORRIDOR_LENGTH} />
            </group>

            {/* Left Wall */}
            <mesh position={[-CORRIDOR_WIDTH / 2 - 0.5, WALL_HEIGHT / 2, 0]}>
                <boxGeometry args={[1, WALL_HEIGHT, CORRIDOR_LENGTH]} />
                <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
            </mesh>

            {/* Right Wall */}
            <mesh position={[CORRIDOR_WIDTH / 2 + 0.5, WALL_HEIGHT / 2, 0]}>
                <boxGeometry args={[1, WALL_HEIGHT, CORRIDOR_LENGTH]} />
                <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
            </mesh>

            {/* Ceiling - shortened to prevent z-fighting with room front walls */}
            <mesh position={[0, WALL_HEIGHT, -1]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[CORRIDOR_WIDTH, CORRIDOR_LENGTH - 2]} />
                <meshStandardMaterial color="#555555" roughness={0.9} side={THREE.DoubleSide} />
            </mesh>

            {/* Corridor point light */}
            <CulledPointLight position={[0, 10, 0]} intensity={25} color="#ff8844" distance={60} decay={2} />

            {/* Wall Torches along corridor */}
            <WallTorch position={[-CORRIDOR_WIDTH / 2 + 0.3, 8, -30]} rotation={Math.PI / 2} lightIntensity={12} />
            <WallTorch position={[CORRIDOR_WIDTH / 2 - 0.3, 8, -30]} rotation={-Math.PI / 2} lightIntensity={12} />
            <WallTorch position={[-CORRIDOR_WIDTH / 2 + 0.3, 8, 30]} rotation={Math.PI / 2} lightIntensity={12} />
            <WallTorch position={[CORRIDOR_WIDTH / 2 - 0.3, 8, 30]} rotation={-Math.PI / 2} lightIntensity={12} />

            {/* Decorative pillars at midpoint */}
            <>
                <Pillar position={[-CORRIDOR_WIDTH / 2 + 1.5, 0, 0]} height={WALL_HEIGHT} radius={0.8} />
                <Pillar position={[CORRIDOR_WIDTH / 2 - 1.5, 0, 0]} height={WALL_HEIGHT} radius={0.8} />
            </>

            {/* End Cap Logic: Wall or Room */}
            {name === 'left' ? (
                /* Left Room expansion - LARGER with 75ft ceiling for vertical expansion */
                /* 
                   Room Position:
                   - Corridor extends West (X: -25 to -125).
                   - Room is at West end.
                   - Rel to Corridor Hub (-75), we need Z_local = +67.5 (Distance to West).
                   - Room geometry: -Z is East (Front), +Z is West (Back). No Rotation needed.
                */
                <group position={[0, 0, CORRIDOR_LENGTH / 2 + 17.5]}>
                    {/* Room Floor (25x35) - Bigger floor */}
                    <group position={[0, 0.05, 0]}>
                        <StoneTileFloor width={25} depth={35} />
                    </group>

                    {/* Room Walls - 75ft tall */}
                    {/* Back Wall (West) */}
                    <mesh position={[0, 75 / 2, 17.5 + 0.5]}>
                        <boxGeometry args={[25, 75, 1]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>
                    {/* Left Wall (South) - Split for corridor opening */}
                    {/* 
                       Room depth: 35ft, Z: -17.5 to +17.5
                       Doorway opening: 14ft wide (Z: -1 to +13), 20ft tall (Y: 15 to 35)
                       Section 1 (East/Front): Z -17.5 to -1 = 16.5ft
                       Section 2 (West/Back): Z +13 to +17.5 = 4.5ft
                    */}
                    {/* Section 1: Front (East) side - full height */}
                    <mesh position={[13, 75 / 2, -9.25]}>
                        <boxGeometry args={[1, 75, 16.5]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>
                    {/* Section 2: Back (West) side - full height */}
                    <mesh position={[13, 75 / 2, 15.25]}>
                        <boxGeometry args={[1, 75, 4.5]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>
                    {/* Floor piece below doorway (Y: 0 to 15) */}
                    <mesh position={[13, 7.5, 6]}>
                        <boxGeometry args={[1, 15, 14]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>
                    {/* Lintel above doorway (Y: 35 to 75) */}
                    <mesh position={[13, 55, 6]}>
                        <boxGeometry args={[1, 40, 14]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>
                    {/* Right Wall (North) - Full wall */}
                    <mesh position={[-13, 75 / 2, 0]}>
                        <boxGeometry args={[1, 75, 35]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>

                    {/* ========== SOUTH EXTENSION CORRIDOR (World +Z) ========== */}
                    {/* 
                       Corridor going South (world +Z) from the Left Room.
                       In local coords: goes in local +X direction.
                       Elevated to Y=15.
                       Doorway at local X=13, corridor extends from X=13 to X=148 (135ft long).
                       Centered at X=(13+148)/2 = 80.5, but we position at X=13 and extend +X.
                    */}
                    <group position={[13, 15, 6]}>
                        {/* Extension Corridor Floor - extends from here to +X */}
                        <group position={[67.5, 0.05, 0]}>
                            <StoneTileFloor width={135} depth={14} />
                        </group>

                        {/* Left Wall (West side of corridor) - Split for prison cell openings */}
                        {/* Section 1: X=0 to X=31 */}
                        <mesh position={[15.5, WALL_HEIGHT / 2, 7 + 0.5]}>
                            <boxGeometry args={[31, WALL_HEIGHT, 1]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>
                        {/* Section 2: X=39 to X=51 */}
                        <mesh position={[45, WALL_HEIGHT / 2, 7 + 0.5]}>
                            <boxGeometry args={[12, WALL_HEIGHT, 1]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>
                        {/* Section 3: X=59 to X=135 */}
                        <mesh position={[97, WALL_HEIGHT / 2, 7 + 0.5]}>
                            <boxGeometry args={[76, WALL_HEIGHT, 1]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>

                        {/* Right Wall (East side of corridor) - Split for prison cell openings */}
                        {/* Section 1: X=0 to X=31 */}
                        <mesh position={[15.5, WALL_HEIGHT / 2, -7 - 0.5]}>
                            <boxGeometry args={[31, WALL_HEIGHT, 1]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>
                        {/* Section 2: X=39 to X=51 */}
                        <mesh position={[45, WALL_HEIGHT / 2, -7 - 0.5]}>
                            <boxGeometry args={[12, WALL_HEIGHT, 1]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>
                        {/* Section 3: X=59 to X=135 */}
                        <mesh position={[97, WALL_HEIGHT / 2, -7 - 0.5]}>
                            <boxGeometry args={[76, WALL_HEIGHT, 1]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>

                        {/* End Wall (South end - furthest from room) */}
                        <mesh position={[135 + 0.5, WALL_HEIGHT / 2, 0]}>
                            <boxGeometry args={[1, WALL_HEIGHT, 14]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>

                        {/* Ceiling */}
                        <mesh position={[67.5, WALL_HEIGHT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                            <planeGeometry args={[135, 14]} />
                            <meshStandardMaterial color="#555555" roughness={0.9} side={THREE.DoubleSide} />
                        </mesh>

                        {/* Corridor Lights - reduced for performance */}
                        <CulledPointLight position={[45, 12, 0]} intensity={35} color="#ff8844" distance={70} decay={2} />
                        <CulledPointLight position={[100, 12, 0]} intensity={35} color="#ff8844" distance={70} decay={2} />

                        {/* Wall Torches */}
                        <WallTorch position={[20, 8, -6.5]} rotation={0} lightIntensity={10} />
                        <WallTorch position={[50, 8, 6.5]} rotation={Math.PI} lightIntensity={10} />
                        <WallTorch position={[80, 8, -6.5]} rotation={0} lightIntensity={10} />
                        <WallTorch position={[110, 8, 6.5]} rotation={Math.PI} lightIntensity={10} />

                        {/* Pillars removed for prison cell area */}

                        {/* ========== PRISON CELLS ========== */}
                        {/* 4 prison cells with level 15 Tubas - 2 on each side of the corridor */}
                        {/* Cells are 8x8ft, centered at Z=±11.5 so they jut out from walls at Z=±7.5 */}
                        {/* Left side cells (West wall Z+, bars face corridor at Z-) */}
                        <PrisonCell
                            id="prison-cell-left-1"
                            position={[35, 0, 11.5]}
                            openSide="front"
                        />
                        <PrisonCell
                            id="prison-cell-left-2"
                            position={[55, 0, 11.5]}
                            openSide="front"
                        />
                        {/* Right side cells (East wall Z-, bars face corridor at Z+) */}
                        <PrisonCell
                            id="prison-cell-right-1"
                            position={[35, 0, -11.5]}
                            openSide="back"
                        />
                        <PrisonCell
                            id="prison-cell-right-2"
                            position={[55, 0, -11.5]}
                            openSide="back"
                        />

                        {/* Instrument Cases - scattered along the corridor */}
                        <InstrumentCase id="left-ext-case-1" position={[15, 0.5, 5]} type="Trumpet" level={1} />
                        <InstrumentCase id="left-ext-case-2" position={[40, 0.5, -5]} type="Trumpet" level={1} />
                        <InstrumentCase id="left-ext-case-3" position={[65, 0.5, 5]} type="Trombone" level={1} />
                        <InstrumentCase id="left-ext-case-4" position={[90, 0.5, -5]} type="Trumpet" level={1} />
                        <InstrumentCase id="left-ext-case-5" position={[115, 0.5, 5]} type="Trumpet" level={1} />
                    </group>
                    {/* Front Wall Pieces (East - Entrance) */}
                    <mesh position={[-9.25, 75 / 2, -17.5 - 0.5]}>
                        <boxGeometry args={[6.5, 75, 1]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>
                    <mesh position={[9.25, 75 / 2, -17.5 - 0.5]}>
                        <boxGeometry args={[6.5, 75, 1]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>

                    {/* Ceiling - 75ft high */}
                    <mesh position={[0, 75, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                        <planeGeometry args={[25, 35]} />
                        <meshStandardMaterial color="#555555" roughness={0.9} side={THREE.DoubleSide} />
                    </mesh>

                    {/* Room Lights */}
                    <CulledPointLight position={[0, 20, 10]} intensity={60} color="#ffaa66" distance={50} decay={2} />
                    <CulledPointLight position={[0, 20, -10]} intensity={40} color="#ffaa66" distance={40} decay={2} />

                    {/* 100g Vault */}
                    <Vault type="gold" position={[0, 0, 12]} rotation={Math.PI} goldAmount={100} />

                    {/* ========== STAIRS TO SECOND LEVEL ========== */}
                    {/* 
                       Stairs on South Wall (Left), marching West.
                       Pos: x=11 (South wall), z=-15 (East side/Entrance).
                       Rot: 0 (March +Z / West).
                    */}
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
                    {/* 
                       Platform at West end (Back), South side.
                       Pos: x=8 (Left/South), z=10 (Back/West).
                    */}
                    <group position={[8, 12, 10]}>
                        <Platform
                            id="left-room-platform"
                            position={[0, 0, 0]}
                            width={10}
                            depth={12}
                            height={1}
                            color={STONE_TILE_COLOR}
                            roughness={0.9}
                        />

                        {/* Platform Railing */}
                        <mesh position={[-5, 1.5, 0]}>
                            <boxGeometry args={[0.3, 3, 12]} />
                            <meshStandardMaterial color="#888888" roughness={0.8} />
                        </mesh>

                        {/* Instrument Cases reward */}
                        <InstrumentCase id="left-upper-case-1" position={[0, 0.3, 2]} type="Euphonium" level={1} />
                        <InstrumentCase id="left-upper-case-2" position={[2, 0.3, -2]} type="Horn" level={1} />
                    </group>
                </group>
            ) : name === 'right' ? (
                /* Right Room expansion */
                <group position={[0, 0, CORRIDOR_LENGTH / 2 + 12.5]}>
                    {/* Room Floor (15x25) */}
                    <group position={[0, 0.05, 0]}>
                        <StoneTileFloor width={15} depth={25} />
                    </group>

                    {/* Room Walls */}
                    {/* Back Wall */}
                    <mesh position={[0, WALL_HEIGHT / 2, 12.5 + 0.5]}>
                        <boxGeometry args={[15, WALL_HEIGHT, 1]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>
                    {/* Left Wall */}
                    <mesh position={[-7.5 - 0.5, WALL_HEIGHT / 2, 0]}>
                        <boxGeometry args={[1, WALL_HEIGHT, 25]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>
                    {/* Right Wall */}
                    <mesh position={[7.5 + 0.5, WALL_HEIGHT / 2, 0]}>
                        <boxGeometry args={[1, WALL_HEIGHT, 25]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>
                    {/* Front Wall Pieces */}
                    <mesh position={[-6.75, WALL_HEIGHT / 2, -12.5 - 0.5]}>
                        <boxGeometry args={[1.5, WALL_HEIGHT, 1]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>
                    <mesh position={[6.75, WALL_HEIGHT / 2, -12.5 - 0.5]}>
                        <boxGeometry args={[1.5, WALL_HEIGHT, 1]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>

                    {/* Ceiling */}
                    <mesh position={[0, WALL_HEIGHT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                        <planeGeometry args={[15, 25]} />
                        <meshStandardMaterial color="#555555" roughness={0.9} side={THREE.DoubleSide} />
                    </mesh>

                    {/* Room Light */}
                    <CulledPointLight position={[0, 10, 10]} intensity={40} color="#ffaa66" distance={40} decay={2} />

                    {/* 200g Vault */}
                    <Vault type="gold" position={[0, 0, 10]} rotation={Math.PI} goldAmount={200} />

                    {/* Instrument Cases in corners */}
                    <InstrumentCase id="right-room-case-2" position={[5, 0.5, -8]} type="Trombone" level={1} />
                </group>
            ) : (
                /* Center Room - End of center corridor (25x60x25) */
                <group position={[0, 0, CORRIDOR_LENGTH / 2 + 30]}>
                    {/* Room Floor (25x60) */}
                    <group position={[0, 0.05, 0]}>
                        <StoneTileFloor width={25} depth={60} />
                    </group>

                    {/* Room Walls - Height 25 */}
                    {/* Back Wall - Split to leave opening for parkour behind vault */}
                    <mesh position={[-9.25, 25 / 2, 30 + 0.5]}>
                        <boxGeometry args={[6.5, 25, 1]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>
                    <mesh position={[9.25, 25 / 2, 30 + 0.5]}>
                        <boxGeometry args={[6.5, 25, 1]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>
                    {/* Wall above back opening */}
                    <mesh position={[0, 20, 30 + 0.5]}>
                        <boxGeometry args={[12, 10, 1]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>
                    {/* Left Wall */}
                    <mesh position={[-12.5 - 0.5, 25 / 2, 0]}>
                        <boxGeometry args={[1, 25, 60]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>
                    {/* Right Wall */}
                    <mesh position={[12.5 + 0.5, 25 / 2, 0]}>
                        <boxGeometry args={[1, 25, 60]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>
                    {/* Front Wall Pieces (leave 12ft opening for corridor) */}
                    <mesh position={[-9.25, 25 / 2, -30 - 0.5]}>
                        <boxGeometry args={[6.5, 25, 1]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>
                    <mesh position={[9.25, 25 / 2, -30 - 0.5]}>
                        <boxGeometry args={[6.5, 25, 1]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>
                    {/* Wall above doorway (fills gap between corridor ceiling 15ft and room ceiling 25ft) */}
                    <mesh position={[0, 20, -30 - 0.5]}>
                        <boxGeometry args={[12, 10, 1]} />
                        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                    </mesh>

                    {/* Ceiling - shortened to stop before stairwell opening (prevents z-fighting) */}
                    <mesh position={[0, 25, -2.5]} rotation={[-Math.PI / 2, 0, 0]}>
                        <planeGeometry args={[25, 55]} />
                        <meshStandardMaterial color="#555555" roughness={0.9} side={THREE.DoubleSide} />
                    </mesh>

                    {/* Ceiling pieces around stairwell opening (Z=25 to Z=30 gap) */}
                    {/* These fill the gap between the main ceiling (ending at Z=25) and the stairwell area (Z=30) */}
                    {/* Left ceiling piece: X from -12.5 to -5 (7.5ft wide), Z from 25 to 30 (5ft deep) */}
                    <mesh position={[-8.75, 25, 27.5]} rotation={[-Math.PI / 2, 0, 0]}>
                        <planeGeometry args={[7.5, 5]} />
                        <meshStandardMaterial color="#555555" roughness={0.9} side={THREE.DoubleSide} />
                    </mesh>
                    {/* Right ceiling piece: X from 5 to 12.5 (7.5ft wide), Z from 25 to 30 (5ft deep) */}
                    <mesh position={[8.75, 25, 27.5]} rotation={[-Math.PI / 2, 0, 0]}>
                        <planeGeometry args={[7.5, 5]} />
                        <meshStandardMaterial color="#555555" roughness={0.9} side={THREE.DoubleSide} />
                    </mesh>

                    {/* Middle ceiling piece to fill gap before stairs: X from -5 to 5, Z from 25 to 30 */}
                    <mesh position={[0, 25, 27.5]} rotation={[-Math.PI / 2, 0, 0]}>
                        <planeGeometry args={[10, 5]} />
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

                    {/* ========== BROKEN STAIR PARKOUR SECTION ========== */}
                    {/* Opening in floor behind vault - descending stairs with missing steps */}
                    <group position={[0, 0, 30]}>
                        {/* Descending Stairs - 20 steps going down, with gaps */}
                        {/* Steps: 6ft wide, 2ft deep, 1ft high each */}
                        {/* Skip pattern: 2 missing, 1 present (harder parkour challenge) */}
                        {/* Present steps: 0, 3, 6, 9, 12, 15, 18 */}
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

                        {/* Stairwell walls - create a fully enclosed shaft around the stairs */}
                        {/* Stairs span Z=0 to Z=40 (20 steps * 2ft), descending from Y=0 to Y=-20 */}

                        {/* Left shaft wall - full height from underground room to vault ceiling */}
                        {/* Spans Y=-20 to Y=25 (45ft tall), Z from -1 to 40 (41ft long) */}
                        <mesh position={[-5, 2.5, 19.5]}>
                            <boxGeometry args={[1, 45, 41]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>

                        {/* Right shaft wall */}
                        <mesh position={[5, 2.5, 19.5]}>
                            <boxGeometry args={[1, 45, 41]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>

                        {/* Back wall of shaft - separates stairwell from underground room at bottom */}
                        {/* Only covers the top portion (Y=-8 to Y=25), underground room entrance is below Y=-8 */}
                        <mesh position={[0, 8.5, 40.5]}>
                            <boxGeometry args={[10, 33, 1]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>

                        {/* Shaft ceiling - covers the entire stairwell */}
                        {/* At Y=25, starts at local Z=-1 (center room ceiling now stops before this) */}
                        <mesh position={[0, 25, 20]} rotation={[-Math.PI / 2, 0, 0]}>
                            <planeGeometry args={[10, 42]} />
                            <meshStandardMaterial color="#555555" roughness={0.9} side={THREE.DoubleSide} />
                        </mesh>

                        {/* Dim lighting along the stairwell */}
                        <CulledPointLight position={[0, -5, 10]} intensity={20} color="#ff6644" distance={30} decay={2} />
                        <CulledPointLight position={[0, -15, 30]} intensity={25} color="#ff6644" distance={25} decay={2} />
                    </group>

                    {/* ========== UNDERGROUND ROOM ========== */}
                    {/* 
                        Room at bottom of stairs:
                        - Floor at Y = -20 (20ft below vault room)
                        - Stairs end at world Z = 225 (20 steps * 2ft = 40ft from Z=185)
                        - Room: 20ft x 20ft, positioned so front edge is at Z=225
                        - Room center at world Z = 155 + 30 + 40 + 10 = 235
                        - Local position relative to center room: [0, -20, 80]
                    */}
                    <group position={[0, -20, 80]}>
                        {/* Floor - 30x30 at Y=0 (which is world Y=-20) */}
                        <mesh position={[0, 0, 5]} rotation={[-Math.PI / 2, 0, 0]}>
                            <planeGeometry args={[30, 30]} />
                            <meshStandardMaterial color="#665544" roughness={0.85} />
                        </mesh>

                        {/* Ceiling - 14ft high (to accommodate vault height of 12.5ft + frame) */}
                        <mesh position={[0, 14, 5]} rotation={[-Math.PI / 2, 0, 0]}>
                            <planeGeometry args={[30, 30]} />
                            <meshStandardMaterial color="#444444" roughness={0.9} side={THREE.DoubleSide} />
                        </mesh>

                        {/* Back Wall (far end) - 14ft tall */}
                        <mesh position={[0, 7, 20.5]}>
                            <boxGeometry args={[30, 14, 1]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>

                        {/* Left Wall - 14ft tall */}
                        <mesh position={[-15.5, 7, 5]}>
                            <boxGeometry args={[1, 14, 30]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>

                        {/* Right Wall - 14ft tall */}
                        <mesh position={[15.5, 7, 5]}>
                            <boxGeometry args={[1, 14, 30]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>

                        {/* Front Wall Pieces - fill gaps between stairwell (10ft wide) and room (30ft wide) */}
                        {/* Left front wall piece: X from -15 to -5, 14ft tall */}
                        <mesh position={[-10, 7, -10.5]}>
                            <boxGeometry args={[10, 14, 1]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>
                        {/* Right front wall piece: X from 5 to 15, 14ft tall */}
                        <mesh position={[10, 7, -10.5]}>
                            <boxGeometry args={[10, 14, 1]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>

                        {/* 250g Gold Vault at back of underground room */}
                        <Vault type="gold" position={[0, 0, 15]} rotation={Math.PI} goldAmount={250} />

                        {/* Room Light - raised to match new ceiling */}
                        <CulledPointLight position={[0, 12, 5]} intensity={80} color="#ffaa66" distance={45} decay={2} />
                    </group>
                </group>
            )}
        </group>
    );
});

/**
 * Torch Sconce with emissive glow
 */
function TorchSconce({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
            {/* Bracket */}
            <mesh>
                <boxGeometry args={[0.4, 0.6, 0.3]} />
                <meshStandardMaterial color="#443322" roughness={0.8} />
            </mesh>

            {/* Flame */}
            <mesh position={[0, 0.5, 0.2]}>
                <sphereGeometry args={[0.25, 8, 8]} />
                <meshStandardMaterial
                    color="#ff6600"
                    emissive="#ff4400"
                    emissiveIntensity={4}
                />
            </mesh>
        </group>
    );
}

/**
 * Exit Door - at back of hub, allows escape with gold
 */
function ExitDoor() {
    const meshRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);
    const [showPrompt, setShowPrompt] = useState(false);
    const { camera } = useThree();
    const escapeDungeon = useGameStore((state) => state.escapeDungeon);

    const doorPosition: [number, number, number] = [0, 0, -HUB_DEPTH / 2 + 1];

    // Reuse vector to avoid GC
    const doorPosVec = useRef(new THREE.Vector3(...doorPosition));

    // Throttled distance check - only update prompt every 10 frames
    const frameCount = useRef(0);
    useFrame(() => {
        frameCount.current++;
        if (frameCount.current % 10 !== 0) return;

        const distance = camera.position.distanceTo(doorPosVec.current);
        const isNear = distance < 15;

        if (isNear !== showPrompt) {
            setShowPrompt(isNear);
        }
    });

    const handleClick = () => {
        if (showPrompt) {
            escapeDungeon();
        }
    };

    return (
        <group position={doorPosition}>
            {/* Door frame */}
            <mesh position={[-3.5, 5, 0]}>
                <boxGeometry args={[1, 10, 2]} />
                <meshStandardMaterial color="#4a3728" roughness={0.8} />
            </mesh>
            <mesh position={[3.5, 5, 0]}>
                <boxGeometry args={[1, 10, 2]} />
                <meshStandardMaterial color="#4a3728" roughness={0.8} />
            </mesh>
            <mesh position={[0, 10.5, 0]}>
                <boxGeometry args={[8, 1, 2]} />
                <meshStandardMaterial color="#4a3728" roughness={0.8} />
            </mesh>

            {/* Main door - use pointer events instead of per-frame raycasting */}
            <mesh
                ref={meshRef}
                position={[0, 5, 0]}
                onClick={handleClick}
                onPointerEnter={() => setHovered(true)}
                onPointerLeave={() => setHovered(false)}
            >
                <boxGeometry args={[6, 10, 0.5]} />
                <meshStandardMaterial
                    color={hovered ? '#228B22' : '#2e5c2e'}
                    roughness={0.7}
                    emissive={hovered ? '#103010' : '#000000'}
                    emissiveIntensity={hovered ? 0.3 : 0}
                />
            </mesh>

            {/* Door handle */}
            <mesh position={[2, 5, 0.4]}>
                <sphereGeometry args={[0.3, 8, 8]} />
                <meshStandardMaterial color="#DAA520" roughness={0.3} metalness={0.8} />
            </mesh>

            {/* Exit glow (green for escape) */}
            <mesh position={[0, 5, 0.3]}>
                <ringGeometry args={[2.8, 3.2, 32]} />
                <meshBasicMaterial
                    color="#22dd55"
                    transparent
                    opacity={showPrompt ? 0.4 : 0.1}
                />
            </mesh>

            {/* Point light for glow - use CulledPointLight */}
            <CulledPointLight
                position={[0, 5, 1]}
                intensity={showPrompt ? 20 : 5}
                color="#22dd55"
                distance={10}
                decay={2}
                cullDistance={30}
            />
        </group>
    );
}

export default BackstageHalls;

