'use client';

import { useGameStore, usePlayerStore } from '@/lib/store';
import { useEffect, useState } from 'react';
import { InventoryScreen } from './InventoryScreen';
import { SettingsScreen } from './SettingsScreen';
import { saveGame } from '@/lib/db';

/**
 * PauseMenu Component
 * Displayed when the game is paused (Escape key).
 * 
 * Features:
 * - "Resume": Returns to game
 * - "Inventory": Opens inventory screen
 * - "Settings": Placeholder
 * - "Save & Quit": Returns to Main Menu
 */
interface PauseMenuProps {
    defaultOpenInventory?: boolean;
}

export function PauseMenu({ defaultOpenInventory = false }: PauseMenuProps) {
    const { setGameState } = useGameStore();
    const [isVisible, setIsVisible] = useState(false);
    const [showInventory, setShowInventory] = useState(defaultOpenInventory);
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    // Reset inventory state when defaultOpenInventory changes
    useEffect(() => {
        if (defaultOpenInventory) {
            setShowInventory(true);
        }
    }, [defaultOpenInventory]);

    const handleResume = () => {
        // Just unpause, the parent/pointer lock should handle the rest
        // But triggering pointer lock usually requires user interaction, which a click is.
        setIsVisible(false);
        setTimeout(() => {
            setGameState('playing');
        }, 150);
    };

    const handleQuit = async () => {
        // Save game state
        const playerState = usePlayerStore.getState();
        await saveGame({
            level: playerState.level,
            health: playerState.health,
            xp: playerState.xp,
            echoes: playerState.echoes,
            position: { 
                x: playerState.position[0], 
                y: playerState.position[1], 
                z: playerState.position[2] 
            },
            inventory: playerState.inventory,
            equippedReed: playerState.equippedReed,
            reedDurability: playerState.reedDurability,
            embouchure: playerState.embouchure,
            embouchureXp: playerState.embouchureXp
        });

        setIsVisible(false);
        setTimeout(() => {
            setGameState('menu');
        }, 150);
    };

    const handleInventory = () => {
        setShowInventory(true);
    };

    // Show inventory screen if open
    if (showInventory) {
        return <InventoryScreen onClose={() => setShowInventory(false)} />;
    }

    // Show settings screen if open
    if (showSettings) {
        return <SettingsScreen onClose={() => setShowSettings(false)} />;
    }

    return (
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>

            {/* Menu Container */}
            <div className="bg-slate-900/90 border border-yellow-600/30 p-8 rounded-xl max-w-sm w-full shadow-2xl transform transition-transform scale-100">
                <h2 className="text-3xl font-bold text-center text-yellow-500 mb-8 tracking-wider uppercase border-b border-yellow-600/20 pb-4">
                    Paused
                </h2>

                <div className="flex flex-col gap-4">
                    <PauseButton onClick={handleResume} autoFocus>
                        Resume
                    </PauseButton>

                    <PauseButton onClick={handleInventory}>
                        Inventory
                    </PauseButton>

                    <div className="bg-black/40 rounded p-4 mb-2 text-sm text-slate-300">
                        <h3 className="text-yellow-500 font-bold mb-2 uppercase text-xs tracking-wider">Controls</h3>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <span className="text-slate-400">Move</span>
                            <span className="text-right font-mono text-white">WASD</span>

                            <span className="text-slate-400">Look</span>
                            <span className="text-right font-mono text-white">Mouse</span>

                            <span className="text-slate-400">Attack</span>
                            <span className="text-right font-mono text-white">L-Click</span>

                            <span className="text-slate-400">Long Tone</span>
                            <span className="text-right font-mono text-white">1</span>

                            <span className="text-slate-400">Sprint</span>
                            <span className="text-right font-mono text-white">Q</span>
                        </div>
                    </div>

                    <PauseButton onClick={() => setShowSettings(true)}>
                        Settings
                    </PauseButton>

                    <div className="h-px bg-yellow-600/20 my-2" />

                    <PauseButton onClick={handleQuit} variant="danger">
                        Save & Quit
                    </PauseButton>
                </div>
            </div>
        </div>
    );
}

interface PauseButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'danger';
}

function PauseButton({ children, variant = 'default', className = '', ...props }: PauseButtonProps) {
    const baseStyles = "w-full py-3 px-4 text-left relative overflow-hidden transition-all duration-200 font-medium hover:pl-6 disabled:opacity-50 disabled:hover:pl-4 disabled:cursor-not-allowed";

    // Default variant
    const defaultStyles = "text-slate-200 hover:text-yellow-400 hover:bg-yellow-900/10 border-l-2 border-transparent hover:border-yellow-500";

    // Danger variant
    const dangerStyles = "text-red-400 hover:text-red-300 hover:bg-red-900/10 border-l-2 border-transparent hover:border-red-500";

    return (
        <button
            className={`${baseStyles} ${variant === 'default' ? defaultStyles : dangerStyles} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}

export default PauseMenu;
