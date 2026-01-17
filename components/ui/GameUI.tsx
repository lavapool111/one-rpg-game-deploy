'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/lib/store';
import { MainMenu } from './MainMenu';
import { PauseMenu } from './PauseMenu';
import { DeathScreen } from './DeathScreen';
import { PlayerHUD } from './PlayerHUD';
import { CombatHUD } from './CombatHUD';

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

    // Global key handler for inventory
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle keys if we are playing or paused
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
    }, [gameState, setGameState]);

    return (
        <>
            {/* Main Menu - Only visible in 'menu' state */}
            {gameState === 'menu' && <MainMenu />}

            {/* Player HUD & Combat Controls - Visible when playing or paused */}
            {(gameState === 'playing' || gameState === 'paused') && (
                <>
                    <PlayerHUD />
                    <CombatHUD />
                </>
            )}

            {/* Pause Menu - Overlay when paused */}
            {gameState === 'paused' && <PauseMenu defaultOpenInventory={openInventoryOnPause} />}

            {/* Death Screen - Overlay when game over */}
            {gameState === 'gameOver' && <DeathScreen />}
        </>
    );
}

export default GameUI;
