'use client';

import { useMemo } from 'react';
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
    const playerZ = usePlayerStore(state => state.position[2]);

    // Find the altar index closest to the player's physical position
    const playerAltarIndex = useMemo(() => {
        let bestIdx = 0;
        let minDist = Infinity;
        // Simple search suffices for 100 altars — more robust than assuming linear spacing
        for (let i = 0; i < TOTAL_ALTARS; i++) {
            const cz = getAltarCenterZ(i);
            const dist = Math.abs(playerZ - cz);
            if (dist < minDist) {
                minDist = dist;
                bestIdx = i;
            }
        }
        return bestIdx;
    }, [playerZ]);

    // Render a window around both the active ritual altar and the player's physical location
    const activeIndices = useMemo(() => {
        const set = new Set<number>();

        // Ritual window (what the game considers the "current" objective)
        for (let i = currentAltarIndex - 1; i <= currentAltarIndex + 1; i++) {
            if (i >= 0 && i < TOTAL_ALTARS) set.add(i);
        }

        // Player window (where the player actually is physically)
        for (let i = playerAltarIndex - 1; i <= playerAltarIndex + 1; i++) {
            if (i >= 0 && i < TOTAL_ALTARS) set.add(i);
        }

        return Array.from(set).sort((a, b) => a - b);
    }, [currentAltarIndex, playerAltarIndex]);

    return (
        <group name="altar-manager">
            {activeIndices.map(index => {
                return (
                    <group key={`altar-group-${index}`}>
                        <AltarRoom index={index} />

                        {/* Only spawn enemies in the current active altar */}
                        {index === currentAltarIndex && (
                            <AltarRoomWaveSpawner index={index} />
                        )}
                    </group>
                );
            })}
        </group>
    );
}

export default AltarManager;
