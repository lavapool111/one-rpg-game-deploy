'use client';

import { useGameStore, usePlayerStore } from '@/lib/store';
import { useEffect, useState, useCallback } from 'react';

/**
 * DeathScreen Component
 * Displayed when player health reaches 0.
 * 
 * Features:
 * - "You Died" message
 * - "Respawn" button with auto-trigger
 * - 3-second auto-respawn timer
 */
export function DeathScreen() {
    const { setGameState } = useGameStore();
    const { respawn } = usePlayerStore();
    const [isVisible, setIsVisible] = useState(false);
    const [countdown, setCountdown] = useState(3);

    // Auto-trigger respawn logic
    const handleRespawn = useCallback(() => {
        setIsVisible(false);
        // Short delay for fade-out before reset
        setTimeout(() => {
            respawn(); // Uses new respawn logic that keeps level/xp
        }, 500);
    }, [respawn]);

    useEffect(() => {
        // Instant visibility
        setIsVisible(true);

        // Countdown timer
        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleRespawn();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [handleRespawn]);

    return (
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black transition-opacity duration-75 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>

            <div className="text-center">
                <h1 className="text-6xl md:text-8xl font-black text-red-600 mb-8 tracking-widest uppercase drop-shadow-[0_0_25px_rgba(220,38,38,0.6)] animate-pulse">
                    You Died
                </h1>

                <div className="mt-8 opacity-0 animate-[fadeIn_0.5s_ease-in_forwards]">
                    <button
                        onClick={handleRespawn}
                        className="px-8 py-3 bg-transparent border-2 border-white/20 text-white/80 hover:bg-white/10 hover:border-white/50 hover:text-white transition-all duration-300 rounded font-medium tracking-wide uppercase group"
                    >
                        Respawn <span className="text-white/40 group-hover:text-white/60 ml-2">({countdown})</span>
                    </button>

                    <p className="mt-6 text-white/30 text-sm">
                        Tip: Avoid the Trumpet's fanfare attacks
                    </p>
                </div>
            </div>
        </div>
    );
}

export default DeathScreen;
