'use client';

import { Canvas } from '@react-three/fiber';
import { Stats, Stars } from '@react-three/drei';
import { Suspense, useEffect, useRef } from 'react';
import { FirstPersonController, Player, useFirstPersonController, TouchControls } from '@/components/game/everything';
import { GameUI } from '@/components/ui';
import { useGameStore, usePlayerStore, useSettingsStore } from '@/lib/store';
import { useAudioSettings } from '@/hooks/useAudioSettings';
import { AltarManager } from '@/components/game/AltarManager';
import { setActiveConfig } from '@/lib/game/config';
import { getAltarCenterZ, getAltarScaleFactor } from '@/lib/game/altarGeometry';

export default function AltarRoomDemo() {
    const { isLocked } = useFirstPersonController();
    const { gameState, setGameState } = useGameStore();
    const speed = usePlayerStore((state) => state.speed);
    const resetPlayer = usePlayerStore((state) => state.resetPlayer);
    const setPosition = usePlayerStore((state) => state.setPosition);

    const {
        graphics: { brightness, quality },
        controls: { mouseSensitivity },
        isMobile,
        detectDevice
    } = useSettingsStore();

    const currentAltarIndex = useGameStore(state => state.currentAltarIndex);
    const playerPos = usePlayerStore(state => state.position);

    // Sync audio settings
    useAudioSettings();

    // Setup demo config and position
    useEffect(() => {
        setActiveConfig('altar_room');
        resetPlayer();
        // Position player just before the trigger point
        setPosition(0, 1.5, 560);

        return () => {
            setActiveConfig('normal');
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        detectDevice();
    }, [detectDevice]);

    const setSimulationActive = useGameStore(state => state.setSimulationActive);
    const simulationActive = useGameStore(state => state.simulationActive);

    useEffect(() => {
        setGameState('playing');
    }, [setGameState]);

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

    const setAltarIndex = useGameStore(state => state.setAltarIndex);

    // Debug Shortcut: Press 'L' to teleport to the next altar
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'KeyL') {
                const nextIdx = currentAltarIndex + 1;
                if (nextIdx < 100) {
                    const nextCZ = getAltarCenterZ(nextIdx);
                    const nextScale = getAltarScaleFactor(nextIdx);
                    // Central altar top is at 4.1 * scale. Teleport slightly above.
                    const targetY = 4.5 * nextScale;

                    console.log(`Teleporting to Altar ${nextIdx + 1} at Z: ${nextCZ.toFixed(1)}`);
                    setPosition(0, targetY, nextCZ);
                    setAltarIndex(nextIdx);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentAltarIndex, setAltarIndex, setPosition]);

    // Canvas dpr
    const dpr: [number, number] = isMobile || quality === 'low' ? [1, 1.5] : [1, 2];
    const wasLocked = useRef(isLocked);

    // Handle lock transitions
    useEffect(() => {
        if (wasLocked.current && !isLocked && gameState === 'playing') {
            setGameState('paused');
        }
        wasLocked.current = isLocked;
    }, [isLocked, gameState, setGameState]);

    const brightnessOverlay = brightness < 50
        ? `rgba(0, 0, 0, ${(50 - brightness) / 50 * 0.6})`
        : `rgba(255, 255, 255, ${(brightness - 50) / 50 * 0.3})`;

    return (
        <div className="w-full h-screen bg-black select-none">
            {brightness !== 50 && (
                <div
                    className="absolute inset-0 pointer-events-none z-[60]"
                    style={{ backgroundColor: brightnessOverlay }}
                />
            )}

            <GameUI />

            {/* Mobile Touch Controls */}
            {gameState === 'playing' && isMobile && (
                <TouchControls />
            )}

            {gameState === 'playing' && !isLocked && !isMobile && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
                    <div className="bg-black/40 backdrop-blur-sm px-6 py-3 rounded-full border border-white/20 text-white/80 animate-pulse font-medium">
                        Click to control
                    </div>
                </div>
            )}

            {(gameState === 'playing') && (isLocked || isMobile) && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                    <div className="w-1.5 h-1.5 bg-white rounded-full opacity-60 mix-blend-difference shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
                </div>
            )}

            <Canvas
                shadows={quality !== 'low'}
                dpr={dpr}
                camera={{ fov: 75, near: 0.1, far: 5000, position: [0, 1.5, 560] }}
                className="w-full h-full touch-none"
            >
                <color attach="background" args={['#000000']} />
                <fog attach="fog" args={['#000000', 10, 500]} />

                <Suspense fallback={null}>
                    <Stars radius={500} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

                    <FirstPersonController
                        speed={gameState === 'playing' ? speed : 0}
                        eyeLevel={1.5}
                        arenaRadius={5000}
                        collisionMargin={1}
                        enabled={simulationActive && !isMobile}
                        pillars={[]}
                        pillarCollisionPadding={0}
                        sensitivity={mouseSensitivity}
                    />

                    <Player visible={gameState === 'playing'} />

                    {/* Repeating Altar Rooms and Logic */}
                    <AltarManager />

                    <ambientLight intensity={0.2} />
                </Suspense>
            </Canvas>

            <Stats className="!absolute !bottom-4 !right-4 !top-auto" />

            <div className="absolute top-4 left-4 z-50 text-white/50 text-xs font-mono pointer-events-none">
                ALTAR ROOM DEMO MODE<br />
                Config: ALTAR_ROOM_CONFIG<br />
                Position: {playerPos.map(c => c.toFixed(1)).join(', ')}<br />
                Current Ritual Altar: {currentAltarIndex + 1}
            </div>
        </div>
    );
}
