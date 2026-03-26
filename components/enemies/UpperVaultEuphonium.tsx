'use client';

import { useMemo } from 'react';
import { Euphonium } from './Euphonium';
import { Pillar } from '@/lib/game/pillars';

interface UpperVaultEuphoniumProps {
    id: string;
    position: [number, number, number];
    level: number;
}

/**
 * UpperVaultEuphonium Component
 * 
 * A specialized wrapper for the Euphoniums in the Upper Vault.
 * Similar to how PrisonCell Tubas work, this wraps the Euphonium with an invisible
 * bounding box of pillars, effectively "locking" it in place so it cannot
 * chase the player out of its designated spot, even though it's a ranged enemy.
 */
export function UpperVaultEuphonium({ id, position, level }: UpperVaultEuphoniumProps) {
    // We create four pillars around the enemy's starting position to form a "cage"
    const cageSize = 8; // Size of the cage in feet
    const barRadius = 2; // Thickness of the invisible collision walls

    const localPillars: Pillar[] = useMemo(() => {
        return [
            { x: -cageSize / 2, z: 0, radius: barRadius, id: `${id}-wall-left`, height: 50 },
            { x: cageSize / 2, z: 0, radius: barRadius, id: `${id}-wall-right`, height: 50 },
            { x: 0, z: -cageSize / 2, radius: barRadius, id: `${id}-wall-back`, height: 50 },
            { x: 0, z: cageSize / 2, radius: barRadius, id: `${id}-wall-front`, height: 50 },
        ];
    }, [id]);

    return (
        <Euphonium
            id={id}
            initialPosition={position}
            level={level}
            maxRangeFromSpawn={cageSize / 2} // Redundant fallback, mostly handled by localPillars
            // @ts-ignore - Temporary prop for specific confined enemies (matching Tuba's implementation)
            localPillars={localPillars}
        />
    );
}

export default UpperVaultEuphonium;
