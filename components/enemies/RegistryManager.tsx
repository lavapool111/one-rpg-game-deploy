'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { cleanupSpatialRegistry } from '@/lib/enemies/enemyMovement';

/**
 * RegistryManager
 * 
 * Central manager for throttled game-world operations.
 * Currently handles seasonal cleanup of the spatial registry to avoid
 * per-enemy O(N) iteration spikes.
 */
export function RegistryManager() {
    const lastCleanupTime = useRef(0);

    useFrame((state) => {
        const now = state.clock.elapsedTime;
        // Run cleanup every 3.1 seconds (staggered against 2.1s auto-save)
        if (now - lastCleanupTime.current > 3.1) {
            lastCleanupTime.current = now;
            cleanupSpatialRegistry();
        }
    });

    return null;
}
