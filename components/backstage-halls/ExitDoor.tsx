import { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '@/lib/store';
import { CulledPointLight } from './DungeonDecorations';
import { HUB_DEPTH } from './BackstageHalls';

/**
 * Exit Door - at back of hub, allows escape with gold
 */
export function ExitDoor() {
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
