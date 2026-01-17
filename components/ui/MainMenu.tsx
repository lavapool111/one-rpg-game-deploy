'use client';

import { useGameStore, usePlayerStore } from '@/lib/store';
import { useEffect, useState } from 'react';
import { hasSave, loadGame } from '@/lib/db';

export function MainMenu() {
    const { setGameState, resetGame } = useGameStore();
    const { resetPlayer, loadState } = usePlayerStore();
    const [isVisible, setIsVisible] = useState(false);
    const [canContinue, setCanContinue] = useState(false);

    useEffect(() => {
        // Fade in on mount
        setIsVisible(true);
        
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
            setGameState('playing');
        }, 300); // 300ms fade out
    };

    const handleContinue = async () => {
        if (!canContinue) return;
        
        try {
            const save = await loadGame();
            if (save) {
                setIsVisible(false);
                setTimeout(() => {
                    // Don't reset game/player completely, just ensure state is valid
                    // But we *should* probably reset game time or similar if needed
                    // For now, hydrating player is the key.
                    loadState(save);
                    
                    // We also need to inform components that we are loaded.
                    // The position will be applied by playerStore but CameraController needs to 
                    // read it. The SaveManager syncs one way, PlayerStore holds it.
                    // We might need a small delay or a distinct 'loading' state if initializing 3D world takes time.
                    // But simple state set works for MVP.
                    
                    setGameState('playing');
                }, 300);
            }
        } catch (e) {
            console.error("Failed to load save", e);
        }
    };

    return (
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
            {/* Background elements */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-900/20 via-slate-950 to-slate-950 pointer-events-none" />

            {/* Title */}
            <div className="relative z-10 text-center mb-16">
                <h1 className="text-6xl md:text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-700 tracking-tighter drop-shadow-[0_0_20px_rgba(250,204,21,0.5)]">
                    CLARINET
                </h1>
                <p className="text-yellow-500/60 mt-4 text-xl tracking-widest uppercase font-light">
                    The Orchestral RPG
                </p>
            </div>

            {/* Menu Buttons */}
            <div className="relative z-10 flex flex-col gap-6 w-full max-w-sm px-8">
                <MenuButton onClick={handleNewGame}>
                    New Game
                </MenuButton>

                <MenuButton 
                    onClick={handleContinue} 
                    disabled={!canContinue}
                    className={!canContinue ? "opacity-50 grayscale" : ""}
                >
                    Continue
                </MenuButton>

                <MenuButton onClick={() => console.log('Settings clicked')} variant="secondary">
                    Settings
                </MenuButton>
            </div>

            {/* Decor */}
            <div className="absolute bottom-8 text-yellow-900/40 text-sm">
                v0.1.0 Pre-Alpha
            </div>
        </div>
    );
}

interface MenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary';
}

function MenuButton({ children, variant = 'primary', className = '', ...props }: MenuButtonProps) {
    const baseStyles = "group w-full py-4 relative overflow-hidden transition-all duration-300 font-bold tracking-wider uppercase disabled:opacity-50 disabled:cursor-not-allowed";

    // Gold/Primary variant
    const primaryStyles = "text-slate-950 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_30px_rgba(234,179,8,0.5)] active:scale-[0.98]";

    // Dark/Secondary variant
    const secondaryStyles = "text-yellow-500 border border-yellow-700/50 hover:bg-yellow-900/20 hover:border-yellow-500/50 hover:text-yellow-300 active:scale-[0.98]";

    return (
        <button
            className={`${baseStyles} ${variant === 'primary' ? primaryStyles : secondaryStyles} ${className}`}
            {...props}
        >
            <span className="relative z-10">{children}</span>
        </button>
    );
}

export default MainMenu;
