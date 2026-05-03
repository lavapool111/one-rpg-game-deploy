'use client';

import { useRef, memo, useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore, usePlayerStore } from '@/lib/store';
import { Group, BackSide, DoubleSide, MeshStandardMaterial, Color, Euler } from 'three';
import { registerSurfaces, unregisterSurfaces, registerObstacles, unregisterObstacles } from '@/lib/game/stairCollision';
import type { WalkableSurface, Obstacle } from '@/lib/game/stairCollision';
import {
    getAltarRadius,
    getAltarCenterZ,
    getAltarCorridorLength,
    getAltarHeight,
    getAltarScaleFactor
} from '@/lib/game/altarGeometry';
import { GAME_CONFIG } from '@/lib/game/config';

/**
 * AltarRoom Component
 * 
 * A circular altar room (~125ft diameter) behind the north corridor of the Band Room.
 * Features:
 * - Dark ancient stone cylindrical walls with tall ceiling
 * - Domed ceiling
 * - 6 statues of ancient godlike beings on pedestals around the perimeter
 * - Central altar with glowing rune circle
 * - Atmospheric moody lighting (optimized — minimal point lights)
 * - South entrance opening connecting to the north corridor
 */
import { InstancedMesh, Object3D, Matrix4, Vector3 } from 'three';

// --- Shared Materials (created once, reused) ---
const STONE_FLOOR_MATERIAL = new MeshStandardMaterial({
    color: new Color('#2a2a2a'),
    roughness: 0.9,
    metalness: 0.05,
});

const DARK_STONE_MATERIAL = new MeshStandardMaterial({
    color: new Color('#1a1a1a'),
    roughness: 0.85,
    metalness: 0.1,
    side: BackSide,
});

const STATUE_MATERIAL = new MeshStandardMaterial({
    color: new Color('#374c55'), //  obsidian
    roughness: 0.85, // Polished, catches sharp specular highlights
    metalness: 0.2, // not metallic
    emissive: new Color('#0b222d'), // faint glow to prevent pure blackness
    emissiveIntensity: 0.2
});

const STATUE_ACCENT_MATERIAL = new MeshStandardMaterial({
    color: new Color('#8B7355'),
    roughness: 0.3,
    metalness: 0.7,
    emissive: new Color('#3d3125'),
    emissiveIntensity: 0.95,
});

const PEDESTAL_MATERIAL = new MeshStandardMaterial({
    color: new Color('#313535'),
    roughness: 1,
    metalness: 0.4,
    emissive: new Color('#2d4049'), // faint glow to prevent pure blackness
    emissiveIntensity: 0.1
});

const ALTAR_STONE_MATERIAL = new MeshStandardMaterial({
    color: new Color('#333333'),
    roughness: 0.75,
    metalness: 0.15,
});

const ALTAR_TOP_MATERIAL = new MeshStandardMaterial({
    color: new Color('#2a2a2a'),
    roughness: 0.6,
    metalness: 0.2,
});

const RUNE_MATERIAL = new MeshStandardMaterial({
    color: new Color('#4a6a8a'),
    roughness: 0.3,
    metalness: 0.5,
    emissive: new Color('#3a5a7a'),
    emissiveIntensity: 0.6,
});

const RUNE_INNER_MATERIAL = new MeshStandardMaterial({
    color: new Color('#6a9aca'),
    roughness: 0.2,
    metalness: 0.4,
    emissive: new Color('#4a7aaa'),
    emissiveIntensity: 0.8,
});

const GOLD_TRIM_MATERIAL = new MeshStandardMaterial({
    color: new Color('#8B7355'),
    roughness: 0.3,
    metalness: 0.7,
    emissive: new Color('#5a4a3a'),
    emissiveIntensity: 0.1,
});

// --- Room Config ---
const ROOM_RADIUS = 62.5; // 125ft diameter
const WALL_HEIGHT = 40;   // Tall ceiling
const ENTRANCE_WIDTH = 10; // Match corridor width exactly
const STATUE_COUNT = 8;
const STATUE_RING_RADIUS = 50; // Distance from center for statue placement

// Center of the room in world Z (behind the north corridor end)
// North corridor ends at arenaRadius + corridorLength - overlapIntoArena = 375 + 200 - 1 = 574
// Room center = corridor end + room radius = 574 + 62.5 = 636.5
export const ALTAR_ROOM_CENTER_Z = 636.5;
export const ALTAR_ROOM_RADIUS = ROOM_RADIUS;

// --- Instanced Statues Component ---
const InstancedStatues = memo(function InstancedStatues({ radius, scale = 1, count = 8, isCurrent = false, isPlayerInRoom = false }: { radius: number, scale?: number, count?: number, isCurrent?: boolean, isPlayerInRoom?: boolean }) {
    const angles = useMemo(() => {
        const result = [];
        for (let i = 0; i < count; i++) {
            result.push((i / count) * Math.PI * 2 + Math.PI / 8);
        }
        return result;
    }, [count]);
    const pedestalRef = useRef<InstancedMesh>(null);
    const pedestalTrimRef = useRef<InstancedMesh>(null);
    const bodyBaseRef = useRef<InstancedMesh>(null);
    const bodyMidRef = useRef<InstancedMesh>(null);
    const bodyTorsoRef = useRef<InstancedMesh>(null);
    const shouldersRef = useRef<InstancedMesh>(null);
    const headRef = useRef<InstancedMesh>(null);
    const hoodRef = useRef<InstancedMesh>(null);
    const crownRef = useRef<InstancedMesh>(null);
    const crownSpikesRef = useRef<InstancedMesh>(null);
    const lArmRef = useRef<InstancedMesh>(null);
    const rArmRef = useRef<InstancedMesh>(null);
    const staffRef = useRef<InstancedMesh>(null);
    const orbRef = useRef<InstancedMesh>(null);
    const haloRef = useRef<InstancedMesh>(null);
    const staffBladeRef = useRef<InstancedMesh>(null);

    useEffect(() => {
        const refs = [
            pedestalRef, pedestalTrimRef, bodyBaseRef, bodyMidRef, bodyTorsoRef,
            shouldersRef, headRef, hoodRef, crownRef, crownSpikesRef, lArmRef, rArmRef, staffRef, orbRef, haloRef, staffBladeRef
        ];
        if (refs.some(ref => !ref.current)) return;

        const _tempObj = new Object3D();
        const _tempMatrix = new Matrix4();

        angles.forEach((angle, i) => {
            const x = Math.sin(angle) * radius;
            const z = Math.cos(angle) * radius;
            const rotY = angle + Math.PI;

            // Use a base matrix that includes position and rotation, then apply scale to everything inside it
            // or just scale the final world matrix.
            const statuePosMat = new Matrix4().makeTranslation(x, 0, z);
            const statueRotMat = new Matrix4().makeRotationY(rotY);
            // Height also scales, so we scale the whole group
            const statueScaleMat = new Matrix4().makeScale(scale, scale, scale);
            const baseMat = statuePosMat.clone().multiply(statueRotMat).multiply(statueScaleMat);

            // 1. Pedestal Base (Original Y was ~0.5)
            const pedBasePos = new Matrix4().makeTranslation(0, 0.5, 0);
            const pedBaseWorld = baseMat.clone().multiply(pedBasePos);
            pedestalRef.current!.setMatrixAt(i, pedBaseWorld);

            // 2. Pedestal Mid (Original Y was ~2.75)
            const pedTrimPos = new Matrix4().makeTranslation(0, 2.75, 0);
            const pedTrimWorld = baseMat.clone().multiply(pedTrimPos);
            pedestalTrimRef.current!.setMatrixAt(i, pedTrimWorld);

            // 3. Pedestal Top / Gold Cap (Original Y was ~4.75)
            const bodyBasePos = new Matrix4().makeTranslation(0, 4.75, 0);
            const bodyBaseWorld = baseMat.clone().multiply(bodyBasePos);
            bodyBaseRef.current!.setMatrixAt(i, bodyBaseWorld);

            // Statue parts start above pedestal (~5 units up)
            const baseY = 5;

            // 4. Statue Skirt
            const skirtPos = new Matrix4().makeTranslation(0, baseY + 3, 0);
            const skirtWorld = baseMat.clone().multiply(skirtPos);
            bodyMidRef.current!.setMatrixAt(i, skirtWorld);

            // 5. Statue Torso
            const torsoPos = new Matrix4().makeTranslation(0, baseY + 8, 0);
            const torsoWorld = baseMat.clone().multiply(torsoPos);
            bodyTorsoRef.current!.setMatrixAt(i, torsoWorld);

            // 6. Shoulders
            // Increased pauldron scale for imposing look
            const shLocalScale = new Matrix4().makeScale(1.8, 0.7, 1.2);
            const shPos = new Matrix4().makeTranslation(0, baseY + 11.5, 0);
            const shWorld = baseMat.clone().multiply(shPos).multiply(shLocalScale);
            shouldersRef.current!.setMatrixAt(i, shWorld);

            // 7. Head
            const headPos = new Matrix4().makeTranslation(0, baseY + 13.2, 0.5);
            const headWorld = baseMat.clone().multiply(headPos);
            headRef.current!.setMatrixAt(i, headWorld);

            // 8. Hood
            const hoodPos = new Matrix4().makeTranslation(0, baseY + 14, -0.3);
            const hoodWorld = baseMat.clone().multiply(hoodPos);
            hoodRef.current!.setMatrixAt(i, hoodWorld);

            // 9. Crown
            const crownPos = new Matrix4().makeTranslation(0, baseY + 15.2, 0);
            const crownWorld = baseMat.clone().multiply(crownPos);
            crownRef.current!.setMatrixAt(i, crownWorld);

            // 10. Crown Spikes
            for (let j = 0; j < 5; j++) {
                const angleOffset = (j / 5) * Math.PI * 2;
                const spikePos = new Matrix4().makeTranslation(
                    Math.sin(angleOffset) * 0.8,
                    baseY + 15.8, // Raised to match taller spikes
                    Math.cos(angleOffset) * 0.8
                );
                const spikeWorld = baseMat.clone().multiply(spikePos);
                crownSpikesRef.current!.setMatrixAt(i * 5 + j, spikeWorld);
            }

            // 11. L-Arm
            const lArmLocal = new Matrix4()
                .makeTranslation(-3.2, baseY + 3, 0.8) // Adjusted Y relative to baseY
                .multiply(new Matrix4().makeRotationFromEuler(new Euler(0.2, 0, 0.15)));
            const lArmWorld = baseMat.clone().multiply(lArmLocal);
            lArmRef.current!.setMatrixAt(i, lArmWorld);

            // 12. R-Arm
            const rArmLocal = new Matrix4()
                .makeTranslation(3.2, baseY + 3, 0.6)
                .multiply(new Matrix4().makeRotationFromEuler(new Euler(-0.1, 0, -0.15)));
            const rArmWorld = baseMat.clone().multiply(rArmLocal);
            rArmRef.current!.setMatrixAt(i, rArmWorld);

            // 13. Staff
            const staffPos = new Matrix4().makeTranslation(3.8, baseY + 7, 0.6);
            const staffWorld = baseMat.clone().multiply(staffPos);
            staffRef.current!.setMatrixAt(i, staffWorld);

            // 14. Orb
            const orbPos = new Matrix4().makeTranslation(3.8, baseY + 17, 0.6);
            const orbWorld = baseMat.clone().multiply(orbPos);
            orbRef.current!.setMatrixAt(i, orbWorld);

            // 15. Halo
            const haloPos = new Matrix4()
                .makeTranslation(0, baseY + 14, -1.8)
                .multiply(new Matrix4().makeRotationX(Math.PI / 2));
            const haloWorld = baseMat.clone().multiply(haloPos);
            haloRef.current!.setMatrixAt(i, haloWorld);

            // 16. Staff Blade (Halberd)
            const staffBladeLocal = new Matrix4().makeTranslation(3.8, baseY + 15, 1.4);
            const staffBladeWorld = baseMat.clone().multiply(staffBladeLocal);
            staffBladeRef.current!.setMatrixAt(i, staffBladeWorld);
        });

        refs.forEach(ref => {
            if (ref.current) {
                ref.current.instanceMatrix.needsUpdate = true;
                ref.current.computeBoundingSphere();
            }
        });
    }, [angles]);

    return (
        <group>
            {/* Pedestal Base - Wider tier */}
            <instancedMesh ref={pedestalRef} args={[undefined, undefined, angles.length]}>
                <boxGeometry args={[6, 1, 6]} />
                <primitive object={PEDESTAL_MATERIAL} attach="material" />
            </instancedMesh>

            {/* Pedestal Mid - Taller block */}
            <instancedMesh ref={pedestalTrimRef} args={[undefined, undefined, angles.length]}>
                <boxGeometry args={[5, 3.5, 5]} />
                <primitive object={PEDESTAL_MATERIAL} attach="material" />
            </instancedMesh>

            {/* Pedestal Top - Gold accented cap */}
            <instancedMesh ref={bodyBaseRef} args={[undefined, undefined, angles.length]}>
                <boxGeometry args={[5.5, 0.5, 5.5]} />
                <primitive object={GOLD_TRIM_MATERIAL} attach="material" />
            </instancedMesh>

            {/* Statue Base / Skirt */}
            <instancedMesh ref={bodyMidRef} args={[undefined, undefined, angles.length]}>
                <cylinderGeometry args={[2.5, 4.5, 6, 16]} />
                <primitive object={STATUE_MATERIAL} attach="material" />
            </instancedMesh>

            {/* Statue Torso */}
            <instancedMesh ref={bodyTorsoRef} args={[undefined, undefined, angles.length]}>
                <cylinderGeometry args={[3.2, 2.8, 4, 16]} />
                <primitive object={STATUE_MATERIAL} attach="material" />
            </instancedMesh>

            {/* Pauldrons / Shoulders (Ornate) */}
            <instancedMesh ref={shouldersRef} args={[undefined, undefined, angles.length]}>
                <cylinderGeometry args={[1, 4, 3, 8]} />
                <primitive object={STATUE_MATERIAL} attach="material" />
            </instancedMesh>
            <instancedMesh ref={headRef} args={[undefined, undefined, angles.length]}>
                <sphereGeometry args={[1.3, 12, 8]} />
                <primitive object={STATUE_MATERIAL} attach="material" />
            </instancedMesh>
            <instancedMesh ref={hoodRef} args={[undefined, undefined, angles.length]}>
                <coneGeometry args={[1.8, 2.5, 8]} />
                <primitive object={STATUE_MATERIAL} attach="material" />
            </instancedMesh>
            <instancedMesh ref={crownRef} args={[undefined, undefined, angles.length]}>
                <torusGeometry args={[0.8, 0.15, 12, 24]} />
                <primitive object={GOLD_TRIM_MATERIAL} attach="material" />
            </instancedMesh>
            <instancedMesh ref={crownSpikesRef} args={[undefined, undefined, angles.length * 5]}>
                <coneGeometry args={[0.15, 1.2, 6]} />
                <primitive object={GOLD_TRIM_MATERIAL} attach="material" />
            </instancedMesh>
            <instancedMesh ref={lArmRef} args={[undefined, undefined, angles.length]}>
                <cylinderGeometry args={[0.8, 1.2, 6, 8]} />
                <primitive object={STATUE_MATERIAL} attach="material" />
            </instancedMesh>
            <instancedMesh ref={rArmRef} args={[undefined, undefined, angles.length]}>
                <cylinderGeometry args={[0.8, 1.2, 6, 8]} />
                <primitive object={STATUE_MATERIAL} attach="material" />
            </instancedMesh>
            <instancedMesh ref={staffRef} args={[undefined, undefined, angles.length]}>
                <cylinderGeometry args={[0.2, 0.2, 20, 6]} />
                <primitive object={STATUE_ACCENT_MATERIAL} attach="material" />
            </instancedMesh>
            <instancedMesh ref={orbRef} args={[undefined, undefined, angles.length]}>
                <sphereGeometry args={[0.8, 8, 6]} />
                <primitive object={STATUE_ACCENT_MATERIAL} attach="material" />
            </instancedMesh>
            <instancedMesh ref={haloRef} args={[undefined, undefined, angles.length]}>
                <torusGeometry args={[2.5, 0.2, 16, 32]} />
                <primitive object={GOLD_TRIM_MATERIAL} attach="material" />
            </instancedMesh>
            <instancedMesh ref={staffBladeRef} args={[undefined, undefined, angles.length]}>
                <boxGeometry args={[0.2, 4, 2]} />
                <primitive object={STATUE_ACCENT_MATERIAL} attach="material" />
            </instancedMesh>

            {/* Individual Lights - Colored magical glow per statue - only in current room and when player is inside */}
            {isCurrent && isPlayerInRoom && angles.map((angle, i) => {
                // 6 distinct colors: red, orange, green, cyan, purple, magenta
                const colors = ['#5b2020', '#5e2f0f', '#895a1a', '#154c31', '#2c716d', '#586e7c', '#434f6c', '#7a2b7a'];

                const xCenter = Math.sin(angle) * (radius);
                const zCenter = Math.cos(angle) * (radius);
                const rotY = angle + Math.PI;

                const statuePosMat = new Matrix4().makeTranslation(xCenter, 0, zCenter);
                const statueRotMat = new Matrix4().makeRotationY(rotY);
                const statueScaleMat = new Matrix4().makeScale(scale, scale, scale);
                const baseMat = statuePosMat.clone().multiply(statueRotMat).multiply(statueScaleMat);

                // Orb is at local (3.8, 17+5, 0.6). Place light precisely at the orb edge (Z=1.6)
                // so it originates from its surface, creating a tight localized glow!
                const lightLocal = new Vector3(3.8, 22, 1.6);
                lightLocal.applyMatrix4(baseMat);

                return (
                    <pointLight
                        key={i}
                        position={[lightLocal.x, lightLocal.y, lightLocal.z]}
                        intensity={90 * scale} // Hot bright center
                        color={colors[i % colors.length]}
                        distance={25 * scale} // Tight falloff to look like a distinct source, not a widespread floodlight
                        decay={2} // Realistic quadratic decay
                        frustumCulled={false}
                    />
                );
            })}
        </group>
    );
});

// --- Instanced Portals Component ---
const InstancedPortals = memo(function InstancedPortals({ roomRadius, scale = 1 }: { roomRadius: number, scale?: number }) {
    const postRef = useRef<InstancedMesh>(null);
    const capRef = useRef<InstancedMesh>(null);

    useEffect(() => {
        if (!postRef.current || !capRef.current) return;

        const _tempObj = new Object3D();
        const posts = [
            { x: -ENTRANCE_WIDTH / 2 - 0.8 * scale, z: -roomRadius, rotY: 0 },
            { x: ENTRANCE_WIDTH / 2 + 0.8 * scale, z: -roomRadius, rotY: 0 },
            { x: -ENTRANCE_WIDTH / 2 - 0.8 * scale, z: roomRadius, rotY: Math.PI },
            { x: ENTRANCE_WIDTH / 2 + 0.8 * scale, z: roomRadius, rotY: Math.PI }
        ];

        posts.forEach((p, i) => {
            // Post
            _tempObj.position.set(p.x, 9 * scale, p.z);
            _tempObj.rotation.set(0, p.rotY, 0);
            _tempObj.scale.set(scale, scale, scale);
            _tempObj.updateMatrix();
            postRef.current!.setMatrixAt(i, _tempObj.matrix);

            // Cap
            _tempObj.position.set(p.x, 18.2 * scale, p.z);
            _tempObj.updateMatrix();
            capRef.current!.setMatrixAt(i, _tempObj.matrix);
        });

        postRef.current.instanceMatrix.needsUpdate = true;
        capRef.current.instanceMatrix.needsUpdate = true;
        postRef.current.computeBoundingSphere();
        capRef.current.computeBoundingSphere();
    }, [roomRadius, scale]);

    return (
        <>
            <instancedMesh ref={postRef} args={[undefined, undefined, 4]}>
                <boxGeometry args={[2, 18, 3]} />
                <meshStandardMaterial color="#444444" roughness={0.85} metalness={0.1} />
            </instancedMesh>
            <instancedMesh ref={capRef} args={[undefined, undefined, 4]}>
                <boxGeometry args={[2.5, 0.5, 3.5]} />
                <primitive object={GOLD_TRIM_MATERIAL} attach="material" />
            </instancedMesh>
        </>
    );
});

// --- Central Altar ---
const CentralAltar = memo(function CentralAltar({ isCurrent = false, isPlayerInRoom = false, scale = 1, cz = ALTAR_ROOM_CENTER_Z }: { isCurrent?: boolean, isPlayerInRoom?: boolean, scale?: number, cz?: number }) {
    // Register walkable surfaces for the steps and obstacle for the altar block
    useEffect(() => {
        const idPrefix = `altar-${cz}`;

        // Step 1: bottom ring — cylinder r=13→12, top at Y=1.0
        const step1: WalkableSurface = {
            id: `${idPrefix}-step-1`,
            minX: -13 * scale, maxX: 13 * scale,
            minZ: cz - 13 * scale, maxZ: cz + 13 * scale,
            floorY: 1.0 * scale,
            shape: 'cylinder',
            radius: 13 * scale,
            sides: 8,
            centerX: 0,
            centerZ: cz,
        };
        // Step 2: middle ring — cylinder r=11→10, top at Y=2.0
        const step2: WalkableSurface = {
            id: `${idPrefix}-step-2`,
            minX: -11 * scale, maxX: 11 * scale,
            minZ: cz - 11 * scale, maxZ: cz + 11 * scale,
            floorY: 2.0 * scale,
            shape: 'cylinder',
            radius: 11 * scale,
            sides: 8,
            centerX: 0,
            centerZ: cz,
        };
        // Step 2.5 (Intermediate): between middle and top — cylinder r=10.0, top at Y=3.0
        const step2_5: WalkableSurface = {
            id: `${idPrefix}-step-2-5`,
            minX: -10 * scale, maxX: 10 * scale,
            minZ: cz - 10 * scale, maxZ: cz + 10 * scale,
            floorY: 3.0 * scale,
            shape: 'cylinder',
            radius: 10 * scale,
            sides: 8,
            centerX: 0,
            centerZ: cz,
        };
        registerSurfaces(idPrefix, [step1, step2, step2_5, {
            id: `${idPrefix}-top`,
            minX: -9 * scale, maxX: 9 * scale,
            minZ: cz - 9 * scale, maxZ: cz + 9 * scale,
            floorY: 4.1 * scale, // Slightly above the mesh top
            shape: 'cylinder',
            radius: 9 * scale,
            sides: 8,
            centerX: 0,
            centerZ: cz,
        }]);

        return () => {
            unregisterSurfaces(idPrefix);
        };
    }, [cz, scale]);
    return (
        <group position={[0, 0, 0]}>
            {/* Base platform - stepped */}
            <mesh position={[0, 0.5 * scale, 0]}>
                <cylinderGeometry args={[12 * scale, 13 * scale, 1 * scale, 8]} />
                <primitive object={ALTAR_STONE_MATERIAL} attach="material" />
            </mesh>
            <mesh position={[0, 1.5 * scale, 0]}>
                <cylinderGeometry args={[10 * scale, 11 * scale, 1 * scale, 8]} />
                <primitive object={ALTAR_STONE_MATERIAL} attach="material" />
            </mesh>

            {/* Main altar block */}
            <mesh position={[0, 3 * scale, 0]}>
                <cylinderGeometry args={[8 * scale, 9 * scale, 2 * scale, 8]} />
                <primitive object={ALTAR_TOP_MATERIAL} attach="material" />
            </mesh>

            {/* Altar top surface trim */}
            <mesh position={[0, 4.05 * scale, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[7.5 * scale, 8.2 * scale, 8]} />
                <primitive object={GOLD_TRIM_MATERIAL} attach="material" />
            </mesh>

            {/* Rune circle - outer ring */}
            <mesh position={[0, 4.1 * scale, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[5 * scale, 6 * scale, 16]} />
                <primitive object={RUNE_MATERIAL} attach="material" />
            </mesh>

            {/* Rune circle - inner ring */}
            <mesh position={[0, 4.12 * scale, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[2.5 * scale, 3.5 * scale, 16]} />
                <primitive object={RUNE_INNER_MATERIAL} attach="material" />
            </mesh>

            {/* Rune circle - center glyph */}
            <mesh position={[0, 4.14 * scale, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[1.5 * scale, 6]} />
                <primitive object={RUNE_INNER_MATERIAL} attach="material" />
            </mesh>

            {/* Single altar glow light - only in current room and when player is inside */}
            {isCurrent && isPlayerInRoom && (
                <pointLight
                    position={[0, 12 * scale, 0]}
                    intensity={500}
                    color="#8aaace"
                    distance={80 * scale}
                    decay={2}
                />
            )}
        </group>
    );
});

// --- Main AltarRoom Component ---
export const AltarRoom = memo(function AltarRoom({ index = 0 }: { index?: number }) {
    const groupRef = useRef<Group>(null);
    const frameCount = useRef(0);
    const [isVisible, setIsVisible] = useState(false);
    const [isPlayerInRoom, setIsPlayerInRoom] = useState(false);
    const [isPlayerInCorridor, setIsPlayerInCorridor] = useState(false);

    const roomRadius = getAltarRadius(index);
    const cz = getAltarCenterZ(index);
    const corridorLen = getAltarCorridorLength(index);
    const roomHeight = getAltarHeight(index);
    const scaleFactor = getAltarScaleFactor(index);

    // Visibility unmounting based on player distance
    useFrame(() => {
        // Throttle check to every 10 frames
        frameCount.current++;
        if (frameCount.current % 10 !== 0) return;

        const playerPos = usePlayerStore.getState().position;
        const [px, , pz] = playerPos;

        // Distance to room center (indexed)
        const dx = px; // center at X=0
        const dz = pz - cz;
        const distSq = dx * dx + dz * dz;

        // Visual radius varies. Use a generous culling radius that covers room + corridors
        const cullRadius = roomRadius + 220;
        const shouldBeVisible = distSq < cullRadius * cullRadius;

        if (shouldBeVisible !== isVisible) {
            setIsVisible(shouldBeVisible);
        }

        // Logic for room/corridor lighting:
        // Room check: circular
        const distToCenter = Math.sqrt(dx * dx + dz * dz);
        const inRoom = distToCenter < roomRadius + 2; // Precise boundary for room

        // Corridor check: rectangular (North Corridor)
        // dz is Pz - Cz. North corridor is at positive dz.
        const inCorridorZ = (dz >= roomRadius - 2) && (dz <= roomRadius + corridorLen + 5);
        const inCorridorX = Math.abs(dx) <= (ENTRANCE_WIDTH / 2) + 2;
        const inCorridor = inCorridorZ && inCorridorX;

        if (inRoom !== isPlayerInRoom) {
            setIsPlayerInRoom(inRoom);
        }
        if (inCorridor !== isPlayerInCorridor) {
            setIsPlayerInCorridor(inCorridor);
        }
    });

    // Calculate entrance opening angle for the south entrance
    const entranceAngle = useMemo(() => {
        if (ENTRANCE_WIDTH <= 0 || ENTRANCE_WIDTH >= roomRadius * 2) return 0;
        return 2 * Math.asin(ENTRANCE_WIDTH / (2 * roomRadius));
    }, [roomRadius]);

    // Wall segments with south entrance opening
    // Mesh has rotation=[0, π, 0] which flips theta: geometry θ=0 → world -Z
    // So opening at θ=0 faces -Z (south, toward the corridor)
    const wallSegments = useMemo(() => {
        const halfAngle = entranceAngle / 2;
        // Segment 1: From south-east to north-east
        const seg1Start = halfAngle;
        const seg1Length = Math.PI - entranceAngle;

        // Segment 2: From north-west to south-west
        const seg2Start = Math.PI + halfAngle;
        const seg2Length = Math.PI - entranceAngle;

        return [
            { thetaStart: seg1Start, thetaLength: seg1Length },
            { thetaStart: seg2Start, thetaLength: seg2Length }
        ];
    }, [entranceAngle]);

    // Lintel (wall above entrance arch) - scale vertically with room
    const archPeak = 17.5 * scaleFactor;
    const lintelHeight = roomHeight - archPeak;
    const lintelY = archPeak + lintelHeight / 2;

    // Statue angles (evenly spaced, avoiding the entrance)
    const statueAngles = useMemo(() => {
        const angles: number[] = [];
        const entranceCenter = 0; // θ=0 (maps to -Z after mesh rotation)
        const avoidAngle = 0.3; // Reduced — 30° offset already clears the entrance

        for (let i = 0; i < STATUE_COUNT; i++) {
            // Offset by 30° (π/6) so no statue lands on the entrance
            const angle = (i / STATUE_COUNT) * Math.PI * 2 + Math.PI / 8;
            // Distance from entrance center (handle wrap-around)
            let diff = Math.abs(angle - entranceCenter);
            if (diff > Math.PI) diff = 2 * Math.PI - diff;
            if (diff > avoidAngle) {
                angles.push(angle);
            }
        }
        return angles;
    }, []);

    // Compute fill wall positions to seal gaps between corridor walls and curved room wall
    const fillWallZ = useMemo(() => {
        return -roomRadius + 0.5; // Just past the entrance edge
    }, [roomRadius]);

    const altarRoomWave = useGameStore(state => state.altarRoomWave);
    const waveEnemiesRemaining = useGameStore(state => state.altarRoomWaveEnemiesRemaining);
    const currentAltarIndex = useGameStore(state => state.currentAltarIndex);

    // Dynamic Ritual Lighting Phases
    const isWaveActive = waveEnemiesRemaining > 0;
    const ritualPhase: 'normal' | 'phase4' | 'phase5' = useMemo(() => {
        if (altarRoomWave === 3 && !isWaveActive) return 'phase4'; // Buffer 3->4
        if (altarRoomWave === 4) return isWaveActive ? 'phase4' : 'phase5'; // Wave 4 or Buffer 4->5
        if (altarRoomWave === 5 && isWaveActive) return 'phase5'; // Wave 5
        return 'normal';
    }, [altarRoomWave, isWaveActive]);

    const MAX_WAVES = 5;

    useEffect(() => {
        const groupId = `altar-room-${index}`;

        const surfaces: WalkableSurface[] = [
            {
                id: `${groupId}-floor`,
                floorY: 0,
                minX: -roomRadius, maxX: roomRadius,
                minZ: cz - roomRadius, maxZ: cz + roomRadius,
                radius: roomRadius,
                centerX: 0,
                centerZ: cz
            },
            {
                id: `${groupId}-post-floor`,
                floorY: 0,
                minX: -ENTRANCE_WIDTH / 2, maxX: ENTRANCE_WIDTH / 2,
                minZ: cz + roomRadius, maxZ: cz + roomRadius + corridorLen
            }
        ];
        const obstacles: Obstacle[] = [
            // Altar itself
            {
                id: `${groupId}-central-altar`,
                minX: -9 * scaleFactor, maxX: 9 * scaleFactor,
                minZ: cz - 9 * scaleFactor, maxZ: cz + 9 * scaleFactor,
                minY: 0, maxY: 4.1 * scaleFactor, // Match walkable surface height
                radius: 9 * scaleFactor, shape: 'cylinder'
            },
            // North Corridor Walls
            {
                id: `${groupId}-wall-l`,
                minX: -ENTRANCE_WIDTH / 2 - 1, maxX: -ENTRANCE_WIDTH / 2,
                minZ: cz + roomRadius, maxZ: cz + roomRadius + corridorLen,
                minY: 0, maxY: roomHeight * 0.45
            },
            {
                id: `${groupId}-wall-r`,
                minX: ENTRANCE_WIDTH / 2, maxX: ENTRANCE_WIDTH / 2 + 1,
                minZ: cz + roomRadius, maxZ: cz + roomRadius + corridorLen,
                minY: 0, maxY: roomHeight * 0.45
            }
        ];

        registerSurfaces(groupId, surfaces);
        registerObstacles(groupId, obstacles);

        return () => {
            unregisterSurfaces(groupId);
            unregisterObstacles(groupId);
        };

    }, [index, currentAltarIndex, cz, roomRadius, corridorLen, entranceAngle, lintelY, lintelHeight, roomHeight, scaleFactor]);

    // Separate effect for the Gate - only needed for the current active room
    useEffect(() => {
        const groupId = `altar-room-gate-${index}`;
        // Only consider ritual complete if this IS the current altar and it's wave 6
        const isRitualComplete = (index === currentAltarIndex) && (altarRoomWave > MAX_WAVES);

        if (!isRitualComplete && !GAME_CONFIG.DISABLE_ALTAR_GATES) {
            registerObstacles(groupId, [{
                id: `${groupId}-gate`,
                minX: -ENTRANCE_WIDTH / 2, maxX: ENTRANCE_WIDTH / 2,
                minZ: cz + roomRadius + corridorLen - 5, maxZ: cz + roomRadius + corridorLen - 4, // Gate is 1m thick, 5m from end
                minY: 0, maxY: roomHeight
            }]);
        }

        // 5. Entrance Gate Collision (South)
        // Only active during ritual for the current altar
        const altarRitualStarted = useGameStore.getState().altarRitualStarted;
        const isRitualActive = index === currentAltarIndex && altarRitualStarted && altarRoomWave <= MAX_WAVES;
        if (isRitualActive && !GAME_CONFIG.DISABLE_ALTAR_GATES) {
            registerObstacles(`${groupId}-entrance`, [{
                id: `${groupId}-entrance-gate`,
                minX: -ENTRANCE_WIDTH / 2, maxX: ENTRANCE_WIDTH / 2,
                minZ: cz - roomRadius - 1, maxZ: cz - roomRadius, // World Z coordinates
                minY: 0, maxY: roomHeight
            }]);
        }

        return () => {
            unregisterObstacles(groupId);
            unregisterObstacles(`${groupId}-entrance`);
        };
    }, [index, currentAltarIndex, altarRoomWave, cz, roomRadius, corridorLen, roomHeight]);

    return (
        <group ref={groupRef} position={[0, 0, cz]} visible={isVisible}>
            {/* Base Room Lighting — on when in room OR in the corridor */}
            {(isPlayerInRoom || isPlayerInCorridor) && (
                <group>
                    <ambientLight intensity={0.15 * scaleFactor} color="#bbc8dd" />

                    {/* Main room light — stays on in corridor, but dims/colors based on wave */}
                    <pointLight
                        position={[0, roomHeight * 0.75, 0]}
                        intensity={ritualPhase === 'normal' ? 90 * scaleFactor : (ritualPhase === 'phase4' ? 40 * scaleFactor : 60 * scaleFactor)}
                        distance={200 * scaleFactor}
                        decay={1}
                        color={ritualPhase === 'phase5' ? '#ff4444' : '#baddff'}
                    />
                </group>
            )}

            {/* Room-Specific Decorative Lighting — only when purely inside the room */}
            {isPlayerInRoom && (
                <group>
                    {/* Entrance portal lights (South) */}
                    <pointLight position={[-ENTRANCE_WIDTH / 2, 12 * scaleFactor, -roomRadius + 2]} intensity={15} color="#ffcc88" distance={15 * scaleFactor} decay={2} />
                    <pointLight position={[ENTRANCE_WIDTH / 2, 12 * scaleFactor, -roomRadius + 2]} intensity={15} color="#ffcc88" distance={15 * scaleFactor} decay={2} />
                </group>
            )}

            {/* Corridor lights — only when player is in the corridor and NOT in the room */}
            {isPlayerInCorridor && !isPlayerInRoom && (
                <group>
                    {index === currentAltarIndex && (
                        <>
                            <pointLight position={[0, roomHeight * 0.35, roomRadius + corridorLen / 2 - corridorLen / 4]} intensity={100} distance={80 * scaleFactor} color="#baddff" decay={2} />
                            <pointLight position={[0, roomHeight * 0.35, roomRadius + corridorLen / 2 + corridorLen / 4]} intensity={100} distance={80 * scaleFactor} color="#baddff" decay={2} />
                        </>
                    )}
                </group>
            )}

            {/* Floor */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
                <circleGeometry args={[roomRadius, 32]} />
                <primitive object={STONE_FLOOR_MATERIAL} attach="material" />
            </mesh>

            {/* Floor accent ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
                <ringGeometry args={[roomRadius - 3 * scaleFactor, roomRadius - 1 * scaleFactor, 32]} />
                <primitive object={GOLD_TRIM_MATERIAL} attach="material" />
            </mesh>

            {/* Walls — cylindrical with south entrance opening */}
            {wallSegments.map((seg, i) => (
                <mesh key={`wall-${i}`} position={[0, roomHeight / 2, 0]} rotation={[0, Math.PI, 0]}>
                    <cylinderGeometry
                        args={[roomRadius, roomRadius, roomHeight, 32, 1, true, seg.thetaStart, seg.thetaLength]}
                        attach="geometry"
                    />
                    <primitive object={DARK_STONE_MATERIAL} attach="material" />
                </mesh>
            ))}

            {/* Top Ceiling Trim */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, roomHeight, 0]}>
                <ringGeometry args={[roomRadius - 1 * scaleFactor, roomRadius, 32]} />
                <primitive object={GOLD_TRIM_MATERIAL} attach="material" />
            </mesh>

            {/* Lintel above south entrance */}
            <mesh position={[0, lintelY, 0]} rotation={[0, Math.PI, 0]}>
                <cylinderGeometry
                    args={[roomRadius, roomRadius, lintelHeight, 16, 1, true, 2 * Math.PI - entranceAngle / 2, entranceAngle]}
                    attach="geometry"
                />
                <primitive object={DARK_STONE_MATERIAL} attach="material" />
            </mesh>

            {/* Lintel above north exit */}
            <mesh position={[0, lintelY, 0]} rotation={[0, 0, 0]}>
                <cylinderGeometry
                    args={[roomRadius, roomRadius, lintelHeight, 16, 1, true, Math.PI - entranceAngle / 2, entranceAngle]}
                    attach="geometry"
                />
                <primitive object={DARK_STONE_MATERIAL} attach="material" />
            </mesh>

            {/* === PORTALS (INSTANCED) === */}
            <InstancedPortals roomRadius={roomRadius} />

            {/* === ENTRANCE PORTAL (SOUTH) === */}
            <group position={[0, 0, -roomRadius]}>
                {/* Horizontal lintel */}
                <mesh position={[0, 18, 0]}>
                    <boxGeometry args={[ENTRANCE_WIDTH + 2, 2, 3]} />
                    <meshStandardMaterial color="#555555" roughness={0.7} metalness={0.2} />
                </mesh>
                {/* Entrance "void" shadow effect */}
                <mesh position={[0, 9 * scaleFactor, 1]}>
                    <boxGeometry args={[ENTRANCE_WIDTH + 0.5, 18.5 * scaleFactor, 0.5]} />
                    <meshStandardMaterial color="#000000" transparent opacity={0.5} />
                </mesh>
                {/* Ritual Entrance Gate Visual */}
                {index === currentAltarIndex && altarRoomWave > 0 && altarRoomWave <= MAX_WAVES && !GAME_CONFIG.DISABLE_ALTAR_GATES && (
                    <mesh position={[0, 9 * scaleFactor, 0]}>
                        <boxGeometry args={[ENTRANCE_WIDTH, 18 * scaleFactor, 0.5]} />
                        <meshStandardMaterial
                            color="#2a4a6a" // Darker blue for more depth
                            transparent
                            opacity={0.6}
                            emissive="#4a8aca"
                            emissiveIntensity={0.4} // Reduced intensity to avoid "white wall" effect
                        />
                    </mesh>
                )}
            </group>

            {/* === EXIT PORTAL (NORTH) === */}
            <group position={[0, 0, roomRadius]} rotation={[0, Math.PI, 0]}>
                {/* Horizontal lintel */}
                <mesh position={[0, 18 * scaleFactor, 0]}>
                    <boxGeometry args={[ENTRANCE_WIDTH + 2, 2 * scaleFactor, 3]} />
                    <meshStandardMaterial color="#555555" roughness={0.7} metalness={0.2} />
                </mesh>
                {/* Exit "void" shadow effect */}
                <mesh position={[0, 9 * scaleFactor, 1]}>
                    <boxGeometry args={[ENTRANCE_WIDTH + 0.5, 18.5 * scaleFactor, 0.5]} />
                    <meshStandardMaterial color="#000000" transparent opacity={0.5} />
                </mesh>
            </group>

            {/* === CEILING DOME === */}
            <group position={[0, roomHeight - 1, 0]}>
                <mesh>
                    <sphereGeometry args={[roomRadius, 32, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
                    <primitive object={DARK_STONE_MATERIAL} attach="material" />
                </mesh>
                <mesh position={[0, -roomHeight * 0.15, 0]}>
                    <torusGeometry args={[roomRadius * 0.12, 0.8 * scaleFactor, 8, 24]} />
                    <primitive object={GOLD_TRIM_MATERIAL} attach="material" />
                </mesh>
            </group>

            {/* Statues & Pedestals around the perimeter */}
            <InstancedStatues
                isCurrent={index === currentAltarIndex}
                isPlayerInRoom={isPlayerInRoom && ritualPhase === 'normal'}
                count={STATUE_COUNT}
                radius={roomRadius - 12.5 * scaleFactor}
                scale={scaleFactor}
            />

            {/* === NORTH CORRIDOR === */}
            <group position={[0, 0, roomRadius + corridorLen / 2]}>
                <mesh position={[0, 0.02, 0]} receiveShadow>
                    <boxGeometry args={[ENTRANCE_WIDTH, 0.1, corridorLen]} />
                    <primitive object={STONE_FLOOR_MATERIAL} attach="material" />
                </mesh>
                <mesh position={[0, roomHeight * 0.45, 0]} receiveShadow>
                    <boxGeometry args={[ENTRANCE_WIDTH, 0.1, corridorLen]} />
                    <primitive object={DARK_STONE_MATERIAL} attach="material" />
                </mesh>
                <mesh position={[-ENTRANCE_WIDTH / 2 - 0.5, roomHeight * 0.225, 0]} receiveShadow>
                    <boxGeometry args={[1, roomHeight * 0.45, corridorLen]} />
                    <meshStandardMaterial color="#222222" roughness={0.9} metalness={0.05} />
                </mesh>
                <mesh position={[ENTRANCE_WIDTH / 2 + 0.5, roomHeight * 0.225, 0]} receiveShadow>
                    <boxGeometry args={[1, roomHeight * 0.45, corridorLen]} />
                    <meshStandardMaterial color="#222222" roughness={0.9} metalness={0.05} />
                </mesh>

                {/* Corridor lights - dimmed significantly to avoid washing out the fog */}

                {/* Gate visual */}
                {!GAME_CONFIG.DISABLE_ALTAR_GATES && !((index === currentAltarIndex) && (altarRoomWave > MAX_WAVES)) && (
                    <mesh position={[0, 9 * scaleFactor, -corridorLen / 2 + 5]}>
                        <boxGeometry args={[ENTRANCE_WIDTH, 18 * scaleFactor, 0.5]} />
                        <meshStandardMaterial
                            color="#baddff"
                            transparent
                            opacity={0.3}
                            emissive="#baddff"
                            emissiveIntensity={0.5}
                        />
                    </mesh>
                )}
            </group>



            <CentralAltar isCurrent={index === currentAltarIndex} isPlayerInRoom={isPlayerInRoom} scale={scaleFactor} cz={cz} />
        </group >
    );
});

export default AltarRoom;
