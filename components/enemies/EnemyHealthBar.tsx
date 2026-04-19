'use client';

import { useMemo, createContext, useContext, useRef, useEffect, useState, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { Group, InstancedMesh, Matrix4, Color, Quaternion, Vector3 } from 'three';

// --- Types ---
export type EnemyTypeName = 'trumpet' | 'trombone' | 'tuba' | 'french_horn' | 'euphonium';
export type DamageTextType = 'normal' | 'crit' | 'superCrit';

interface HealthBarInstanceData {
    bg: InstancedMesh;
    fill: InstancedMesh;
    border: InstancedMesh;
    requestIndex: () => number;
    releaseIndex: (index: number) => void;
    requestUpdate: () => void; // New method to mark as dirty
}

export const EnemyHealthBarContext = createContext<HealthBarInstanceData | null>(null);

// --- Constants ---
const MAX_INSTANCES = 500;
const SHARED_PLANE_GEO = new THREE.PlaneGeometry(1, 1);

const ENEMY_TYPE_COLORS: Record<EnemyTypeName, { accent: string; border: string; label: string }> = {
    trumpet: { accent: '#f59e0b', border: '#b45309', label: 'Trumpet' },
    trombone: { accent: '#f97316', border: '#c2410c', label: 'Trombone' },
    tuba: { accent: '#dc2626', border: '#991b1b', label: 'Tuba' },
    french_horn: { accent: '#400379', border: '#323232', label: 'French Horn' },
    euphonium: { accent: '#3b82f6', border: '#1d4ed8', label: 'Euphonium' },
};

// --- Instances Manager ---
export function EnemyHealthBarInstances({ children }: { children: React.ReactNode }) {
    const bgRef = useRef<InstancedMesh>(null!);
    const fillRef = useRef<InstancedMesh>(null!);
    const borderRef = useRef<InstancedMesh>(null!);

    // Index management - use a stack to recycle indices
    const freeIndicesStack = useRef<number[]>([]);
    const isDirty = useRef(false);

    useEffect(() => {
        // Initialize pool once
        if (freeIndicesStack.current.length === 0) {
            const arr = new Array(MAX_INSTANCES);
            for (let i = 0; i < MAX_INSTANCES; i++) arr[i] = (MAX_INSTANCES - 1) - i;
            freeIndicesStack.current = arr;
        }
    }, []);

    const requestIndex = useCallback(() => {
        const index = freeIndicesStack.current.pop();
        return index !== undefined ? index : -1;
    }, []);

    const releaseIndex = useCallback((index: number) => {
        if (index === -1) return;

        if (bgRef.current && fillRef.current && borderRef.current) {
            const identity = new Matrix4().makeScale(0, 0, 0);
            bgRef.current.setMatrixAt(index, identity);
            fillRef.current.setMatrixAt(index, identity);
            borderRef.current.setMatrixAt(index, identity);
        }

        freeIndicesStack.current.push(index);
    }, []);

    const requestUpdate = useCallback(() => {
        isDirty.current = true;
    }, []);

    const contextValue = useMemo(() => ({
        bg: bgRef.current,
        fill: fillRef.current,
        border: borderRef.current,
        requestIndex,
        releaseIndex,
        requestUpdate
    }), [requestIndex, releaseIndex, requestUpdate]);

    // Update refs in context value when they mount
    useEffect(() => {
        contextValue.bg = bgRef.current;
        contextValue.fill = fillRef.current;
        contextValue.border = borderRef.current;

        // Initialize all instances to 0 scale to prevent flashing at (0,0,0)
        const identity = new THREE.Matrix4().makeScale(0, 0, 0);
        for (let i = 0; i < MAX_INSTANCES; i++) {
            bgRef.current.setMatrixAt(i, identity);
            fillRef.current.setMatrixAt(i, identity);
            borderRef.current.setMatrixAt(i, identity);
        }
        bgRef.current.instanceMatrix.needsUpdate = true;
        fillRef.current.instanceMatrix.needsUpdate = true;
        borderRef.current.instanceMatrix.needsUpdate = true;
    }, [contextValue]);

    useFrame(() => {
        if (!isDirty.current) return;
        isDirty.current = false;

        if (bgRef.current) bgRef.current.instanceMatrix.needsUpdate = true;
        if (fillRef.current) fillRef.current.instanceMatrix.needsUpdate = true;
        if (borderRef.current) {
            borderRef.current.instanceMatrix.needsUpdate = true;
            if (borderRef.current.instanceColor) borderRef.current.instanceColor.needsUpdate = true;
        }
        if (fillRef.current && fillRef.current.instanceColor) {
            fillRef.current.instanceColor.needsUpdate = true;
        }
    });

    return (
        <EnemyHealthBarContext.Provider value={contextValue}>
            <instancedMesh ref={borderRef} args={[SHARED_PLANE_GEO, undefined, MAX_INSTANCES]} frustumCulled={false} renderOrder={998}>
                <meshBasicMaterial transparent depthWrite={false} color="white" />
            </instancedMesh>
            <instancedMesh ref={bgRef} args={[SHARED_PLANE_GEO, undefined, MAX_INSTANCES]} frustumCulled={false} renderOrder={999}>
                <meshBasicMaterial transparent depthWrite={false} color="#1a1a1a" />
            </instancedMesh>
            <instancedMesh ref={fillRef} args={[SHARED_PLANE_GEO, undefined, MAX_INSTANCES]} frustumCulled={false} renderOrder={1000}>
                <meshBasicMaterial transparent depthWrite={false} color="white" />
            </instancedMesh>
            {children}
        </EnemyHealthBarContext.Provider>
    );
}

// --- Individual Health Bar ---
export interface EnemyHealthBarProps {
    healthRef: React.MutableRefObject<number>;
    maxHealth: number;
    level: number;
    enemyType?: EnemyTypeName;
    damageTextRef?: React.MutableRefObject<{ value: number, time: number, type?: 'normal' | 'crit' | 'superCrit' } | null>;
    playerDistanceRef: React.MutableRefObject<number>;
    yOffset?: number; // Custom height offset
    /** 
     * Optimizing: Passing the current world position ref from the parent 
     * eliminates the need for expensive Matrix4.getWorldPosition calls.
     */
    enemyPosRef?: React.MutableRefObject<THREE.Vector3>;
    visible?: boolean;
}

// Reusable vectors/matrices to avoid GC pressure
const _tempMatrix = new Matrix4();
const _tempPos = new Vector3();
const _tempPos2 = new Vector3();
const _tempScale = new Vector3();
const _tempColor = new Color();
const _tempOffset = new Vector3();
const _tempQuat = new Quaternion();


export function EnemyHealthBar({
    healthRef,
    maxHealth,
    level,
    enemyType = 'trumpet',
    damageTextRef,
    playerDistanceRef,
    yOffset = 2.4,
    enemyPosRef,
    visible = true
}: EnemyHealthBarProps) {
    const manager = useContext(EnemyHealthBarContext);
    const indexRef = useRef<number>(-1);

    // Billboarding helpers
    const { camera } = useThree();
    const rootRef = useRef<Group>(null!);

    const barWidth = 3.0;
    const barHeight = 0.25;
    const borderSize = 0.04;
    const SIGHT_RANGE = 100;

    const hpTextRef = useRef<any>(null);
    const damageTextCompRef = useRef<any>(null);

    // Performance tracking
    const lastRatio = useRef(-1);
    const lastUpdateFrame = useRef(0);

    // Request index on mount
    useEffect(() => {
        if (manager) {
            indexRef.current = manager.requestIndex();
        }
        return () => {
            if (manager && indexRef.current !== -1) {
                manager.releaseIndex(indexRef.current);
            }
        };
    }, [manager]);

    useFrame((state) => {
        if (!playerDistanceRef || indexRef.current === -1 || !manager) return;

        const dist = playerDistanceRef.current;
        const currentHealth = healthRef.current;
        const isVisible = visible && (dist <= 60 || (dist <= SIGHT_RANGE && currentHealth < maxHealth));

        // Update Text components (non-instanced)
        if (rootRef.current) {
            rootRef.current.visible = isVisible;
            if (isVisible) {
                // Manual Billboard
                rootRef.current.quaternion.copy(camera.quaternion);
                if (rootRef.current.parent) {
                    rootRef.current.parent.getWorldQuaternion(_tempQuat).invert();
                    rootRef.current.quaternion.premultiply(_tempQuat);

                    // Cancel out parent scale
                    rootRef.current.parent.getWorldScale(_tempScale);
                    rootRef.current.scale.set(1 / _tempScale.x, 1 / _tempScale.y, 1 / _tempScale.z);
                }
            }
        }

        if (!isVisible) {
            // Hide instanced elements by scaling to 0
            _tempMatrix.makeScale(0, 0, 0);
            manager.bg.setMatrixAt(indexRef.current, _tempMatrix);
            manager.fill.setMatrixAt(indexRef.current, _tempMatrix);
            manager.border.setMatrixAt(indexRef.current, _tempMatrix);
            manager.requestUpdate();
            return;
        }

        /**
         * PERFORMANCE OPTIMIZATION: Gradual Tiered Rendering (Frame Skipping)
         * Curve: 1, 2, 4, 8, 16 frames based on distance.
         */
        let frameMod = 1;
        if (dist > 75) frameMod = 16;
        else if (dist > 60) frameMod = 8;
        else if (dist > 45) frameMod = 4;
        else if (dist > 30) frameMod = 2;

        const frameId = Math.floor(state.clock.elapsedTime * 60) + indexRef.current;
        if (frameId % frameMod !== 0) return;

        const ratio = Math.max(0, Math.min(1, currentHealth / maxHealth));

        // Skip intensive matrix update if health hasn't changed and stationary (at distance)
        if (ratio === lastRatio.current && frameMod > 2) {
            if (state.clock.elapsedTime - lastUpdateFrame.current < 0.25) return;
        }

        lastRatio.current = ratio;
        lastUpdateFrame.current = state.clock.elapsedTime;

        // Calculate world position for the bar
        // Optimization: Use passed ref from parent to bypass getWorldPosition recursion
        if (enemyPosRef?.current) {
            _tempPos.copy(enemyPosRef.current);
            _tempPos.y += yOffset;
        } else {
            rootRef.current.getWorldPosition(_tempPos);
        }

        const camQuat = camera.quaternion;
        const typeStyle = ENEMY_TYPE_COLORS[enemyType] || ENEMY_TYPE_COLORS.trumpet;

        // 1. Update Border (Furthest back)
        _tempScale.set(barWidth + borderSize * 2, barHeight + borderSize * 2, 1);
        _tempOffset.set(0, 0, 0.02).applyQuaternion(camQuat);
        _tempPos2.copy(_tempPos).add(_tempOffset);
        _tempMatrix.compose(_tempPos2, camQuat, _tempScale);
        manager.border.setMatrixAt(indexRef.current, _tempMatrix);
        manager.border.setColorAt(indexRef.current, _tempColor.set(typeStyle.border));

        // 2. Update Background (Middle)
        _tempScale.set(barWidth, barHeight, 1);
        _tempOffset.set(0, 0, 0.01).applyQuaternion(camQuat);
        _tempPos2.copy(_tempPos).add(_tempOffset);
        _tempMatrix.compose(_tempPos2, camQuat, _tempScale);
        manager.bg.setMatrixAt(indexRef.current, _tempMatrix);

        // 3. Update Fill (Front of bars)
        const fillWidth = Math.max(0.001, ratio * barWidth);
        _tempScale.set(fillWidth, barHeight - 0.02, 1);
        _tempOffset.set(-barWidth / 2 + fillWidth / 2, 0, 0).applyQuaternion(camQuat);
        _tempPos2.copy(_tempPos).add(_tempOffset);
        _tempMatrix.compose(_tempPos2, camQuat, _tempScale);
        manager.fill.setMatrixAt(indexRef.current, _tempMatrix);
        manager.fill.setColorAt(indexRef.current, _tempColor.set(typeStyle.accent));

        manager.requestUpdate();


        // Update Text
        if (hpTextRef.current) {
            if (dist < 25) {
                hpTextRef.current.visible = true;
                hpTextRef.current.text = `${Math.ceil(currentHealth)} / ${Math.ceil(maxHealth)}`;
            } else {
                hpTextRef.current.visible = false;
            }
        }

        if (damageTextCompRef.current && damageTextRef?.current) {
            const dt = damageTextRef.current;
            const timeSince = Date.now() - dt.time;
            if (timeSince < 1000 && dist < 40) {
                damageTextCompRef.current.visible = true;
                let damageColor = "#ffffff";
                let damageSize = 0.4;
                let damagePrefix = "-";
                if (dt.type === 'crit') { damageColor = "#f59e0b"; damageSize = 0.6; damagePrefix = "CRIT! -"; }
                else if (dt.type === 'superCrit') { damageColor = "#ef4444"; damageSize = 0.8; damagePrefix = "SUPER CRIT! -"; }
                damageTextCompRef.current.text = `${damagePrefix}${dt.value}`;
                damageTextCompRef.current.color = damageColor;
                damageTextCompRef.current.fontSize = damageSize;
                const opacity = timeSince > 700 ? 1 - ((timeSince - 700) / 300) : 1;
                damageTextCompRef.current.fillOpacity = opacity;
                damageTextCompRef.current.outlineOpacity = opacity;
            } else {
                damageTextCompRef.current.visible = false;
            }
        }
    });

    const typeStyle = ENEMY_TYPE_COLORS[enemyType] || ENEMY_TYPE_COLORS.trumpet;

    return (
        <group ref={rootRef} position={[0, yOffset, 0]} visible={false}>
            {/* Enemy Type + Level Text */}
            <Text
                position={[0, barHeight / 2 + 0.18, -0.05]} // Negative Z to be in front of instanced bars
                fontSize={0.32}
                color={typeStyle.accent}
                outlineWidth={0.04}
                outlineColor="#000000"
                anchorX="center"
                anchorY="bottom"
            >
                {typeStyle.label} LV {level}
            </Text>

            {/* HP Fraction */}
            <Text
                ref={hpTextRef}
                visible={false}
                position={[0, -(barHeight / 2) - 0.08, -0.05]} // Negative Z
                fontSize={0.18}
                color="#f0f8ff"
                outlineWidth={0.025}
                outlineColor="#000000"
                anchorX="center"
                anchorY="top"
            >
                _
            </Text>

            {/* Damage Text Pop */}
            <Text
                ref={damageTextCompRef}
                visible={false}
                position={[0, barHeight / 2 + 0.65, 0.05]}
                fontSize={0.4}
                color="#ffffff"
                outlineWidth={0.05}
                outlineColor="#000000"
                anchorX="center"
                anchorY="bottom"
            >
                -
            </Text>
        </group>
    );
}

export default EnemyHealthBar;
