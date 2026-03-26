import { memo } from 'react';
import * as THREE from 'three';
import { ZoneCulled } from './UseZoneCulling';
import { Stairs } from './Stairs';
import { CulledPointLight, WallTorch, Pillar } from './DungeonDecorations';
import { WALL_COLOR, WALL_HEIGHT } from './BackstageHalls';
import { useGameStore } from '@/lib/store/gameStore';

/**
 * HubDescent Component
 *
 * Two narrow passages open behind the hub room's back pillars,
 * converging into a small antechamber. At the back of the antechamber,
 * a wide staircase descends 30ft into the depths.
 *
 * GATED: Only renders after player kills 5 enemies in the trial room.
 * Before that, blocking walls seal both passage entrances.
 *
 * Layout (world coordinates):
 *   Passages: X=±12, Z=-25 to Z=-40 (5ft wide each)
 *   Antechamber: X=[-14.5, 14.5], Z=[-40, -55] (30ft × 15ft)
 *   Stairwell: X=[-6, 6], Z=[-55, -85] (12ft wide, 30 steps descending)
 */

const REQUIRED_KILLS = 5;

export const HubDescent = memo(function HubDescent() {
    const trialRoomKills = useGameStore((state) => state.dungeonState?.trialRoomKills ?? 0);
    const isUnlocked = trialRoomKills >= REQUIRED_KILLS;

    return (
        <ZoneCulled zone="hub_descent">
            <group position={[0, 0, 0]}>
                {!isUnlocked && (
                    <>
                        {/* Blocking wall across LEFT passage entrance (X=-12, Z=-25) */}
                        <mesh position={[-12, WALL_HEIGHT / 2, -25]}>
                            <boxGeometry args={[5, WALL_HEIGHT, 1]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>
                        {/* Blocking wall across RIGHT passage entrance (X=12, Z=-25) */}
                        <mesh position={[12, WALL_HEIGHT / 2, -25]}>
                            <boxGeometry args={[5, WALL_HEIGHT, 1]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>
                    </>
                )}

                {isUnlocked && (
                    <>
                        {/* -------- LEFT PASSAGE (behind left pillar at X=-12) -------- */}
                        {/* 5ft wide, 15ft long, Z=-25 to Z=-40 */}
                        <mesh position={[-12, 0.05, -32.5]} rotation={[-Math.PI / 2, 0, 0]}>
                            <planeGeometry args={[5, 15]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} side={THREE.DoubleSide} />
                        </mesh>
                        <mesh position={[-14.5, WALL_HEIGHT / 2, -32.5]}>
                            <boxGeometry args={[1, WALL_HEIGHT, 15]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>
                        <mesh position={[-9.5, WALL_HEIGHT / 2, -32.5]}>
                            <boxGeometry args={[1, WALL_HEIGHT, 15]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>
                        <mesh position={[-12, WALL_HEIGHT, -32.5]} rotation={[-Math.PI / 2, 0, 0]}>
                            <planeGeometry args={[5, 15]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} side={THREE.DoubleSide} />
                        </mesh>
                        <WallTorch position={[-14, 8, -30]} rotation={Math.PI / 2} lightIntensity={10} />

                        {/* -------- RIGHT PASSAGE (behind right pillar at X=12) -------- */}
                        <mesh position={[12, 0.05, -32.5]} rotation={[-Math.PI / 2, 0, 0]}>
                            <planeGeometry args={[5, 15]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} side={THREE.DoubleSide} />
                        </mesh>
                        <mesh position={[14.5, WALL_HEIGHT / 2, -32.5]}>
                            <boxGeometry args={[1, WALL_HEIGHT, 15]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>
                        <mesh position={[9.5, WALL_HEIGHT / 2, -32.5]}>
                            <boxGeometry args={[1, WALL_HEIGHT, 15]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>
                        <mesh position={[12, WALL_HEIGHT, -32.5]} rotation={[-Math.PI / 2, 0, 0]}>
                            <planeGeometry args={[5, 15]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} side={THREE.DoubleSide} />
                        </mesh>
                        <WallTorch position={[14, 8, -30]} rotation={-Math.PI / 2} lightIntensity={10} />

                        {/* -------- ANTECHAMBER (Z=-40 to Z=-55) -------- */}
                        {/* Floor */}
                        <mesh position={[0, 0.05, -47.5]} rotation={[-Math.PI / 2, 0, 0]}>
                            <planeGeometry args={[30, 15]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} side={THREE.DoubleSide} />
                        </mesh>
                        {/* Ceiling */}
                        <mesh position={[0, WALL_HEIGHT, -47.5]} rotation={[-Math.PI / 2, 0, 0]}>
                            <planeGeometry args={[30, 15]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} side={THREE.DoubleSide} />
                        </mesh>
                        {/* Left wall */}
                        <mesh position={[-14.5, WALL_HEIGHT / 2, -47.5]}>
                            <boxGeometry args={[1, WALL_HEIGHT, 15]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>
                        {/* Right wall */}
                        <mesh position={[14.5, WALL_HEIGHT / 2, -47.5]}>
                            <boxGeometry args={[1, WALL_HEIGHT, 15]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>
                        {/* Front wall — center fill between passage openings */}
                        <mesh position={[0, WALL_HEIGHT / 2, -40]}>
                            <boxGeometry args={[19, WALL_HEIGHT, 1]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>
                        {/* Back wall — two segments flanking the 12ft stairwell opening */}
                        <mesh position={[-10.5, WALL_HEIGHT / 2, -55]}>
                            <boxGeometry args={[9, WALL_HEIGHT, 1]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>
                        <mesh position={[10.5, WALL_HEIGHT / 2, -55]}>
                            <boxGeometry args={[9, WALL_HEIGHT, 1]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>

                        {/* Antechamber Lighting */}
                        <CulledPointLight position={[0, 12, -47.5]} intensity={40} color="#ff9955" distance={30} decay={2} />
                        <WallTorch position={[-14, 8, -50]} rotation={Math.PI / 2} lightIntensity={10} />
                        <WallTorch position={[14, 8, -50]} rotation={-Math.PI / 2} lightIntensity={10} />

                        {/* Pillars flanking the stairwell entrance */}
                        <Pillar position={[-6, 0, -54]} height={WALL_HEIGHT} radius={0.8} />
                        <Pillar position={[6, 0, -54]} height={WALL_HEIGHT} radius={0.8} />

                        {/* -------- STAIRWELL (starts at Z=-55, descends in -Z direction) -------- */}
                        {/* 12ft wide, 30 steps × 1ft high × 1ft deep = 30ft down, 30ft long */}
                        <Stairs
                            id="hub-descent-stairs"
                            position={[0, 0, -55]}
                            rotation={Math.PI}
                            stepCount={30}
                            stepWidth={12}
                            stepDepth={1}
                            stepHeight={1}
                            descending={true}
                            color="#555555"
                            roughness={0.9}
                        />

                        {/* Stairwell enclosure walls */}
                        <mesh position={[-6.5, -5, -70]}>
                            <boxGeometry args={[1, WALL_HEIGHT + 30, 30]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>
                        <mesh position={[6.5, -5, -70]}>
                            <boxGeometry args={[1, WALL_HEIGHT + 30, 30]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
                        </mesh>
                        {/* Ceiling — slanted to follow stairs */}
                        <mesh position={[0, WALL_HEIGHT - 15, -70]} rotation={[Math.atan(1), 0, 0]}>
                            <planeGeometry args={[12, 43]} />
                            <meshStandardMaterial color={WALL_COLOR} roughness={0.9} side={THREE.DoubleSide} />
                        </mesh>

                        {/* Stairwell torches */}
                        <WallTorch position={[-6, 5, -62]} rotation={Math.PI / 2} lightIntensity={12} />
                        <WallTorch position={[6, 5, -62]} rotation={-Math.PI / 2} lightIntensity={12} />
                        <WallTorch position={[-6, -10, -78]} rotation={Math.PI / 2} lightIntensity={12} />
                        <WallTorch position={[6, -10, -78]} rotation={-Math.PI / 2} lightIntensity={12} />
                    </>
                )}
            </group>
        </ZoneCulled>
    );
});
