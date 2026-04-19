'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore, usePlayerStore } from '@/lib/store';
import { AltarRoom } from './AltarRoom';
import { AltarRoomWaveSpawner } from '../enemies/AltarRoomWaveSpawner';
import { getAltarCenterZ } from '@/lib/game/altarGeometry';

/**
 * AltarManager Component
 * 
 * Manages the sequence of 100 repeating Altar Rooms.
 * Handles rendering, culling, and positioning of rooms based on both ritual status and player location.
 */

const TOTAL_ALTARS = 100;

export function AltarManager() {
    const currentAltarIndex = useGameStore(state => state.currentAltarIndex);
    const [activeIndices, setActiveIndices] = useState<number[]>([]);
    const lastCheckTime = useRef(0);
    const activeSetRef = useRef(new Set<number>());

    useFrame((state) => {
        const now = state.clock.getElapsedTime();
        // Check every 0.1 seconds (100ms) - plenty responsive for room spawning
        if (now - lastCheckTime.current < 0.1) return;

        // Safety: only run calculations if simulation is active
        if (!useGameStore.getState().simulationActive) return;

        lastCheckTime.current = now;

        const playerZ = usePlayerStore.getState().position[2];

        // 1. Find the altar index closest to the player's physical position
        let playerAltarIndex = 0;
        let minDist = Infinity;
        for (let i = 0; i < TOTAL_ALTARS; i++) {
            const cz = getAltarCenterZ(i);
            const dist = Math.abs(playerZ - cz);
            if (dist < minDist) {
                minDist = dist;
                playerAltarIndex = i;
            }
        }

        // 2. Identify active indices (window around ritual and player)
        const activeSet = activeSetRef.current;
        activeSet.clear();
        // Ritual window
        for (let i = currentAltarIndex - 1; i <= currentAltarIndex + 1; i++) {
            if (i >= 0 && i < TOTAL_ALTARS) activeSet.add(i);
        }
        // Player window
        for (let i = playerAltarIndex - 1; i <= playerAltarIndex + 1; i++) {
            if (i >= 0 && i < TOTAL_ALTARS) activeSet.add(i);
        }

        // 3. Build sorted array and update state only if indices actually changed
        let changed = activeSet.size !== activeIndices.length;
        if (!changed) {
            for (const val of activeSet) {
                if (!activeIndices.includes(val)) { changed = true; break; }
            }
        }
        if (changed) {
            const newActive: number[] = [];
            for (const val of activeSet) newActive.push(val);
            newActive.sort((a, b) => a - b);
            setActiveIndices(newActive);
        }
    });

    // Initial calculation on mount
    useEffect(() => {
        const playerZ = usePlayerStore.getState().position[2];
        let pIdx = 0;
        let d = Infinity;
        for (let i = 0; i < TOTAL_ALTARS; i++) {
            const cz = getAltarCenterZ(i);
            const dist = Math.abs(playerZ - cz);
            if (dist < d) { d = dist; pIdx = i; }
        }
        const set = new Set<number>();
        for (let i = currentAltarIndex - 1; i <= currentAltarIndex + 1; i++) if (i >= 0 && i < TOTAL_ALTARS) set.add(i);
        for (let i = pIdx - 1; i <= pIdx + 1; i++) if (i >= 0 && i < TOTAL_ALTARS) set.add(i);
        setActiveIndices(Array.from(set).sort((a, b) => a - b));
    }, [currentAltarIndex]);

    return (
        <group name="altar-manager">
            {activeIndices.map(index => {
                return (
                    <group key={`altar-group-${index}`}>
                        <AltarRoom index={index} />
                        <AltarRoomWaveSpawner index={index} />
                    </group>
                );
            })}
        </group>
    );
}

export default AltarManager;
