'use client';

import { useGameStore, usePlayerStore, useSettingsStore } from '@/lib/store';
import { useInventoryStore } from '@/lib/store/inventoryStore';
import { useAccessoryStore } from '@/lib/store/accessoryStore';
import { useEffect, useState, useRef } from 'react';
import { hasSave, loadGame } from '@/lib/db';
import { HowToPlayModal } from './HowToPlayModal';
import { ControlsModal } from './ControlsModal';
import { Canvas, useFrame } from '@react-three/fiber';
import { BandRoom } from '../game/BandRoom';
import * as THREE from 'three';

function RotatingScene() {
    const groupRef = useRef<THREE.Group>(null);
    useFrame((_, delta) => {
        if (groupRef.current) {
            groupRef.current.rotation.y += delta * 0.1; // Slightly faster rotation for more dynamic feel
        }
    });

    return (
        <group ref={groupRef}>
            {/* Dramatic central light source */}
            <spotLight
                position={[0, 50, 0]}
                intensity={1.5}
                angle={0.6}
                penumbra={1}
                castShadow
                color="#3b82f6"
            />
            <pointLight position={[30, 20, 30]} intensity={0.5} color="#60a5fa" />
            <BandRoom radius={350} wallHeight={40} animatedLights={true} quality="low" disableAudio={true} />
        </group>
    );
}

export function MainMenu() {
    const setGameState = useGameStore((state) => state.setGameState);
    const resetGame = useGameStore((state) => state.resetGame);
    const resetPlayer = usePlayerStore((state) => state.resetPlayer);
    const loadState = usePlayerStore((state) => state.loadState);
    const isMobile = useSettingsStore((state) => state.isMobile);
    const [isVisible, setIsVisible] = useState(false);
    const [canContinue, setCanContinue] = useState(false);

    const [activeModal, setActiveModal] = useState<'none' | 'howToPlay' | 'controls'>('none');

    useEffect(() => {
        // Fade in on mount
        setTimeout(() => setIsVisible(true), 100);

        // Check for save
        hasSave().then(exists => {
            setCanContinue(exists);
        });
    }, []);

    const handleNewGame = () => {
        setIsVisible(false);
        setTimeout(() => {
            resetGame();
            resetPlayer();
            setGameState('intro'); // Show intro lore before playing
        }, 500); // 500ms fade out
    };

    const handleContinue = async () => {
        if (!canContinue) return;

        try {
            const save = await loadGame();
            if (save) {
                console.log('[MainMenu] Loaded save data');
                setIsVisible(false);
                setTimeout(() => {
                    loadState(save);
                    useGameStore.getState().loadState(save);
                    useInventoryStore.getState().loadState(save);
                    useAccessoryStore.getState().loadState(save);
                    setGameState('playing');
                }, 500);
            }
        } catch (e) {
            console.error("Failed to load save", e);
        }
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-center bg-slate-950 transition-opacity duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`} style={{ overflow: 'hidden' }}>
            {/* Moody, dark atmospheric background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Deep blue radial base */}
                <div className="absolute inset-0 bg-[#020617]" />
                {/* Subtle, large deep blue light source */}
                <div className="absolute top-[20%] left-[-10%] w-[120vw] md:w-[70vw] h-[120vw] md:h-[70vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(30,58,138,0.25),transparent_60%)] blur-3xl opacity-80 mix-blend-screen" />
                {/* Dim cyan accent light */}
                <div className="absolute bottom-[-10%] right-[-10%] w-[80vw] md:w-[50vw] h-[80vw] md:h-[50vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(8,145,178,0.08),transparent_60%)] blur-3xl mix-blend-screen" />
                {/* Vignette effect */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.85)_100%)]" />
                {/* Texture/Noise overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20" />
            </div>

            {/* Left-Aligned UI Container */}
            <div className="relative z-10 flex flex-col justify-center h-full" style={{ paddingLeft: 'clamp(2.5rem, 8vw, 10rem)', paddingTop: '7.5rem', paddingBottom: '2rem' }}>

                {/* Game Title */}
                <div className="mb-14 md:mb-20">
                    <h1 className="text-5xl md:text-7xl font-light text-white tracking-[0.2em] mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] whitespace-nowrap">
                        FINAL STAGE
                    </h1>
                    <p className="text-blue-400/60 text-sm md:text-lg tracking-[0.3em] font-medium uppercase ml-1">
                        Band Room
                    </p>
                    <div className="h-px w-24 bg-gradient-to-r from-blue-500/50 to-transparent mt-8" />
                </div>

                {/* Navigation Menu */}
                <div className="flex flex-col gap-3 md:gap-4">
                    <MenuButton onClick={handleNewGame}>
                        Start New
                    </MenuButton>

                    <MenuButton
                        onClick={handleContinue}
                        disabled={!canContinue}
                    >
                        Resume
                    </MenuButton>

                    <MenuButton onClick={() => setActiveModal('howToPlay')}>
                        How to Play
                    </MenuButton>

                    <MenuButton onClick={() => setActiveModal('controls')}>
                        Controls
                    </MenuButton>

                    <MenuButton onClick={() => console.log('Settings clicked')}>
                        Settings
                    </MenuButton>
                </div>

                {/* Footer/Version Info */}
                <div className="mt-auto pt-8 text-slate-500/50 text-xs font-mono tracking-wider">
                    v0.1.0 • EARLY ACCESS {isMobile && '• MOBILE DETECTED'}
                </div>
            </div>

            {/* Right-Aligned Rotating Band Room */}
            <div className="absolute right-12 lg:right-32 top-1/2 -translate-y-1/2 w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96 rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(30,58,138,0.3)] pointer-events-none hidden md:block opacity-80 transition-all duration-1000">
                <Canvas shadows camera={{ position: [0, 40, 100], fov: 45 }}>
                    <ambientLight intensity={0.15} />
                    <RotatingScene />
                </Canvas>
            </div>

            {/* Modals */}
            <HowToPlayModal
                isOpen={activeModal === 'howToPlay'}
                onClose={() => setActiveModal('none')}
            />
            <ControlsModal
                isOpen={activeModal === 'controls'}
                onClose={() => setActiveModal('none')}
            />
        </div>
    );
}

interface MenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { }

function MenuButton({ children, disabled, className = '', ...props }: MenuButtonProps) {
    return (
        <button
            disabled={disabled}
            className={`
                group relative flex items-center w-fit py-3 pr-12 text-left
                transition-all duration-300 ease-out
                ${disabled ? 'opacity-30 cursor-not-allowed' : 'opacity-70 hover:opacity-100 hover:translate-x-4 cursor-pointer'}
                ${className}
            `}
            {...props}
        >
            {/* Subtle left indicator dot/line */}
            <span className={`
                absolute left-[-20px] h-px w-3 bg-blue-500 transition-all duration-300
                ${disabled ? 'opacity-0' : 'opacity-0 group-hover:opacity-100 group-hover:left-[-16px]'}
            `} />

            <span className="text-xl md:text-2xl font-light tracking-widest uppercase text-slate-100 drop-shadow-md">
                {children}
            </span>

            {/* Glow text effect on hover */}
            <span className="absolute inset-0 flex items-center text-xl md:text-2xl font-light tracking-widest uppercase text-blue-300 blur-md opacity-0 group-hover:opacity-40 transition-opacity duration-300 pointer-events-none">
                {children}
            </span>
        </button>
    );
}
export default MainMenu;
