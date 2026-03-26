import { memo } from 'react';
import * as THREE from 'three';
import { WALL_COLOR, WALL_HEIGHT } from './BackstageHalls';
import { StoneTileFloor } from './StoneTileFloor';
import { CulledPointLight } from './DungeonDecorations';

interface BridgeProps {
    position: [number, number, number];
}

/**
 * A short bridge consisting of floor, side walls, a ceiling, and a light.
 * Used to connect the Hub Room to the Left and Right Corridors.
 */
export const Bridge = memo(function Bridge({ position }: BridgeProps) {
    return (
        <group position={position}>
            {/* Floor */}
            <group position={[0, 0.051, 0]}>
                <StoneTileFloor width={10} depth={12} />
            </group>

            {/* Front/Back Walls */}
            <mesh position={[0, WALL_HEIGHT / 2, -6 - 0.5]}>
                <boxGeometry args={[10, WALL_HEIGHT, 1]} />
                <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
            </mesh>
            <mesh position={[0, WALL_HEIGHT / 2, 6 + 0.5]}>
                <boxGeometry args={[10, WALL_HEIGHT, 1]} />
                <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
            </mesh>

            {/* Ceiling */}
            <mesh position={[0, WALL_HEIGHT, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[10, 12]} />
                <meshStandardMaterial color={WALL_COLOR} roughness={0.9} side={THREE.DoubleSide} />
            </mesh>

            {/* Light */}
            <CulledPointLight position={[0, 10, 0]} intensity={30} color="#ffaa66" distance={30} decay={2} />
        </group>
    );
});
