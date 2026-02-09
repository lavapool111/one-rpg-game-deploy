'use client';

import { Canvas } from '@react-three/fiber';
import { Stats } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { BackstageHalls, FirstPersonController, Player, useFirstPersonController } from '@/components/game';
import { GameUI } from '@/components/ui';
import { useGameStore, usePlayerStore, useSettingsStore } from '@/lib/store';
import { useAudioSettings } from '@/hooks/useAudioSettings';

/**
 * Backstage Halls Demo Page
 * 
 * Megadungeon testing entry point managing:
 * - 3D Canvas with Backstage Halls scene
 * - Dungeon-specific UI (DungeonHUD via GameUI)
 * - Game State transitions
 */
export default function BackstageHallsDemo() {
    const { isLocked } = useFirstPersonController();
    const { gameState, setGameState, enterDungeon, currentLocation, lastDungeonResult } = useGameStore();
    const speed = usePlayerStore((state) => state.speed);
    const {
        graphics: { brightness, quality },
        controls: { mouseSensitivity },
        isMobile,
        detectDevice
    } = useSettingsStore();

    // Sync audio settings with AudioManager
    useAudioSettings();

    // Detect device on mount
    useEffect(() => {
        detectDevice();
    }, [detectDevice]);

    // Auto-enter dungeon on mount if not already there
    useEffect(() => {
        if (currentLocation !== 'backstage_halls') {
            enterDungeon();
        }
    }, [currentLocation, enterDungeon]);

    // Canvas dpr: Lower on mobile/low quality for performance
    const dpr: [number, number] = isMobile || quality === 'low' ? [1, 1.5] : [1, 2];

    // Track previous lock state to detect transitions
    const wasLocked = useRef(isLocked);

    // Handle game state transitions based on pointer lock
    useEffect(() => {
        if (wasLocked.current && !isLocked && gameState === 'playing') {
            setGameState('paused');
        }
        wasLocked.current = isLocked;
    }, [isLocked, gameState, setGameState]);

    // Handle initial state setup - start playing directly for testing
    useEffect(() => {
        setGameState('playing');
    }, [setGameState]);

    // Calculate brightness overlay opacity
    const brightnessOverlay = brightness < 50
        ? `rgba(0, 0, 0, ${(50 - brightness) / 50 * 0.6})`
        : `rgba(255, 255, 255, ${(brightness - 50) / 50 * 0.3})`;

    return (
        <div className="w-full h-screen bg-black select-none">
            {/* Brightness Overlay */}
            {brightness !== 50 && (
                <div
                    className="absolute inset-0 pointer-events-none z-[60]"
                    style={{ backgroundColor: brightnessOverlay }}
                />
            )}

            {/* Game UI Manager (HUD, Menus, Death Screen, DungeonHUD) */}
            <GameUI />

            {/* "Click to Resume" Overlay - Desktop only */}
            {gameState === 'playing' && !isLocked && !isMobile && !lastDungeonResult && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
                    <div className="bg-black/40 backdrop-blur-sm px-6 py-3 rounded-full border border-white/20 text-white/80 animate-pulse font-medium">
                        Click to control
                    </div>
                </div>
            )}

            {/* Crosshair */}
            {(gameState === 'playing') && (isLocked || isMobile) && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                    <div className="w-1.5 h-1.5 bg-white rounded-full opacity-60 mix-blend-difference shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
                </div>
            )}

            {/* 3D Scene */}
            <Canvas
                shadows={quality !== 'low'}
                dpr={dpr}
                camera={{ fov: 75, near: 0.1, far: 200, position: [0, 1.5, -20] }}
                className="w-full h-full touch-none"
            >
                <Suspense fallback={null}>
                    <FirstPersonController
                        speed={gameState === 'playing' ? speed : 0}
                        eyeLevel={1.5}
                        arenaRadius={200}
                        collisionMargin={5}
                        enabled={gameState === 'playing' && !isMobile && !lastDungeonResult}
                        pillars={[]}
                        pillarCollisionPadding={0}
                        sensitivity={mouseSensitivity}
                    />

                    {/* Player weapon/character */}
                    <Player visible={gameState === 'playing'} />

                    {/* The Backstage Halls dungeon */}
                    <BackstageHalls
                        quality={quality}
                    />
                </Suspense>
            </Canvas>

            {/* Stats for development */}
            <Stats className="!absolute !bottom-4 !right-4 !top-auto" />
        </div>
    );
}
