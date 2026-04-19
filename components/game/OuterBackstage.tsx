'use client';

import { useRef, memo, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { usePlayerStore, useGameStore } from '@/lib/store';
import { Group, MeshStandardMaterial, Color, BackSide, DoubleSide } from 'three';
import * as THREE from 'three';
import { registerSurfaces, unregisterSurfaces } from '@/lib/game/stairCollision';
import type { WalkableSurface } from '@/lib/game/stairCollision';

const RING_INNER_RADIUS = 570;
const RING_WIDTH = 250;
const RING_OUTER_RADIUS = RING_INNER_RADIUS + RING_WIDTH;
const RING_CENTER_RADIUS = (RING_INNER_RADIUS + RING_OUTER_RADIUS) / 2;
const RING_HEIGHT = 100;

const ARC_START = (3 * Math.PI) / 4;
const ARC_SWEEP = (3 * Math.PI) / 2;
const ARC_END = ARC_START + ARC_SWEEP;

const FLOOR_THETA_START = -Math.PI / 4;
const FLOOR_THETA_LENGTH = (3 * Math.PI) / 2;
const WALL_THETA_START = Math.PI / 4;
const WALL_THETA_LENGTH = (3 * Math.PI) / 2;

const SEGMENT_COUNT = 16;

const RING_FLOOR_MATERIAL = new MeshStandardMaterial({ color: '#5a5a5a', roughness: 0.7, metalness: 0.1 });
const RING_WALL_MATERIAL = new MeshStandardMaterial({ color: '#3a3a4a', roughness: 0.7, metalness: 0.15, side: BackSide, emissive: '#111122', emissiveIntensity: 0.15 });
const RING_WALL_FRONT_MATERIAL = new MeshStandardMaterial({ color: '#3a3a4a', roughness: 0.7, metalness: 0.15, emissive: '#111122', emissiveIntensity: 0.15 });
const RING_CEILING_MATERIAL = new MeshStandardMaterial({ color: '#333340', roughness: 0.8, metalness: 0.1, side: DoubleSide });
const RING_TRIM_MATERIAL = new MeshStandardMaterial({ color: '#c9a96e', roughness: 0.3, metalness: 0.7, emissive: '#8a6a3a', emissiveIntensity: 0.3 });

export const OuterBackstage = memo(function OuterBackstage() {
    const [isVisible, setIsVisible] = useState(false);
    const lastCheckTime = useRef(0);

    useFrame((state) => {
        const now = state.clock.elapsedTime;
        if (now - lastCheckTime.current < 0.25) return;
        lastCheckTime.current = now;

        const pos = usePlayerStore.getState().position;
        const distSq = pos[0] * pos[0] + pos[2] * pos[2];
        const playerAngle = Math.atan2(pos[2], pos[0]);
        const wrappedAngle = playerAngle < 0 ? playerAngle + 2 * Math.PI : playerAngle;
        const inNorthernGap = wrappedAngle > Math.PI / 4 + 0.15 && wrappedAngle < 3 * Math.PI / 4 - 0.15;

        const shouldBeVisible = distSq > 400 * 400 && distSq < 950 * 950 && !inNorthernGap;
        if (shouldBeVisible !== isVisible) setIsVisible(shouldBeVisible);
    });

    const segments = useMemo(() => {
        const segs = [];
        for (let i = 0; i < SEGMENT_COUNT; i++) {
            const startAngle = ARC_START + (i / SEGMENT_COUNT) * ARC_SWEEP;
            const endAngle = ARC_START + ((i + 1) / SEGMENT_COUNT) * ARC_SWEEP;
            segs.push({ startAngle, endAngle, midAngle: (startAngle + endAngle) / 2 });
        }
        return segs;
    }, []);

    useEffect(() => {
        const surfaces: WalkableSurface[] = segments.map((seg, i) => {
            const cos1 = Math.cos(seg.startAngle), sin1 = Math.sin(seg.startAngle);
            const cos2 = Math.cos(seg.endAngle), sin2 = Math.sin(seg.endAngle);
            const cosM = Math.cos(seg.midAngle), sinM = Math.sin(seg.midAngle);
            const xs = [cos1 * RING_INNER_RADIUS, cos1 * RING_OUTER_RADIUS, cos2 * RING_INNER_RADIUS, cos2 * RING_OUTER_RADIUS, cosM * RING_INNER_RADIUS, cosM * RING_OUTER_RADIUS];
            const zs = [sin1 * RING_INNER_RADIUS, sin1 * RING_OUTER_RADIUS, sin2 * RING_INNER_RADIUS, sin2 * RING_OUTER_RADIUS, sinM * RING_INNER_RADIUS, sinM * RING_OUTER_RADIUS];
            return {
                id: `outer-backstage-seg-${i}`, floorY: 0,
                minX: Math.min(...xs) - 5, maxX: Math.max(...xs) + 5,
                minZ: Math.min(...zs) - 5, maxZ: Math.max(...zs) + 5,
            };
        });
        registerSurfaces('outer-backstage', surfaces);
        return () => unregisterSurfaces('outer-backstage');
    }, [segments]);

    if (!isVisible) return null;

    return (
        <group>
            {/* Merged Floor - SINGLE MESH */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
                <ringGeometry args={[RING_INNER_RADIUS, RING_OUTER_RADIUS, 64, 1, FLOOR_THETA_START, FLOOR_THETA_LENGTH]} />
                <primitive object={RING_FLOOR_MATERIAL} attach="material" />
            </mesh>

            <mesh position={[0, RING_HEIGHT / 2, 0]}>
                <cylinderGeometry args={[RING_INNER_RADIUS, RING_INNER_RADIUS, RING_HEIGHT, 64, 1, true, WALL_THETA_START, WALL_THETA_LENGTH]} />
                <primitive object={RING_WALL_FRONT_MATERIAL} attach="material" />
            </mesh>

            <mesh position={[0, RING_HEIGHT / 2, 0]}>
                <cylinderGeometry args={[RING_OUTER_RADIUS, RING_OUTER_RADIUS, RING_HEIGHT, 64, 1, true, WALL_THETA_START, WALL_THETA_LENGTH]} />
                <primitive object={RING_WALL_MATERIAL} attach="material" />
            </mesh>

            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, RING_HEIGHT, 0]}>
                <ringGeometry args={[RING_INNER_RADIUS, RING_OUTER_RADIUS, 64, 1, FLOOR_THETA_START, FLOOR_THETA_LENGTH]} />
                <primitive object={RING_CEILING_MATERIAL} attach="material" />
            </mesh>

            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
                <ringGeometry args={[RING_INNER_RADIUS, RING_INNER_RADIUS + 3, 64, 1, FLOOR_THETA_START, FLOOR_THETA_LENGTH]} />
                <primitive object={RING_TRIM_MATERIAL} attach="material" />
            </mesh>

            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
                <ringGeometry args={[RING_OUTER_RADIUS - 3, RING_OUTER_RADIUS, 64, 1, FLOOR_THETA_START, FLOOR_THETA_LENGTH]} />
                <primitive object={RING_TRIM_MATERIAL} attach="material" />
            </mesh>

            <ArcEndCap angle={ARC_START} />
            <ArcEndCap angle={ARC_END} />
            <RingLights segments={segments} />
        </group>
    );
});

const ArcEndCap = memo(function ArcEndCap({ angle }: { angle: number }) {
    return (
        <mesh position={[Math.cos(angle) * RING_CENTER_RADIUS, RING_HEIGHT / 2, Math.sin(angle) * RING_CENTER_RADIUS]} rotation={[0, -angle + Math.PI / 2, 0]}>
            <boxGeometry args={[RING_WIDTH, RING_HEIGHT, 2]} />
            <primitive object={RING_WALL_FRONT_MATERIAL} attach="material" />
        </mesh>
    );
});

const RingLights = memo(function RingLights({ segments }: { segments: { midAngle: number }[] }) {
    const groupRef = useRef<Group>(null);
    const lastCheckTime = useRef(0);

    useFrame((state) => {
        if (!groupRef.current) return;
        const now = state.clock.elapsedTime;
        if (now - lastCheckTime.current < 0.2) return;
        lastCheckTime.current = now;

        const pos = usePlayerStore.getState().position;
        const distSq = pos[0] * pos[0] + pos[2] * pos[2];
        const isSimulationActive = useGameStore.getState().simulationActive;
        groupRef.current.visible = isSimulationActive && distSq > 400 * 400;
    });

    return (
        <group ref={groupRef}>
            {segments.filter((_, i) => i % 4 === 0).map((seg, i) => (
                <pointLight key={i} position={[Math.cos(seg.midAngle) * RING_CENTER_RADIUS, RING_HEIGHT - 3, Math.sin(seg.midAngle) * RING_CENTER_RADIUS]} intensity={1200} color="#baddff" distance={450} decay={2} />
            ))}
        </group>
    );
});

export { RING_CENTER_RADIUS, RING_INNER_RADIUS, RING_OUTER_RADIUS, ARC_START, ARC_SWEEP, ARC_END };
export default OuterBackstage;
