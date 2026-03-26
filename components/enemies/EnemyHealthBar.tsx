'use client';

import { useMemo, createContext, useContext } from 'react';
import { Merged, Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';

export const EnemyHealthBarContext = createContext<any>(null);

export function EnemyHealthBarInstances({ children }: { children: React.ReactNode }) {
    const meshes = useMemo(() => {
        const bgGeo = new THREE.PlaneGeometry(1, 1);
        const bgMat = new THREE.MeshBasicMaterial({ color: "#1a1a1a", depthTest: true, depthWrite: false });

        const fillGeo = new THREE.PlaneGeometry(1, 1);
        const fillMat = new THREE.MeshBasicMaterial({ color: "#ef4444", depthTest: true, depthWrite: false });

        const borderGeo = new THREE.PlaneGeometry(1, 1);
        const borderMat = new THREE.MeshBasicMaterial({ color: "#333333", depthTest: true, depthWrite: false });

        return {
            bg: new THREE.Mesh(bgGeo, bgMat),
            fill: new THREE.Mesh(fillGeo, fillMat),
            border: new THREE.Mesh(borderGeo, borderMat)
        };
    }, []);

    return (
        <Merged castShadow receiveShadow frustumCulled={false} meshes={meshes} limit={300}>
            {(instances) => (
                <EnemyHealthBarContext.Provider value={instances}>
                    {children}
                </EnemyHealthBarContext.Provider>
            )}
        </Merged>
    );
}

export type EnemyTypeName = 'trumpet' | 'trombone' | 'tuba' | 'french_horn' | 'euphonium';

const ENEMY_TYPE_COLORS: Record<EnemyTypeName, { accent: string; border: string; label: string }> = {
    trumpet: { accent: '#f59e0b', border: '#b45309', label: 'Trumpet' },
    trombone: { accent: '#f97316', border: '#c2410c', label: 'Trombone' },
    tuba: { accent: '#dc2626', border: '#991b1b', label: 'Tuba' },
    french_horn: { accent: '#400379', border: '#323232', label: 'French Horn' },
    euphonium: { accent: '#3b82f6', border: '#1d4ed8', label: 'Euphonium' },
};

export type DamageTextType = 'normal' | 'crit' | 'superCrit';

export interface EnemyHealthBarProps {
    health: number;
    maxHealth: number;
    level: number;
    visible: boolean;
    enemyType?: EnemyTypeName;
    damageTextValue?: number | null;
    damageTextTime?: number | null;
    damageTextType?: DamageTextType;
}


export function EnemyHealthBar({
    health,
    maxHealth,
    level,
    visible,
    enemyType = 'trumpet',
    damageTextValue,
    damageTextTime,
    damageTextType = 'normal'
}: EnemyHealthBarProps) {
    if (!visible) return null;

    const instances = useContext(EnemyHealthBarContext);

    const ratio = Math.max(0, Math.min(1, health / maxHealth));
    const showDamage = damageTextValue !== null && damageTextValue !== undefined && damageTextTime && (Date.now() - damageTextTime < 1000);
    const typeStyle = ENEMY_TYPE_COLORS[enemyType] || ENEMY_TYPE_COLORS.trumpet;

    // Bar dimensions (in world units, before billboard scaling)
    const barWidth = 3.0;   // Wider bar (was 2.0)
    const barHeight = 0.25; // Taller bar (was 0.1 effective)
    const borderSize = 0.04;

    let damageColor = "#ffffff";
    let damageSize = 0.4;
    let damagePrefix = "-";

    if (damageTextType === 'crit') {
        damageColor = "#f59e0b"; // Amber-500
        damageSize = 0.6;
        damagePrefix = "CRIT! -";
    } else if (damageTextType === 'superCrit') {
        damageColor = "#ef4444"; // Red-500
        damageSize = 0.8;
        damagePrefix = "SUPER CRIT! -";
    }

    return (
        <Billboard follow lockX={false} lockY={false} lockZ={false}>
            <group position={[0, 0.3, 0]}>
                {/* Enemy Type + Level Text */}
                <Text
                    position={[0, barHeight / 2 + 0.18, 0]}
                    fontSize={0.32}
                    color={typeStyle.accent}
                    outlineWidth={0.04}
                    outlineColor="#000000"
                    anchorX="center"
                    anchorY="bottom"
                    font={undefined}
                >
                    {typeStyle.label} LV {level}
                </Text>

                {/* HP Fraction - show current / max */}
                <Text
                    position={[0, -(barHeight / 2) - 0.08, 0.01]}
                    fontSize={0.18}
                    color="#f0f8ff"
                    outlineWidth={0.025}
                    outlineColor="#000000"
                    anchorX="center"
                    anchorY="top"
                >
                    {Math.ceil(health)} / {Math.ceil(maxHealth)}
                </Text>

                {/* Damage Text Pop - larger and more visible */}
                {showDamage && (
                    <Text
                        position={[0, barHeight / 2 + (damageTextType === 'superCrit' ? 0.9 : 0.65), 0]}
                        fontSize={damageSize}
                        color={damageColor}
                        outlineWidth={0.05}
                        outlineColor="#000000"
                        anchorX="center"
                        anchorY="bottom"
                    >
                        {damagePrefix}{damageTextValue}
                    </Text>
                )}

                {/* Health Bar */}
                {instances ? (
                    <group>
                        {/* Border - colored by enemy type */}
                        <mesh
                            position={[0, 0, -0.1]}
                            scale={[barWidth + borderSize * 2, barHeight + borderSize * 2, 1]}
                            renderOrder={998}
                        >
                            <planeGeometry args={[1, 1]} />
                            <meshBasicMaterial color={typeStyle.border} depthWrite={false} />
                        </mesh>
                        {/* Dark background */}
                        <instances.bg
                            position={[0, 0, -0.05]}
                            scale={[barWidth, barHeight, 1]}
                            renderOrder={999}
                        />
                        {/* Health fill - colored by enemy type */}
                        <mesh
                            position={[(-barWidth / 2 + (ratio * barWidth) / 2), 0, 0]}
                            scale={[ratio * barWidth, barHeight - 0.02, 1]}
                            renderOrder={1000}
                        >
                            <planeGeometry args={[1, 1]} />
                            <meshBasicMaterial color={typeStyle.accent} depthWrite={false} />
                        </mesh>
                    </group>
                ) : (
                    <group>
                        {/* Border - colored by enemy type */}
                        <mesh position={[0, 0, -0.1]} scale={[barWidth + borderSize * 2, barHeight + borderSize * 2, 1]} renderOrder={998}>
                            <planeGeometry args={[1, 1]} />
                            <meshBasicMaterial color={typeStyle.border} depthWrite={false} />
                        </mesh>
                        {/* Dark background */}
                        <mesh position={[0, 0, -0.05]} scale={[barWidth, barHeight, 1]} renderOrder={999}>
                            <planeGeometry args={[1, 1]} />
                            <meshBasicMaterial color="#1a1a1a" depthWrite={false} />
                        </mesh>
                        {/* Health fill */}
                        <mesh
                            position={[(-barWidth / 2 + (ratio * barWidth) / 2), 0, 0]}
                            scale={[ratio * barWidth, barHeight - 0.02, 1]}
                            renderOrder={1000}
                        >
                            <planeGeometry args={[1, 1]} />
                            <meshBasicMaterial color={typeStyle.accent} depthWrite={false} />
                        </mesh>
                    </group>
                )}
            </group>
        </Billboard>
    );
}

export default EnemyHealthBar;
