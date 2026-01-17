'use client';

import { useRef, useMemo, createContext, useContext, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import AudioManager from '@/lib/audio/AudioManager';
import { usePlayerStore } from '@/lib/store'; // Import player store for position tracking
import {
    DoubleSide,
    Mesh,
    Group,
    SpotLight as ThreeSpotLight,
    BackSide,
    Shape,
    Path,
    ExtrudeGeometry,
} from 'three';
import { generatePillars, type Pillar, type PillarConfig } from '@/lib/game/pillars';

/**
 * BandRoom Component
 * Main hub arena - a large circular orchestral hall
 * 
 * Features:
 * - 500m diameter circular arena
 * - Polished hardwood floor
 * - Warm bronze cylindrical walls
 * - Domed ceiling with spotlights
 * - Decorative pillars with collision
 */

// Context to share pillar data with other components
const PillarContext = createContext<PillarConfig | null>(null);

export function usePillars() {
    return useContext(PillarContext);
}

interface BandRoomProps {
    /** Arena radius in meters (default: 250 for 500m diameter) */
    radius?: number;
    /** Wall height in meters */
    wallHeight?: number;
    /** Enable animated spotlights */
    animatedLights?: boolean;
    /** Children components that need pillar data */
    children?: React.ReactNode;
}

// Spotlight configuration
const SPOTLIGHT_COUNT = 8;
const SPOTLIGHT_INTENSITY = 800;
const SPOTLIGHT_ANGLE = Math.PI / 6;
const SPOTLIGHT_COLOR = '#fff5e6';

// Room dimensions
const DEFAULT_RADIUS = 375;
const DEFAULT_WALL_HEIGHT = 50;

export function BandRoom({
    radius = DEFAULT_RADIUS,
    wallHeight = DEFAULT_WALL_HEIGHT,
    animatedLights = true,
    children,
}: BandRoomProps) {
    const spotlightRefs = useRef<ThreeSpotLight[]>([]);

    // Audio: Background Ambience
    useEffect(() => {
        // Load and play the ambient music
        const soundKey = 'bg-ambience';
        const sfxPath = '/audio/ambient-music.m4a';

        AudioManager.load(soundKey, sfxPath, {
            loop: true,
            volume: 0.30 // 15% volume as requested
        });

        const id = AudioManager.play(soundKey, 'music', {
            loop: true,
            volume: 0.30
        });

        // Cleanup on unmount
        return () => {
            if (id) AudioManager.stop(soundKey, id);
        };
    }, []);

    // Generate pillar configuration
    const pillarConfig = useMemo(() => generatePillars(radius), [radius]);

    // Generate spotlight positions in a circle
    const spotlightPositions = useMemo(() => {
        const positions: [number, number, number][] = [];
        for (let i = 0; i < SPOTLIGHT_COUNT; i++) {
            const angle = (i / SPOTLIGHT_COUNT) * Math.PI * 2;
            const spotRadius = radius * 0.6;
            positions.push([
                Math.cos(angle) * spotRadius,
                wallHeight - 5,
                Math.sin(angle) * spotRadius,
            ]);
        }
        return positions;
    }, [radius, wallHeight]);

    // Animate spotlights
    useFrame((state) => {
        if (!animatedLights && spotlightRefs.current.length === 0) return;

        // Check if player is in the main arena (culling optimization)
        // Increased threshold to keep lights on while in corridors (until deep in dungeon)
        const playerPos = usePlayerStore.getState().position;
        const distFromCenter = Math.sqrt(playerPos[0] * playerPos[0] + playerPos[2] * playerPos[2]);
        const isInArena = distFromCenter < radius + 150; // Visible even from mid-tunnel

        spotlightRefs.current.forEach((spotlight, i) => {
            if (!spotlight) return;

            // Visibility culling
            spotlight.visible = isInArena;
            if (!isInArena) return;

            // Movement logic
            const time = state.clock.elapsedTime;
            const offset = (i / SPOTLIGHT_COUNT) * Math.PI * 2;

            // Lissajous figure movement for organic feel
            spotlight.target.position.x = Math.sin(time * 0.5 + offset) * (radius * 0.4);
            spotlight.target.position.z = Math.cos(time * 0.3 + offset) * (radius * 0.4);
            spotlight.target.updateMatrixWorld();
        });
    });

    return (
        <PillarContext.Provider value={pillarConfig}>
            <group>
                {/* Ambient lighting for base illumination */}
                <ambientLight intensity={0.15} color="#ffd9b3" />

                {/* Main warm overhead light */}
                <pointLight
                    position={[0, wallHeight - 10, 0]}
                    intensity={500}
                    color="#fff0d9"
                    distance={radius * 2}
                    decay={2}
                />

                {/* Floor - Polished Hardwood */}
                <HardwoodFloor radius={radius} />

                {/* Walls - Bronze Cylindrical */}
                <BronzeWalls radius={radius} height={wallHeight} />

                {/* Pillars */}
                <Pillars pillars={pillarConfig.pillars} />

                {/* Ceiling - Domed with structural elements */}
                <DomeCeiling radius={radius} height={wallHeight} />

                {/* Spotlights */}
                {spotlightPositions.map((position, i) => (
                    <SpotlightComponent
                        key={i}
                        position={position}
                        target={[position[0] * 0.3, 0, position[2] * 0.3]}
                        ref={(el: ThreeSpotLight | null) => {
                            if (el) spotlightRefs.current[i] = el;
                        }}
                    />
                ))}

                {/* Center stage marker */}
                <CenterStage />

                {/* Branching paths - 4 corridors extending from the arena */}
                <BranchingPaths arenaRadius={radius} wallHeight={wallHeight} />

                {/* Pass children with access to pillar context */}
                {children}
            </group>
        </PillarContext.Provider>
    );
}

/**
 * Pillars Component
 * Renders decorative pillars that act as obstacles
 */
function Pillars({ pillars }: { pillars: Pillar[] }) {
    return (
        <group>
            {pillars.map((pillar) => (
                <PillarMesh key={pillar.id} pillar={pillar} />
            ))}
        </group>
    );
}

/**
 * Individual Pillar Mesh - Simplified for performance
 * Single shaft with base and capital (no fluting or per-pillar lights)
 */
function PillarMesh({ pillar }: { pillar: Pillar }) {
    const { x, z, radius, height } = pillar;

    // Simplified proportions
    const baseHeight = height * 0.08;
    const capitalHeight = height * 0.1;
    const shaftHeight = height - baseHeight - capitalHeight;

    return (
        <group position={[x, 0, z]}>
            {/* Base */}
            <mesh position={[0, baseHeight / 2, 0]}>
                <cylinderGeometry args={[radius * 1.3, radius * 1.5, baseHeight, 12]} />
                <meshStandardMaterial color="#8B7355" roughness={0.5} metalness={0.3} />
            </mesh>

            {/* Main shaft */}
            <mesh position={[0, baseHeight + shaftHeight / 2, 0]}>
                <cylinderGeometry args={[radius * 0.9, radius, shaftHeight, 12]} />
                <meshStandardMaterial color="#CD853F" roughness={0.35} metalness={0.25} />
            </mesh>

            {/* Capital */}
            <mesh position={[0, baseHeight + shaftHeight + capitalHeight / 2, 0]}>
                <cylinderGeometry args={[radius * 1.4, radius * 0.9, capitalHeight, 12]} />
                <meshStandardMaterial color="#DAA520" roughness={0.3} metalness={0.5} />
            </mesh>
        </group>
    );
}

/**
 * Hardwood Floor Component
 * Procedural wood-like appearance using gradients
 */
function HardwoodFloor({ radius }: { radius: number }) {
    const meshRef = useRef<Mesh>(null);

    // Single floor mesh with simplified geometry
    return (
        <mesh
            ref={meshRef}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 0]}
            receiveShadow
        >
            <circleGeometry args={[radius, 32]} />
            <meshStandardMaterial
                color="#8B4513"
                roughness={0.3}
                metalness={0.1}
            />
        </mesh>
    );
}

/**
 * Bronze Cylindrical Walls - simple full cylinder
 * Corridor geometry overlaps and hides the wall sections/**
 * Spandrel for corridor entrance (Wall with arch cutout)
 * Fills the gap between the corridor arch and the rectangular wall opening
 */
function EntranceSpandrel({ width, height, archRadius }: { width: number, height: number, archRadius: number }) {
    const shape = useMemo(() => {
        const s = new Shape();
        // Rectangle fitting the opening
        s.moveTo(-width / 2, 0);
        s.lineTo(width / 2, 0);
        s.lineTo(width / 2, height);
        s.lineTo(-width / 2, height);
        s.lineTo(-width / 2, 0);

        // Arch cutout (semicircle)
        const hole = new Path();
        // absarc(x, y, radius, startAngle, endAngle, clockwise)
        // We want a hole, so winding might matter, but usually three.js handles simple holes well
        hole.absarc(0, 0, archRadius, 0, Math.PI, false);
        s.holes.push(hole);

        return s;
    }, [width, height, archRadius]);

    return (
        <mesh position={[0, 12.5, 0]}> {/* Position at spring line height */}
            <extrudeGeometry args={[shape, { depth: 2, bevelEnabled: false }]} />
            <meshStandardMaterial
                color="#CD7F32"
                roughness={0.4}
                metalness={0.6}
            />
        </mesh>
    );
}

/**
 * Bronze Walls with corridor openings
 * Renders 4 wall segments with gaps for the corridors
 */
function BronzeWalls({ radius, height }: { radius: number; height: number }) {
    // Corridor opening width in radians (slightly narrower than 10m corridor to handle overlap)
    // Corridor is 10m wide. We make opening 9.5m to ensure walls clip into main wall.
    const openingWidth = 9.5;
    const openingAngle = openingWidth / radius;

    // Create 4 wall segments centered between the cardinal directions
    // Corridors are at 0, 90, 180, 270 degrees
    const mainSegments = [0, 1, 2, 3].map(i => {
        // Start after current corridor
        const startAngle = (i * Math.PI / 2) + openingAngle / 2;
        // Arc length is 90 degrees minus the total opening space
        const length = (Math.PI / 2) - openingAngle;

        return {
            rotation: -startAngle,
            thetaStart: startAngle,
            thetaLength: length
        };
    });

    // Create 4 lintel segments (wall above corridor arches)
    // The Spandrel covers 12.5 to 17.5.
    // Lintel should start at 17.5.
    const archPeak = 17.5;
    const lintelHeight = height - archPeak;
    const lintelY = archPeak + lintelHeight / 2;

    const lintelSegments = [0, 1, 2, 3].map(i => {
        const centerAngle = i * Math.PI / 2;
        const startAngle = centerAngle - openingAngle / 2;

        return {
            thetaStart: startAngle,
            thetaLength: openingAngle
        };
    });

    return (
        <group>
            {/* Main Wall Segments */}
            {mainSegments.map((seg, i) => (
                <mesh key={`wall-${i}`} position={[0, height / 2, 0]} rotation={[0, Math.PI, 0]}>
                    <cylinderGeometry
                        args={[radius, radius, height, 32, 1, true, seg.thetaStart, seg.thetaLength]}
                    />
                    <meshStandardMaterial
                        color="#CD7F32"
                        roughness={0.4}
                        metalness={0.6}
                        side={DoubleSide}
                    />
                </mesh>
            ))}

            {/* Lintel Segments (Above Corridors) */}
            {lintelSegments.map((seg, i) => (
                <mesh key={`lintel-${i}`} position={[0, lintelY, 0]} rotation={[0, Math.PI, 0]}>
                    <cylinderGeometry
                        args={[radius, radius, lintelHeight, 16, 1, true, seg.thetaStart, seg.thetaLength]}
                    />
                    <meshStandardMaterial
                        color="#CD7F32"
                        roughness={0.4}
                        metalness={0.6}
                        side={DoubleSide}
                    />
                </mesh>
            ))}
        </group>
    );
}

/**
 * Domed Ceiling with structural beams
 */
function DomeCeiling({ radius, height }: { radius: number; height: number }) {
    // Radial beam count
    const beamCount = 16;
    const beams = useMemo(() => {
        const positions: number[] = [];
        for (let i = 0; i < beamCount; i++) {
            positions.push((i / beamCount) * Math.PI * 2);
        }
        return positions;
    }, []);

    const domeHeight = height * 0.4;

    // Simplified dome - single layer, no beams
    return (
        <group position={[0, height, 0]}>
            {/* Main dome */}
            <mesh>
                <sphereGeometry args={[radius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
                <meshStandardMaterial
                    color="#1a1a2e"
                    roughness={0.8}
                    metalness={0.1}
                    side={DoubleSide}
                />
            </mesh>

            {/* Central chandelier ring */}
            <mesh position={[0, -domeHeight * 0.3, 0]}>
                <torusGeometry args={[radius * 0.15, 2, 8, 24]} />
                <meshStandardMaterial
                    color="#FFD700"
                    roughness={0.2}
                    metalness={0.8}
                    emissive="#FFD700"
                    emissiveIntensity={0.3}
                />
            </mesh>

            {/* Chandelier light */}
            <pointLight
                position={[0, -domeHeight * 0.3, 0]}
                intensity={800}
                color="#fff5e6"
                distance={radius}
                decay={2}
            />
        </group>
    );
}

/**
 * Center Stage - Performance area marker
 */
function CenterStage() {
    return (
        <group position={[0, 0.05, 0]}>
            {/* Main stage circle */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[8, 10, 64]} />
                <meshStandardMaterial
                    color="#FFD700"
                    roughness={0.3}
                    metalness={0.7}
                    emissive="#FFD700"
                    emissiveIntensity={0.1}
                />
            </mesh>

            {/* Inner accent ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                <ringGeometry args={[4, 5, 64]} />
                <meshStandardMaterial
                    color="#B87333"
                    roughness={0.4}
                    metalness={0.6}
                />
            </mesh>

            {/* Center point */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
                <circleGeometry args={[1, 32]} />
                <meshStandardMaterial
                    color="#FFD700"
                    roughness={0.2}
                    metalness={0.8}
                    emissive="#FFD700"
                    emissiveIntensity={0.2}
                />
            </mesh>

            {/* Subtle glow light at center */}
            <pointLight
                position={[0, 2, 0]}
                intensity={50}
                color="#FFD700"
                distance={20}
                decay={2}
            />
        </group>
    );
}

/**
 * Branching Paths - 4 corridors extending from the band room
 * North (forward +Z), South (behind -Z), East (+X), West (-X)
 */
interface BranchingPathsProps {
    arenaRadius: number;
    wallHeight: number;
}

function BranchingPaths({ arenaRadius, wallHeight }: BranchingPathsProps) {
    // Corridor dimensions - 10m wide, 12.5m tall (25% taller)
    const corridorWidth = 10;
    const corridorLength = 200;
    const corridorHeight = 12.5;

    // Interior arch positions (spaced along the corridor)
    const archSpacing = 30;
    const archCount = Math.floor(corridorLength / archSpacing) - 1;

    // Each corridor: direction, rotation, position
    const corridors = [
        { name: 'north', angle: 0, label: 'Forward Path' },           // +Z
        { name: 'south', angle: Math.PI, label: 'Return Path' },      // -Z
        { name: 'east', angle: Math.PI / 2, label: 'Right Path' },    // +X
        { name: 'west', angle: -Math.PI / 2, label: 'Left Path' },    // -X
    ];

    return (
        <group>
            {corridors.map((corridor) => {
                // Position the corridor so it starts inside the arena (overlaps for seamless connection)
                // Reduced overlap to prevents geometry protruding into the arena (which causes black artifacts)
                // Just enough to Clip into the wall (1m)
                const overlapIntoArena = 1;
                const offsetX = Math.sin(corridor.angle) * (arenaRadius + corridorLength / 2 - overlapIntoArena);
                const offsetZ = Math.cos(corridor.angle) * (arenaRadius + corridorLength / 2 - overlapIntoArena);

                return (
                    <group
                        key={corridor.name}
                        position={[offsetX, 0, offsetZ]}
                        rotation={[0, -corridor.angle, 0]}
                    >
                        {/* Floor */}
                        <mesh
                            rotation={[-Math.PI / 2, 0, 0]}
                            position={[0, 0.01, 0]}
                            receiveShadow
                        >
                            <planeGeometry args={[corridorWidth, corridorLength]} />
                            <meshStandardMaterial
                                color="#8B4513"
                                roughness={0.3}
                                metalness={0.1}
                            />
                        </mesh>

                        {/* Left Wall - Match Band Room Bronze */}
                        <mesh position={[-corridorWidth / 2 - 0.5, corridorHeight / 2, 0]}>
                            <boxGeometry args={[1, corridorHeight, corridorLength]} />
                            <meshStandardMaterial
                                color="#CD7F32"
                                roughness={0.4}
                                metalness={0.6}
                            />
                        </mesh>

                        {/* Right Wall - Match Band Room Bronze */}
                        <mesh position={[corridorWidth / 2 + 0.5, corridorHeight / 2, 0]}>
                            <boxGeometry args={[1, corridorHeight, corridorLength]} />
                            <meshStandardMaterial
                                color="#CD7F32"
                                roughness={0.4}
                                metalness={0.6}
                            />
                        </mesh>

                        <mesh position={[0, corridorHeight, 0]} rotation={[Math.PI / 2, 0, 0]}>
                            <cylinderGeometry
                                args={[corridorWidth / 2, corridorWidth / 2, corridorLength, 32, 1, true, Math.PI / 2, Math.PI]}
                            />
                            <meshStandardMaterial
                                color="#CD7F32"  // Bronze to match walls
                                roughness={0.5}
                                metalness={0.4}
                                side={DoubleSide}
                            />
                        </mesh>

                        {/* End Wall - Natural Stone appearance */}
                        <group position={[0, 0, corridorLength / 2]}>
                            {/* Main stone wall base */}
                            <mesh position={[0, corridorHeight / 2, 0]}>
                                <boxGeometry args={[corridorWidth, corridorHeight, 2]} />
                                <meshStandardMaterial
                                    color="#6B6B6B"
                                    roughness={0.95}
                                    metalness={0.0}
                                />
                            </mesh>
                            {/* Stone wall arch cap to fill ceiling gap */}
                            <mesh position={[0, corridorHeight, 0]} rotation={[Math.PI / 2, 0, 0]}>
                                <cylinderGeometry args={[corridorWidth / 2, corridorWidth / 2, 2, 32, 1, false, Math.PI / 2, Math.PI]} />
                                <meshStandardMaterial
                                    color="#6B6B6B"
                                    roughness={0.95}
                                    metalness={0.0}
                                    side={DoubleSide}
                                />
                            </mesh>
                        </group>

                        {/* Archway frame at entrance */}
                        <group position={[0, 0, -corridorLength / 2 + 2]}>
                            {/* Left pillar */}
                            <mesh position={[-corridorWidth / 2 - 1.5, (corridorHeight - 2) / 2, 0]}>
                                <boxGeometry args={[2, corridorHeight - 2, 2]} />
                                <meshStandardMaterial
                                    color="#DAA520"
                                    roughness={0.3}
                                    metalness={0.7}
                                />
                            </mesh>
                            {/* Right pillar */}
                            <mesh position={[corridorWidth / 2 + 1.5, (corridorHeight - 2) / 2, 0]}>
                                <boxGeometry args={[2, corridorHeight - 2, 2]} />
                                <meshStandardMaterial
                                    color="#DAA520"
                                    roughness={0.3}
                                    metalness={0.7}
                                />
                            </mesh>

                            {/* Spandrel to fill arch gap (Spans from 12.5 to 17.5) */}
                            {/* Frame is at -Length/2 + 2. We want Spandrel at -Length/2 (Flush with wall). */}
                            {/* So relative Z is -2. */}
                            <group position={[0, 0, -2]}>
                                <EntranceSpandrel width={15} height={5} archRadius={4.8} />
                            </group>

                            {/* Top beam */}
                            <mesh position={[0, corridorHeight - 1, 0]}>
                                <boxGeometry args={[corridorWidth + 6, 2, 2]} />
                                <meshStandardMaterial
                                    color="#DAA520"
                                    roughness={0.3}
                                    metalness={0.7}
                                    emissive="#DAA520"
                                    emissiveIntensity={0.1}
                                />
                            </mesh>
                        </group>

                        {/* Interior arches along the corridor */}
                        {Array.from({ length: archCount }).map((_, i) => {
                            const archZ = -corridorLength / 2 + archSpacing * (i + 1) + 15;
                            return (
                                <group key={`arch-${i}`} position={[0, 0, archZ]}>
                                    {/* Left pillar */}
                                    <mesh position={[-corridorWidth / 2 + 0.5, corridorHeight / 2, 0]}>
                                        <boxGeometry args={[1, corridorHeight, 1]} />
                                        <meshStandardMaterial
                                            color="#8B4513"
                                            roughness={0.3}
                                            metalness={0.1}
                                        />
                                    </mesh>
                                    {/* Right pillar */}
                                    <mesh position={[corridorWidth / 2 - 0.5, corridorHeight / 2, 0]}>
                                        <boxGeometry args={[1, corridorHeight, 1]} />
                                        <meshStandardMaterial
                                            color="#8B4513"
                                            roughness={0.3}
                                            metalness={0.1}
                                        />
                                    </mesh>
                                    {/* Arched connection */}
                                    <mesh position={[0, corridorHeight - 1, 0]} rotation={[0, 0, 0]}>
                                        {/* Use a torus segment or similar for a nice arch, or just a simple beam for now */}
                                        {/* Let's try a curved tube/torus section for the arch */}
                                        <torusGeometry args={[corridorWidth / 2 - 0.5, 0.4, 8, 16, Math.PI]} />
                                        <meshStandardMaterial
                                            color="#CD7F32"
                                            roughness={0.4}
                                            metalness={0.6}
                                        />
                                    </mesh>
                                </group>
                            );
                        })}

                        {/* Corridor lighting - 3 lights with visibility culling */}
                        <CorridorLights
                            corridorAngle={corridor.angle}
                            corridorLength={corridorLength}
                            corridorHeight={corridorHeight}
                            arenaRadius={arenaRadius}
                        />
                    </group>
                );
            })}
        </group>
    );
}

// Sub-component for corridor lights to handle own visibility updates
function CorridorLights({
    corridorAngle,
    corridorLength,
    corridorHeight,
    arenaRadius
}: {
    corridorAngle: number,
    corridorLength: number,
    corridorHeight: number,
    arenaRadius: number
}) {
    const groupRef = useRef<Group>(null);

    useFrame(() => {
        if (!groupRef.current) return;

        // Check if player is inside or near this corridor (cylinder/box check)
        const playerPos = usePlayerStore.getState().position;
        const [px, , pz] = playerPos;

        // Calculate corridor entrance position
        const entranceX = Math.sin(corridorAngle) * arenaRadius;
        const entranceZ = Math.cos(corridorAngle) * arenaRadius;

        // Vector pointing down the corridor
        const dirX = Math.sin(corridorAngle);
        const dirZ = Math.cos(corridorAngle);

        // Vector from entrance to player
        const toPlayerX = px - entranceX;
        const toPlayerZ = pz - entranceZ;

        // Project player position onto corridor axis
        // dot product: (toPlayer . dir)
        const distanceAlongCorridor = toPlayerX * dirX + toPlayerZ * dirZ;

        // Check strict bounds:
        // -50 to length+50 (longitudinal buffer) ensures visible before entering and after leaving
        // We also implicitly handle the "width" by assuming if they are this far along the vector, they are likely in the corridor
        // (since collision prevents walking through walls, we don't strictly need a width check for culling)
        const isAlongCorridor = distanceAlongCorridor > -50 && distanceAlongCorridor < corridorLength + 50;

        // For extra safety, check simple radius from corridor center point?
        // No, the projection is robust for straight corridors.
        // But let's add a "perpendicular distance" check to avoid it turning on when in parallel corridors (unlikely with this geometry but good practice)
        // Perpendicular distance is magnitude of rejection vector or simpler: check distance from entrance if "behind" entrance.

        // Actually, just the projection is enough because corridors fan out from a circle.
        // If I am at North corridor (angle 0), and go to East (angle 90).
        // North Dir = (0, 1). East Pos = (R, 0).
        // Entrance N = (0, R).
        // Rel Pos = (R, -R).
        // Dot = -R. 
        // -R is < -50 (since R=375). So North lights are OFF when at East. Correct.

        groupRef.current.visible = isAlongCorridor;
    });

    return (
        <group ref={groupRef}>
            <pointLight
                position={[0, corridorHeight - 2, -corridorLength / 4]}
                intensity={100}
                color="#fff0d9"
                distance={corridorLength / 2}
                decay={2}
            />
            <pointLight
                position={[0, corridorHeight - 2, corridorLength / 4]}
                intensity={100}
                color="#fff0d9"
                distance={corridorLength / 2}
                decay={2}
            />
            {/* Light at the end to illuminate stone wall */}
            <pointLight
                position={[0, corridorHeight - 2, corridorLength / 2 - 5]}
                intensity={150}
                color="#ffeedd"
                distance={40}
                decay={1.5}
            />
        </group>
    );
}

/**
 * Individual Spotlight Component
 */
interface SpotlightProps {
    position: [number, number, number];
    target: [number, number, number];
}

import { forwardRef } from 'react';

const SpotlightComponent = forwardRef<ThreeSpotLight, SpotlightProps>(
    function SpotlightComponent({ position, target }, ref) {
        return (
            <group position={position}>
                {/* Spotlight housing */}
                <mesh rotation={[Math.PI / 4, 0, 0]}>
                    <cylinderGeometry args={[1, 2, 3, 16]} />
                    <meshStandardMaterial
                        color="#333333"
                        roughness={0.6}
                        metalness={0.4}
                    />
                </mesh>

                {/* The actual spotlight */}
                <spotLight
                    ref={ref}
                    position={[0, 0, 0]}
                    target-position={target}
                    intensity={SPOTLIGHT_INTENSITY}
                    angle={SPOTLIGHT_ANGLE}
                    penumbra={0.5}
                    color={SPOTLIGHT_COLOR}
                    distance={300}
                    decay={2}
                />
            </group>
        );
    }
);

// Export pillar config generator for external use
export { generatePillars };
export type { PillarConfig, Pillar };

export default BandRoom;
