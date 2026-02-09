'use client';

import { Environment as DreiEnvironment, Grid } from '@react-three/drei';

/**
 * Environment Component
 * Game world environment, lighting, and arena
 */

interface EnvironmentProps {
    phase?: number; // 1, 2, or 3 - affects visual intensity
}

export function Environment({ phase = 1 }: EnvironmentProps) {
    // Environment intensity based on phase
    const intensity = 0.5 + (phase * 0.25);

    return (
        <>
            {/* Lighting */}
            <ambientLight intensity={0.3} />
            <directionalLight
                position={[10, 10, 5]}
                intensity={intensity}
                castShadow
            />
            <pointLight
                position={[0, 5, 0]}
                intensity={intensity * 0.5}
                color="#8b5cf6"
            />

            {/* Environment preset */}
            <DreiEnvironment preset="night" />

            {/* Arena floor grid */}
            <Grid
                position={[0, -0.01, 0]}
                args={[50, 50]}
                cellSize={1}
                cellThickness={0.5}
                cellColor="#4a4a4a"
                sectionSize={5}
                sectionThickness={1}
                sectionColor="#8b5cf6"
                fadeDistance={50}
                fadeStrength={1}
                infiniteGrid
            />

            {/* Arena floor */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
                <planeGeometry args={[100, 100]} />
                <meshStandardMaterial color="#1a1a2e" />
            </mesh>
        </>
    );
}

export default Environment;
