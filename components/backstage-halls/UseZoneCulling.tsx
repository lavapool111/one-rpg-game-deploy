'use client';

import { createContext, useContext, useRef, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { DungeonZone, getPlayerZone, getVisibleZones } from '@/lib/game/zoneCulling';

/**
 * Zone Culling Hook + Context
 *
 * Provides zone-based visibility to descendant components.
 * Reads player position every 10 frames and determines which zones should render.
 */

// Context to share visibility state without prop drilling
interface ZoneCullingContextType {
    /** Check if a zone should currently be visible */
    isZoneVisible: (zone: DungeonZone) => boolean;
}

export const ZoneCullingContext = createContext<ZoneCullingContextType>({
    isZoneVisible: () => true, // Default: everything visible
});

/**
 * Hook to set up zone culling. Call once in the top-level BackstageHalls component.
 * Returns a context value to pass to ZoneCullingContext.Provider.
 */
export function useZoneCulling() {
    const { camera } = useThree();
    const visibleZones = useRef<Set<DungeonZone>>(new Set()); // Start empty, will fill on first frame
    const frameCount = useRef(-1); // Start at -1 so first frame (0) triggers update
    const initialized = useRef(false);

    useFrame(() => {
        frameCount.current++;
        if (frameCount.current % 10 !== 0) return;

        const x = camera.position.x;
        const y = camera.position.y;
        const z = camera.position.z;

        const playerZone = getPlayerZone(x, y, z);
        const newVisible = getVisibleZones(playerZone);

        visibleZones.current = newVisible;
        initialized.current = true;
    });

    const isZoneVisible = useCallback((zone: DungeonZone): boolean => {
        if (!initialized.current) return true; // Render everything on first frames
        return visibleZones.current.has(zone);
    }, []);

    return { isZoneVisible };
}

/**
 * ZoneCulled component — wraps children and toggles group.visible based on zone culling.
 * Uses useFrame to check visibility every 10 frames (synchronized with the hook).
 */
export function ZoneCulled({
    zone,
    children,
}: {
    zone: DungeonZone;
    children: React.ReactNode;
}) {
    const groupRef = useRef<THREE.Group>(null);
    const { isZoneVisible } = useContext(ZoneCullingContext);
    const frameCount = useRef(-1);

    useFrame(() => {
        frameCount.current++;
        // Offset by 5 frames from the main hook to spread load
        if ((frameCount.current + 5) % 10 !== 0) return;
        if (!groupRef.current) return;

        groupRef.current.visible = isZoneVisible(zone);
    });

    return (
        <group ref={groupRef}>
            {children}
        </group>
    );
}
