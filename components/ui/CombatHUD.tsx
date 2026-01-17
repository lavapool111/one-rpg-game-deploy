'use client';

import { usePlayerStore } from '@/lib/store';
import { useEffect, useState } from 'react';

/**
 * CombatHUD Component
 * Displays combat controls, specifically the "Long Tone" attack button.
 * Positioned in the bottom-right corner.
 */
export function CombatHUD() {
    const {
        isLongToneActive,
        longToneCooldown,
        longToneTotalCooldown,
        triggerLongTone
    } = usePlayerStore();

    const [timeLeft, setTimeLeft] = useState(0);
    const [progress, setProgress] = useState(1);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '1') {
                handleAttack();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [timeLeft, isLongToneActive, triggerLongTone]); // Re-bind when state changes to ensure fresh closure if needed, though handleAttack uses refs usually. Wait, handleAttack uses timeLeft state.

    // Note: handleAttack uses timeLeft from state. If we use it in listener, we need it in dependency array.
    // Better: use store state directly or rely on component re-render. 
    // Since we put [timeLeft] in dependency, it will re-bind on tick. That's fine but inefficient. 
    // Optimization: Check store in the handler? usePlayerStore.getState()... 

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '1') {
                // Check cooldown directly from store to avoid stale closure issues or frequent re-binds
                const state = usePlayerStore.getState();
                const now = Date.now();
                if (now >= state.longToneCooldown) {
                    state.triggerLongTone();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        let animationFrame: number;

        const updateState = () => {
            const now = Date.now();
            if (now < longToneCooldown) {
                const remaining = longToneCooldown - now;
                setTimeLeft(remaining / 1000);
                setProgress(1 - (remaining / longToneTotalCooldown));
                animationFrame = requestAnimationFrame(updateState);
            } else {
                setTimeLeft(0);
                setProgress(1);
            }
        };

        if (longToneCooldown > Date.now()) {
            updateState();
        } else {
            setTimeLeft(0);
            setProgress(1);
        }

        return () => cancelAnimationFrame(animationFrame);
    }, [longToneCooldown, longToneTotalCooldown]);

    const handleAttack = () => {
        if (timeLeft <= 0) {
            triggerLongTone();
        }
    };

    return (
        <div className="absolute bottom-8 right-8 pointer-events-auto z-50">
            {/* Attack Button */}
            <button
                onClick={handleAttack}
                disabled={timeLeft > 0}
                className={`
                    relative w-24 h-24 rounded-full flex items-center justify-center
                    border-4 transition-all duration-200
                    ${isLongToneActive
                        ? 'bg-red-500/50 border-red-400 scale-110 shadow-[0_0_20px_rgba(239,68,68,0.6)]'
                        : timeLeft > 0
                            ? 'bg-gray-900/80 border-gray-700 opacity-80 cursor-not-allowed'
                            : 'bg-indigo-600/90 border-indigo-400 hover:bg-indigo-500 hover:scale-105 active:scale-95 shadow-lg'
                    }
                `}
            >
                {/* Cooldown Overlay */}
                {timeLeft > 0 && (
                    <div
                        className="absolute inset-0 bg-black/60 rounded-full"
                        style={{ clipPath: `conic-gradient(transparent ${progress * 360}deg, black 0deg)` }}
                    />
                )}

                {/* Icon/Text */}
                <div className="flex flex-col items-center z-10">
                    <span className="text-2xl mb-1">🎵</span>
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                        {isLongToneActive ? 'ACTIVE' : timeLeft > 0 ? timeLeft.toFixed(1) : 'Long Tone'}
                    </span>
                </div>

                {/* Ring Timer (Visual Flair) */}
                {timeLeft > 0 && (
                    <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
                        <circle
                            cx="48"
                            cy="48"
                            r="44"
                            fill="none"
                            stroke="white"
                            strokeOpacity="0.3"
                            strokeWidth="2"
                            strokeDasharray="276"
                            strokeDashoffset={276 * (1 - progress)}
                        />
                    </svg>
                )}
            </button>

            {/* Keyboard Hint */}
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-xs font-mono whitespace-nowrap">
                [1] or [CLICK]
            </div>
        </div>
    );
}

export default CombatHUD;
