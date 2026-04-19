'use client';

import { Canvas } from '@react-three/fiber';
import { Stats } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { BandRoom, FirstPersonController, Player, useFirstPersonController, SaveManager, TouchControls } from '@/components/game/everything';
import { AltarManager } from '@/components/game/AltarManager';
import { OuterBackstage } from '@/components/game/OuterBackstage';
import { EnemySpawner, CorridorSpawner } from '@/components/enemies/everything';
import { OuterBackstageSpawner } from '@/components/enemies/OuterBackstageSpawner';
import { BackstageHalls } from '@/components/backstage-halls/BackstageHalls';
import { TrumpetInstances } from '@/components/enemies/Trumpet';
import { TromboneInstances } from '@/components/enemies/Trombone';
import { FrenchHornInstances } from '@/components/enemies/FrenchHorn';
import { TubaInstances } from '@/components/enemies/Tuba';
import { EuphoniumInstances } from '@/components/enemies/Euphonium';
import { EnemyHealthBarInstances } from '@/components/enemies/EnemyHealthBar';
import { RegistryManager } from '@/components/enemies/RegistryManager';
import { GameUI } from '@/components/ui';
import { useGameStore, usePlayerStore, useSettingsStore } from '@/lib/store';
import { generatePillars } from '@/lib/game/pillars';
import { useAudioSettings } from '@/hooks/useAudioSettings';
import AudioManager from '@/lib/audio/AudioManager';

import { getFloorHeightAt } from '@/lib/game/stairCollision';


/**
 * Band Room Demo Page
 * 
 * Main game entry point managing:
 * - 3D Canvas
 * - Game UI Overlay (Menus, HUD)
 * - Game State transitions
 * - Location-based scene rendering
 */
export default function BandRoomDemo() {
    const { isLocked } = useFirstPersonController();
    const { gameState, setGameState, currentLocation, lastDungeonResult } = useGameStore();
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

    // Canvas dpr: Lower on mobile/low quality for performance
    // Mobile: [1, 1.5], Desktop: [1, 2]
    const dpr: [number, number] = isMobile || quality === 'low' ? [1, 1.5] : [1, 2];

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

    const setSimulationActive = useGameStore(state => state.setSimulationActive);
    const simulationActive = useGameStore(state => state.simulationActive);

    // Staggered simulation activation (matches main page logic)
    useEffect(() => {
        if (gameState === 'playing') {
            let frameIdx = 0;
            const stagger = () => { frameIdx++; if (frameIdx < 3) requestAnimationFrame(stagger); else setSimulationActive(true); };
            requestAnimationFrame(stagger);
        } else {
            let frameIdx = 0;
            const stagger = () => { frameIdx++; if (frameIdx < 2) requestAnimationFrame(stagger); else setSimulationActive(false); };
            requestAnimationFrame(stagger);
        }
    }, [gameState, setSimulationActive]);

    // Calculate brightness overlay opacity (brightness 50 = no overlay, <50 = darken, >50 = lighten)
    const brightnessOverlay = brightness < 50
        ? `rgba(0, 0, 0, ${(50 - brightness) / 50 * 0.6})` // Darken up to 60%
        : `rgba(255, 255, 255, ${(brightness - 50) / 50 * 0.3})`; // Lighten up to 30%

    // Determine which arena radius to use based on location
    const activeArenaRadius = currentLocation === 'backstage_halls' ? 350 : ARENA_RADIUS;

    // Audio: Background Ambience
    const isInAltarRoom = useGameStore(state => state.isInAltarRoom);
    const isGameActive = gameState === 'playing' || gameState === 'paused';

    useEffect(() => {
        if (!isGameActive || currentLocation !== 'band_room') return;

        const ALTAR_MUSIC_KEY = 'altar-ambience';
        const ALTAR_MUSIC_SRC = '/audio/Altar of the Silent Oath.mp3';
        const HUB_MUSIC_KEY = 'bg-ambience';
        const HUB_MUSIC_SRC = '/audio/ambient-music.m4a';

        const currentKey = isInAltarRoom ? ALTAR_MUSIC_KEY : HUB_MUSIC_KEY;
        const currentPath = isInAltarRoom ? ALTAR_MUSIC_SRC : HUB_MUSIC_SRC;
        const otherKey = isInAltarRoom ? HUB_MUSIC_KEY : ALTAR_MUSIC_KEY;

        AudioManager.stop(otherKey);
        AudioManager.stop(currentKey);

        AudioManager.load(currentKey, currentPath);
        const id = AudioManager.play(currentKey, 'music', {
            loop: true,
            volume: isInAltarRoom ? 0.40 : 0.30
        });

        return () => {
            if (id) AudioManager.stop(currentKey, id);
            AudioManager.stop(currentKey);
        };
    }, [isGameActive, isInAltarRoom, currentLocation]);

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


            {/* Mobile Touch Controls */}
            {gameState === 'playing' && isMobile && (
                <TouchControls />
            )}

            {/* "Click to Resume" Overlay - Desktop only */}
            {gameState === 'playing' && !isLocked && !isMobile && !lastDungeonResult && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
                    <div className="bg-black/40 backdrop-blur-sm px-6 py-3 rounded-full border border-white/20 text-white/80 animate-pulse font-medium">
                        Click to control
                    </div>
                </div>
            )}

            {/* Crosshair - Visible when locked (Desktop) OR always when playing (Mobile) */}
            {(gameState === 'playing') && (isLocked || isMobile) && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                    <div className="w-1.5 h-1.5 bg-white rounded-full opacity-60 mix-blend-difference shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
                </div>
            )}

            {/* 3D Scene */}
            <Canvas
                shadows={quality !== 'low'}
                dpr={dpr}
                camera={{ fov: 75, near: 0.1, far: 1000, position: [0, 1.5, 0] }}
                className="w-full h-full touch-none"
            >
                <Suspense fallback={null}>
                    {/* Global Mesh Instance Pools */}
                    <TrumpetInstances>
                        <TromboneInstances>
                            <FrenchHornInstances>
                                <TubaInstances>
                                    <EuphoniumInstances>
                                        <EnemyHealthBarInstances>
                                            <RegistryManager />
                                            <FirstPersonController
                                                speed={gameState === 'playing' ? speed : 0}
                                                eyeLevel={1.5}
                                                arenaRadius={activeArenaRadius}
                                                collisionMargin={5}
                                                enabled={simulationActive && !isMobile && !lastDungeonResult}
                                                pillars={currentLocation === 'band_room' ? pillarConfig.pillars : []}
                                                pillarCollisionPadding={currentLocation === 'band_room' ? pillarConfig.collisionPadding : 0}
                                                sensitivity={mouseSensitivity}
                                            />

                                            {/* Player weapon/character (follows camera) - only visible when locked/playing */}
                                            <Player visible={gameState === 'playing'} />

                                            {/* Band Room - Only render when in band_room */}
                                            {currentLocation === 'band_room' && !isInAltarRoom && (
                                                <>
                                                    <BandRoom
                                                        radius={ARENA_RADIUS}
                                                        wallHeight={50}
                                                        animatedLights={quality === 'high'}
                                                        quality={quality}
                                                    />

                                                    {/* Enemy Spawner - 5 Trumpets every 60 seconds */}
                                                    <EnemySpawner
                                                        arenaRadius={ARENA_RADIUS}
                                                        enemiesPerWave={5}
                                                        spawnInterval={60}
                                                        enabled={simulationActive}
                                                        pillars={pillarConfig.pillars}
                                                    />

                                                    {/* Corridor Enemy Spawner */}
                                                    <CorridorSpawner
                                                        arenaRadius={ARENA_RADIUS}
                                                        enabled={simulationActive}
                                                        pillars={pillarConfig.pillars}
                                                    />

                                                    {/* Outer Backstage Ring */}
                                                    <OuterBackstage />
                                                    <OuterBackstageSpawner enabled={simulationActive} />

                                                    {/* Fog for Band Room atmosphere - increased far plane for wall visibility */}
                                                    <fog attach="fog" args={['#1a1a2e', 100, 800]} />
                                                </>
                                            )}

                                            {/* Altar Room Manager - Always render when in band_room to allow corridor-to-room transitions */}
                                            {currentLocation === 'band_room' && (
                                                <AltarManager />
                                            )}

                                            {/* Backstage Halls - Only render when in backstage_halls */}
                                            {currentLocation === 'backstage_halls' && (
                                                <BackstageHalls
                                                    quality={quality}
                                                />
                                            )}
                                        </EnemyHealthBarInstances>
                                    </EuphoniumInstances>
                                </TubaInstances>
                            </FrenchHornInstances>
                        </TromboneInstances>
                    </TrumpetInstances>

                    {/* Auto-Save Manager */}
                    <SaveManager />
                </Suspense>
            </Canvas>

            {/* Stats for development */}
            <Stats className="!absolute !bottom-4 !right-4 !top-auto" />
        </div>
    );
}
