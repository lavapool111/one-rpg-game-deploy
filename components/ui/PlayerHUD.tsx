'use client';

import { usePlayerStore } from '@/lib/store';
import { useEffect, useState } from 'react';

/**
 * PlayerHUD Component
 * Displays player stats: health bar, xp bar, level, and cooldowns
 * Positioned in the top-right corner
 */
export function PlayerHUD() {
    const {
        level,
        health,
        maxHealth,
        xp,
        maxXp,
        damage,
        speed,
        lastAttackTime,
        attackCooldown,
        tempo,
        tempoRating,
        lastKillTime
    } = usePlayerStore();

    // Local state for smooth cooldown animation
    const [cooldownProgress, setCooldownProgress] = useState(0);

    // Real-time Tempo expiration check (reset after 7s window)
    useEffect(() => {
        if (tempo === 0 || lastKillTime === 0) return;

        const COMBO_WINDOW = 7000;
        const timeUntilExpiry = (lastKillTime + COMBO_WINDOW) - Date.now();

        if (timeUntilExpiry <= 0) {
            // Already expired
            usePlayerStore.setState({ tempo: 0, tempoRating: 'F' });
            return;
        }

        // Set timeout to reset when combo expires
        const timerId = setTimeout(() => {
            usePlayerStore.setState({ tempo: 0, tempoRating: 'F' });
        }, timeUntilExpiry);

        return () => clearTimeout(timerId);
    }, [tempo, lastKillTime]);

    // Update cooldown progress
    useEffect(() => {
        let animationFrame: number;

        const updateCooldown = () => {
            const now = Date.now();
            const timeSinceAttack = (now - lastAttackTime) / 1000; // seconds

            if (timeSinceAttack < attackCooldown) {
                // Calculate percentage (0 to 1)
                const progress = timeSinceAttack / attackCooldown;
                setCooldownProgress(progress);
                animationFrame = requestAnimationFrame(updateCooldown);
            } else {
                setCooldownProgress(1);
            }
        };

        if (lastAttackTime > 0) {
            updateCooldown();
        } else {
            setCooldownProgress(1);
        }

        return () => cancelAnimationFrame(animationFrame);
    }, [lastAttackTime, attackCooldown]);

    // Round to tenths to avoid floating point display errors
    const roundToTenths = (value: number) => Math.round(value * 10) / 10;

    const healthPercentage = (health / maxHealth) * 100;
    const xpPercentage = (xp / maxXp) * 100;

    // Health bar color based on percentage
    const getHealthColor = () => {
        if (healthPercentage > 60) return 'bg-red-500';
        if (healthPercentage > 30) return 'bg-red-600';
        return 'bg-red-700';
    };

    const { embouchure } = usePlayerStore();

    return (
        <div className="absolute top-4 right-4 pointer-events-none z-50 flex flex-col items-end gap-2">
            {/* Main Stats Panel */}
            <div className="bg-black/80 backdrop-blur-md rounded-xl p-4 min-w-[240px] border border-white/10 shadow-xl">

                {/* Header: Class & Level */}
                <div className="flex items-center justify-between mb-3">
                    <span className="text-white font-bold text-shadow-sm">Bb Clarinet</span>
                    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-2 py-0.5 rounded shadow-sm text-white text-xs font-bold border border-white/20">
                        LV {level}
                    </div>
                </div>

                {/* Health Bar */}
                <div className="mb-2">
                    <div className="flex justify-between text-xs font-medium text-white/90 mb-1">
                        <span className="flex items-center gap-1">
                            <span>🩷</span> {roundToTenths(health)}
                        </span>
                        <span className="text-white/60">/ {roundToTenths(maxHealth)}</span>
                    </div>
                    <div className="relative w-full h-3 bg-gray-900/80 rounded-full overflow-hidden border border-white/5">
                        <div
                            className={`h-full ${getHealthColor()} transition-all duration-300 shadow-[0_0_10px_rgba(239,68,68,0.5)]`}
                            style={{ width: `${healthPercentage}%` }}
                        />
                    </div>
                </div>

                {/* XP Bar */}
                <div className="mb-4">
                    <div className="flex justify-between text-[10px] font-medium text-blue-200/80 mb-1">
                        <span>XP</span>
                        <span>{Math.floor(xp)} / {maxXp}</span>
                    </div>
                    <div className="relative w-full h-1.5 bg-gray-900/80 rounded-full overflow-hidden border border-white/5">
                        <div
                            className="h-full bg-blue-500 transition-all duration-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                            style={{ width: `${xpPercentage}%` }}
                        />
                    </div>
                </div>

                {/* Tempo Combo Display */}
                <div className="mb-4 flex items-center justify-between bg-gradient-to-r from-orange-900/50 to-red-900/50 rounded-lg px-3 py-2 border border-orange-500/30">
                    <div className="flex items-center gap-2">
                        <span className="text-orange-400 text-xs font-bold uppercase">Tempo</span>
                        <span className="text-white font-bold">{tempo}x</span>
                    </div>
                    <div className={`font-black text-xl ${tempoRating === 'Z' ? 'text-yellow-400 animate-pulse' : tempoRating === 'SSS' ? 'text-purple-400' : tempoRating === 'SS' ? 'text-blue-400' : tempoRating === 'S' ? 'text-green-400' : 'text-white'}`}>
                        {tempoRating}
                    </div>
                </div>

                {/* Stats Grid & Cooldown */}
                <div className="flex items-end justify-between">
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-white/5 rounded px-2 py-1.5 border border-white/5">
                            <div className="text-white/40 text-[10px] uppercase">DMG</div>
                            <div className="text-white font-bold">{damage}</div>
                        </div>
                        <div className="bg-white/5 rounded px-2 py-1.5 border border-white/5">
                            <div className="text-white/40 text-[10px] uppercase">SPD</div>
                            <div className="text-white font-bold">{speed.toFixed(1)}</div>
                        </div>
                        <div className="bg-white/5 rounded px-2 py-1.5 border border-white/5 col-span-2">
                            <div className="text-white/40 text-[10px] uppercase">EMBOUCHURE</div>
                            <div className="text-white font-bold text-yellow-400">LV {embouchure}</div>
                        </div>
                    </div>

                    {/* Attack Cooldown Indicator */}
                    <div className="relative w-10 h-10 ml-3">
                        {/* Background Ring */}
                        <div className="absolute inset-0 rounded-full border-2 border-white/10" />

                        {/* Progress Ring (SVG) */}
                        <svg className="absolute inset-0 w-full h-full -rotate-90">
                            <circle
                                cx="20"
                                cy="20"
                                r="16"
                                fill="none"
                                stroke={cooldownProgress >= 1 ? '#4ade80' : '#fbbf24'} // Green when ready, Yellow when cooling
                                strokeWidth="3"
                                strokeDasharray="100"
                                strokeDashoffset={100 - (cooldownProgress * 100)}
                                className="transition-all duration-75"
                            />
                        </svg>

                        {/* Icon */}
                        <div className="absolute inset-0 flex items-center justify-center text-sm">
                            {cooldownProgress >= 1 ? '⚔️' : '⏳'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile-friendly spacing */}
            <div className="h-safe-bottom" />
        </div>
    );
}

export default PlayerHUD;
