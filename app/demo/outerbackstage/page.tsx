'use client';

import { Canvas } from '@react-three/fiber';
import { Stats, Stars } from '@react-three/drei';
import { Suspense, useEffect, useRef } from 'react';
import { FirstPersonController, Player, useFirstPersonController } from '@/components/game/everything';
import { OuterBackstage } from '@/components/game/OuterBackstage';
import { OuterBackstageSpawner } from '@/components/enemies/OuterBackstageSpawner';
import { GameUI } from '@/components/ui';
import { useGameStore, usePlayerStore, useSettingsStore } from '@/lib/store';
import { useAccessoryStore } from '@/lib/store/accessoryStore';
import { useAudioSettings } from '@/hooks/useAudioSettings';

export default function OuterBackstageDemo() {
    const { isLocked } = useFirstPersonController();
    const { gameState, setGameState } = useGameStore();
    const speed = usePlayerStore((state) => state.speed);
    const resetPlayer = usePlayerStore((state) => state.resetPlayer);
    const setPosition = usePlayerStore((state) => state.setPosition);
    const playerPos = usePlayerStore((state) => state.position);

    const {
        graphics: { brightness, quality },
        controls: { mouseSensitivity },
        isMobile,
        detectDevice
    } = useSettingsStore();

    useAudioSettings();

    // Setup demo: unlock ring, set level 300, position in ring
    useEffect(() => {
        const game = useGameStore.getState();
        if (!game.outerBackstageUnlocked) {
            game.unlockOuterBackstage();
        }

        resetPlayer();

        // Set player to level 300, embouchure 20
        const ps = usePlayerStore.getState();
        ps.loadState({
            level: 300,
            embouchure: 100,
            health: 478000,
            abilityUpgrades: { chosenPath: 'damage', currentLevel: 20, unlocked: true },
        });

        // Equip level 20 gear
        const acc = useAccessoryStore.getState();
        acc.loadState({
            equippedReed: '5.0',
            reedDurability: 6000000,
            equippedLigature: { id: 'one_screw_metal', level: 50 },
            equippedMouthpiece: { id: 'plastic', level: 50 },
            equippedCase: { id: 'fabric_case', level: 50 },
            ligatureSlot: 0,
            mouthpieceSlot: 1,
            reedSlot: 2,
            caseSlot: 3,
        });

        // Position player at south midpoint of ring (center radius ~695)
        setPosition(0, 1.5, -695);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        detectDevice();
    }, [detectDevice]);

    // Auto-start playing — no intro screen
    useEffect(() => {
        setGameState('playing');
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

    const dpr: [number, number] = isMobile || quality === 'low' ? [1, 1.5] : [1, 2];
    const wasLocked = useRef(isLocked);

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
                camera={{ fov: 75, near: 0.1, far: 2000, position: [0, 1.5, -695] }}
                className="w-full h-full touch-none"
            >
                <color attach="background" args={['#000000']} />
                <fog attach="fog" args={['#0a0a15', 50, 600]} />

                <Suspense fallback={null}>
                    <Stars radius={500} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

                    <FirstPersonController
                        speed={gameState === 'playing' ? speed : 0}
                        eyeLevel={1.5}
                        arenaRadius={900}
                        collisionMargin={1}
                        enabled={simulationActive && !isMobile}
                        pillars={[]}
                        pillarCollisionPadding={0}
                        sensitivity={mouseSensitivity}
                    />

                    <Player visible={gameState === 'playing'} />

                    {/* Only the Outer Backstage Ring */}
                    <OuterBackstage />
                    <OuterBackstageSpawner enabled={simulationActive} />

                    <ambientLight intensity={0.5} color="#8899cc" />
                </Suspense>
            </Canvas>

            <Stats className="!absolute !bottom-4 !right-4 !top-auto" />

            <div className="absolute top-4 left-4 z-50 text-white/50 text-xs font-mono pointer-events-none">
                OUTER BACKSTAGE DEMO<br />
                Lv 300 · Embouchure 20<br />
                Position: {playerPos.map(c => c.toFixed(1)).join(', ')}
            </div>
        </div>
    );
}
