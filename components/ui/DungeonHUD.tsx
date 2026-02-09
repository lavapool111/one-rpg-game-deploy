'use client';

import { useEffect, useState, useRef } from 'react';
import { useGameStore } from '@/lib/store';

/**
 * DungeonHUD Component
 * 
 * Displays dungeon-specific UI when in the Backstage Halls:
 * - Timer countdown
 * - Gold collected
 * - Keys (melodic and resonance)
 * - Run Failed overlay when time expires
 */
export function DungeonHUD() {
    const currentLocation = useGameStore((state) => state.currentLocation);
    const dungeonState = useGameStore((state) => state.dungeonState);
    const failDungeonRun = useGameStore((state) => state.failDungeonRun);

    const [remainingTime, setRemainingTime] = useState<number>(0);
    const [runFailed, setRunFailed] = useState(false);
    const failedRef = useRef(false);

    // Update timer countdown
    useEffect(() => {
        if (!dungeonState) {
            failedRef.current = false;
            setRunFailed(false);
            return;
        }

        const updateTimer = () => {
            const elapsed = (Date.now() - dungeonState.startTime) / 1000;
            const remaining = Math.max(0, dungeonState.timeLimit - elapsed);
            setRemainingTime(remaining);

            // Check for time expiry
            if (remaining <= 0 && !failedRef.current) {
                failedRef.current = true;
                setRunFailed(true);
                // Release pointer lock so player can see the message
                document.exitPointerLock();
                // Return to band room after showing message
                setTimeout(() => {
                    // Only fail if player hasn't already escaped
                    const currentState = useGameStore.getState();
                    if (currentState.currentLocation === 'backstage_halls' && currentState.dungeonState) {
                        failDungeonRun();
                    }
                }, 2000);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 100);

        return () => clearInterval(interval);
    }, [dungeonState, failDungeonRun]);

    // Only show when in Backstage Halls
    if (currentLocation !== 'backstage_halls') {
        return null;
    }

    // Show Run Failed overlay
    if (runFailed) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80">
                <div className="text-center">
                    <div className="text-red-500 text-6xl font-bold mb-4 animate-pulse">
                        RUN FAILED
                    </div>
                    <div className="text-white/70 text-xl">
                        Time ran out! All gold lost.
                    </div>
                    <div className="text-white/50 text-sm mt-4">
                        Returning to Band Room...
                    </div>
                </div>
            </div>
        );
    }

    if (!dungeonState) return null;

    // Format time as MM:SS
    const minutes = Math.floor(remainingTime / 60);
    const seconds = Math.floor(remainingTime % 60);
    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Timer color based on time remaining
    const getTimerColor = () => {
        if (remainingTime <= 5) return 'text-red-500 animate-pulse';
        if (remainingTime <= 10) return 'text-yellow-400';
        return 'text-white';
    };

    return (
        <div className="absolute top-4 left-4 pointer-events-none z-50 flex flex-col items-start gap-2">
            {/* Dungeon Stats Panel */}
            <div className="bg-black/80 backdrop-blur-md rounded-xl p-4 min-w-[200px] border border-amber-500/30 shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <span className="text-amber-400 font-bold text-sm uppercase tracking-wide">
                        Backstage Halls
                    </span>
                </div>

                {/* Timer */}
                <div className="mb-3">
                    <div className="flex items-center gap-2">
                        <span className="text-white/60 text-xs">⏱️ TIME</span>
                        <span className={`font-mono font-bold text-xl ${getTimerColor()}`}>
                            {timeString}
                        </span>
                    </div>
                    {/* Timer bar */}
                    <div className="relative w-full h-2 bg-gray-900/80 rounded-full overflow-hidden mt-1 border border-white/5">
                        <div
                            className={`h-full transition-all duration-100 ${remainingTime <= 5 ? 'bg-red-500' : remainingTime <= 10 ? 'bg-yellow-500' : 'bg-amber-500'}`}
                            style={{ width: `${(remainingTime / dungeonState.timeLimit) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Gold */}
                <div className="flex items-center justify-between mb-2 bg-amber-900/30 rounded-lg px-3 py-2 border border-amber-500/20">
                    <div className="flex items-center gap-2">
                        <span className="text-2xl">💰</span>
                        <span className="text-amber-400 text-xs font-bold uppercase">Gold</span>
                    </div>
                    <span className="text-white font-bold text-lg">
                        {dungeonState.goldCollected.toLocaleString()}
                    </span>
                </div>

                {/* Keys */}
                <div className="grid grid-cols-2 gap-2">
                    {/* Melodic Key */}
                    <div className="bg-purple-900/30 rounded-lg px-3 py-2 border border-purple-500/20">
                        <div className="text-purple-400 text-[10px] font-bold uppercase">Melodic</div>
                        <div className="flex items-center gap-1">
                            <span className="text-lg">🎵</span>
                            <span className="text-white font-bold">{dungeonState.keys.melodic}</span>
                        </div>
                    </div>

                    {/* Resonance Key */}
                    <div className="bg-blue-900/30 rounded-lg px-3 py-2 border border-blue-500/20">
                        <div className="text-blue-400 text-[10px] font-bold uppercase">Resonance</div>
                        <div className="flex items-center gap-1">
                            <span className="text-lg">🔑</span>
                            <span className="text-white font-bold">{dungeonState.keys.resonance}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DungeonHUD;
