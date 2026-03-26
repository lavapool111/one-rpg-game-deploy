import { memo } from 'react';
import * as THREE from 'three';
import { Hallway } from './Hallway';
import { CulledPointLight, WallTorch, Pillar } from './DungeonDecorations';
import { HUB_DEPTH, CORRIDOR_LENGTH, CORRIDOR_WIDTH, WALL_HEIGHT, WALL_COLOR } from './BackstageHalls';
import { SpawnZoneProps } from '@/lib/game/spawnZoneRegistry';

interface CorridorProps {
    angle: number;
    roomOffset?: number;
    spawnZone?: SpawnZoneProps;
    children?: React.ReactNode;
}

/**
 * Renders a main corridor shooting out from the Hub room, 
 * complete with lights, torches, pillars, and an optional room attached to its end.
 */
export const Corridor = memo(function Corridor({ angle, roomOffset = 0, spawnZone, children }: CorridorProps) {
    // Position corridor adjacent to hub (no gap)
    const offsetX = Math.sin(angle) * (HUB_DEPTH / 2 + CORRIDOR_LENGTH / 2);
    const offsetZ = Math.cos(angle) * (HUB_DEPTH / 2 + CORRIDOR_LENGTH / 2);

    return (
        <group position={[offsetX, 0, offsetZ]} rotation={[0, angle, 0]}>
            <Hallway length={CORRIDOR_LENGTH} width={CORRIDOR_WIDTH} hasCeiling={false} spawnZone={spawnZone}>
                {/* Ceiling - shortened to prevent z-fighting with room front walls */}
                <mesh position={[0, WALL_HEIGHT, -1]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[CORRIDOR_WIDTH, CORRIDOR_LENGTH - 2]} />
                    <meshStandardMaterial color={WALL_COLOR} roughness={0.9} side={THREE.DoubleSide} />
                </mesh>
            </Hallway>

            {/* Corridor point light */}
            <CulledPointLight position={[0, 10, 0]} intensity={25} color="#ff8844" distance={60} decay={2} />

            {/* Wall Torches along corridor */}
            <WallTorch position={[-CORRIDOR_WIDTH / 2 + 0.3, 8, -30]} rotation={Math.PI / 2} lightIntensity={12} />
            <WallTorch position={[CORRIDOR_WIDTH / 2 - 0.3, 8, -30]} rotation={-Math.PI / 2} lightIntensity={12} />
            <WallTorch position={[-CORRIDOR_WIDTH / 2 + 0.3, 8, 30]} rotation={Math.PI / 2} lightIntensity={12} />
            <WallTorch position={[CORRIDOR_WIDTH / 2 - 0.3, 8, 30]} rotation={-Math.PI / 2} lightIntensity={12} />

            {/* Decorative pillars at midpoint */}
            <Pillar position={[-CORRIDOR_WIDTH / 2 + 1.5, 0, 0]} height={WALL_HEIGHT} radius={0.8} />
            <Pillar position={[CORRIDOR_WIDTH / 2 - 1.5, 0, 0]} height={WALL_HEIGHT} radius={0.8} />

            {/* Attached Room / Zone at the end of the corridor */}
            {children && (
                <group position={[0, 0, CORRIDOR_LENGTH / 2 + roomOffset]}>
                    {children}
                </group>
            )}
        </group>
    );
});
