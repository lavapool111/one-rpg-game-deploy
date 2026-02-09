'use client';

import { useState, useEffect } from 'react';
import { useGameStore, useSettingsStore } from '@/lib/store';
import { MainMenu } from './MainMenu';
import { PauseMenu } from './PauseMenu';
import { DeathScreen } from './DeathScreen';
import { IntroScreen } from './IntroScreen';
import { ClassSelectScreen } from './ClassSelectScreen';
import { PlayerHUD } from './PlayerHUD';
import { DungeonHUD } from './DungeonHUD';
import { CombatHUD } from './CombatHUD';
import { DungeonSummaryScreen } from './DungeonSummaryScreen';

/**
 * GameUI Manager Component
 * 
 * orchestrates the display of UI overlays based on the current game state.
 * This keeps the main page component clean.
 */
export function GameUI() {
    const gameState = useGameStore((state) => state.gameState);
    const setGameState = useGameStore((state) => state.setGameState);
    const [openInventoryOnPause, setOpenInventoryOnPause] = useState(false);

    const clearDungeonResult = useGameStore((state) => state.clearDungeonResult);

    // Global key handler for inventory and quick-resume
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // 'R' key: Quick resume - closes ALL menus and jumps to gameplay
            if (e.code === 'KeyR') {
                if (gameState !== 'playing') {
                    setGameState('playing');
                    setOpenInventoryOnPause(false);
                    clearDungeonResult(); // Close dungeon summary if open
                    // Simulate a click on the canvas to trigger PointerLockControls
                    // Small delay to ensure canvas is ready after state change
                    setTimeout(() => {
                        const canvas = document.querySelector('canvas');
                        if (canvas) {
                            canvas.click();
                        }
                    }, 100);
                }
                return;
            }

            // Only handle other keys if we are playing or paused
            if (gameState !== 'playing' && gameState !== 'paused') return;

            if (e.code === 'KeyZ') {
                if (gameState === 'playing') {
                    // Open inventory: Pause and set flag
                    setOpenInventoryOnPause(true);
                    setGameState('paused');
                    document.exitPointerLock();
                } else if (gameState === 'paused') {
                    if (openInventoryOnPause) {
                        // Close inventory: Resume
                        setGameState('playing');
                        setOpenInventoryOnPause(false);
                    } else {
                        // In pause menu -> Open inventory
                        setOpenInventoryOnPause(true);
                    }
                }
            } else if (e.code === 'Escape') {
                // If Escape is pressed, we ensure the inventory flag is reset
                // so next time we pause it doesn't auto-open inventory
                if (gameState === 'playing') {
                    setOpenInventoryOnPause(false);
                } else if (gameState === 'paused') {
                    // Resume game on Escape (closes inventory or pause menu)
                    setGameState('playing');
                    setOpenInventoryOnPause(false);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [gameState, setGameState, openInventoryOnPause, clearDungeonResult]);

    const isMobile = useSettingsStore((state) => state.isMobile);

    return (
        <>
            {/* Main Menu - Only visible in 'menu' state */}
            {gameState === 'menu' && <MainMenu />}

            {/* Intro Screen - Shows lore before playing */}
            {gameState === 'intro' && <IntroScreen />}

            {/* Class Select Screen - Choose instrument */}
            {gameState === 'classSelect' && <ClassSelectScreen />}

            {/* Mobile Pause Button - Top Left */}
            {gameState === 'playing' && isMobile && (
                <button
                    onClick={() => setGameState('paused')}
                    className="fixed top-4 left-4 z-50 w-10 h-10 bg-black/60 backdrop-blur-md rounded-full border border-white/20 flex items-center justify-center text-white shadow-lg active:scale-95"
                >
                    <span className="text-xl">⏸️</span>
                </button>
            )
            }

            {/* Player HUD & Combat Controls - Visible when playing or paused */}
            {
                (gameState === 'playing' || gameState === 'paused') && (
                    <>
                        <PlayerHUD />
                        <DungeonHUD />
                        <CombatHUD />
                    </>
                )
            }

            {/* Pause Menu - Overlay when paused */}
            {gameState === 'paused' && <PauseMenu defaultOpenInventory={openInventoryOnPause} />}

            {/* Death Screen - Overlay when game over */}
            {gameState === 'gameOver' && <DeathScreen />}

            {/* Dungeon Summary Screen - Appears after dungeon escape */}
            <DungeonSummaryScreen />
        </>
    );
}

export default GameUI;
