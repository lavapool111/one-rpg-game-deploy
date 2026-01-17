'use client';

import { Canvas } from '@react-three/fiber';
import { Stats } from '@react-three/drei';
import { Suspense, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { BandRoom, FirstPersonController, Player, EnemySpawner, CorridorSpawner, useFirstPersonController, SaveManager } from '@/components/game';
import { GameUI } from '@/components/ui';
import { useGameStore, usePlayerStore, useSettingsStore } from '@/lib/store';
import { generatePillars } from '@/lib/game/pillars';
import { useAudioSettings } from '@/hooks/useAudioSettings';

/**
 * Band Room Demo Page
 * 
 * Main game entry point managing:
 * - 3D Canvas
 * - Game UI Overlay (Menus, HUD)
 * - Game State transitions
 */
export default function BandRoomDemo() {
    const { isLocked } = useFirstPersonController();
    const { gameState, setGameState } = useGameStore();
    const speed = usePlayerStore((state) => state.speed);
    const brightness = useSettingsStore((state) => state.graphics.brightness);
    const mouseSensitivity = useSettingsStore((state) => state.controls.mouseSensitivity);

    // Sync audio settings with AudioManager
    useAudioSettings();

    // Arena radius constant (shared between components) - 1.5x original size
    const ARENA_RADIUS = 375;

    // Generate pillar configuration once
    const pillarConfig = useMemo(() => generatePillars(ARENA_RADIUS), [ARENA_RADIUS]);

    // Track previous lock state to detect transitions
    const wasLocked = useRef(isLocked);

    // Handle game state transitions based on pointer lock
    useEffect(() => {
        // If we lose lock while playing (e.g. Esc pressed), pause the game
        // But ONLY if we were previously locked. This prevents auto-pausing when we resume (and start unlocked).
        if (wasLocked.current && !isLocked && gameState === 'playing') {
            setGameState('paused');
        }
        wasLocked.current = isLocked;
    }, [isLocked, gameState, setGameState]);

    // Handle initial state setup
    useEffect(() => {
        // Ensure we start at the menu
        setGameState('menu');
    }, [setGameState]);

    // Calculate brightness overlay opacity (brightness 50 = no overlay, <50 = darken, >50 = lighten)
    const brightnessOverlay = brightness < 50
        ? `rgba(0, 0, 0, ${(50 - brightness) / 50 * 0.6})` // Darken up to 60%
        : `rgba(255, 255, 255, ${(brightness - 50) / 50 * 0.3})`; // Lighten up to 30%

    return (
        <div className="w-full h-screen bg-black select-none">
            {/* Brightness Overlay */}
            {brightness !== 50 && (
                <div
                    className="absolute inset-0 pointer-events-none z-[60]"
                    style={{ backgroundColor: brightnessOverlay }}
                />
            )}

            {/* Game UI Manager (HUD, Menus, Death Screen) */}
            <GameUI />

            {/* "Click to Resume" Overlay - only show if playing but not locked */}
            {gameState === 'playing' && !isLocked && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
                    <div className="bg-black/40 backdrop-blur-sm px-6 py-3 rounded-full border border-white/20 text-white/80 animate-pulse font-medium">
                        Click to control
                    </div>
                </div>
            )}

            {/* Crosshair - only visible when locked */}
            {isLocked && gameState === 'playing' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                    <div className="w-1.5 h-1.5 bg-white rounded-full opacity-60 mix-blend-difference shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
                </div>
            )}

            {/* 3D Scene */}
            <Canvas
                shadows
                camera={{ fov: 75, near: 0.1, far: 1000, position: [0, 1.5, 0] }}
                className="w-full h-full touch-none"
            >
                <Suspense fallback={null}>
                    {/* Physics World */}
                    {/* Note: Simple physics wrapper if needed, currently using basic collision logic in controller */}

                    <FirstPersonController
                        speed={gameState === 'playing' ? speed : 0}
                        eyeLevel={1.5}
                        arenaRadius={ARENA_RADIUS}
                        collisionMargin={5}
                        // Only enable controller input when playing
                        enabled={gameState === 'playing'}
                        pillars={pillarConfig.pillars}
                        pillarCollisionPadding={pillarConfig.collisionPadding}
                        sensitivity={mouseSensitivity}
                    />

                    {/* Player weapon/character (follows camera) - only visible when locked/playing */}
                    <Player visible={gameState === 'playing'} />

                    {/* The Band Room arena */}
                    <BandRoom
                        radius={ARENA_RADIUS}
                        wallHeight={50}
                        animatedLights={true}
                    />

                    {/* Enemy Spawner - 5 Trumpets every 60 seconds */}
                    <EnemySpawner
                        arenaRadius={ARENA_RADIUS}
                        enemiesPerWave={5}
                        spawnInterval={60}
                        enabled={gameState === 'playing'}
                        pillars={pillarConfig.pillars}
                    />

                    {/* Corridor Enemy Spawner */}
                    <CorridorSpawner
                        arenaRadius={ARENA_RADIUS}
                        enabled={gameState === 'playing'}
                        pillars={pillarConfig.pillars}
                    />

                    {/* Fog for atmosphere */}
                    <fog attach="fog" args={['#1a1a2e', 50, 400]} />

                    {/* Auto-Save Manager */}
                    <SaveManager />
                </Suspense>
            </Canvas>

            {/* Stats for development */}
            <Stats className="!absolute !bottom-4 !right-4 !top-auto" />
        </div>
    );
}
