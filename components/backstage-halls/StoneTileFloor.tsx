import { memo, useRef, useMemo, useLayoutEffect } from 'react';
import * as THREE from 'three';

const TILE_SIZE = 4;
export const STONE_TILE_COLOR = '#6a6a6a';
const STONE_TILE_DARK = '#555555';
const CRACK_COLOR = '#252525';

/**
 * Stone Tile Floor - Optimized with InstancedMesh
 */
export const StoneTileFloor = memo(function StoneTileFloor({ width, depth }: { width: number; depth: number }) {
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
