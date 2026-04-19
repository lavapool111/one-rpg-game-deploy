'use client';

import { useGameStore } from '@/lib/store';

export function WaveUI() {
    const altarRoomWave = useGameStore((state) => state.altarRoomWave);
    const enemiesRemaining = useGameStore((state) => state.altarRoomWaveEnemiesRemaining);
    const enemiesTotal = useGameStore((state) => state.altarRoomWaveEnemiesTotal);

    const altarDeathCount = useGameStore((state) => state.altarDeathCount);
    const isInAltarRoom = useGameStore((state) => state.isInAltarRoom);

    if (!isInAltarRoom) return null;

    const maxWaves = 5;
    const maxDeaths = 10;

    // Calculate progress percentage
    const progressText = enemiesTotal > 0 ? `${enemiesTotal - enemiesRemaining} / ${enemiesTotal} Defeated` : '';
    const progress = enemiesTotal > 0 ? ((enemiesTotal - enemiesRemaining) / enemiesTotal) * 100 : 0;

    return (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex flex-col items-center w-[90vw] max-w-[380px]">
            {altarRoomWave === 0 ? (
                <div className="bg-black/80 border-2 border-amber-900/50 rounded-lg p-4 shadow-[0_0_15px_rgba(255,100,0,0.3)] backdrop-blur-sm min-w-[320px] text-center animate-pulse-slow">
                    <h2 className="text-2xl font-bold text-amber-500/80 drop-shadow-md tracking-wider">
                        AWAITING RITUAL...
                    </h2>
                </div>
            ) : altarRoomWave <= maxWaves ? (
                <>
                    <h2 className="text-2xl font-bold text-white drop-shadow-md tracking-wider mb-2">
                        ALTAR ROOM
                    </h2>
                    <div className="bg-black/80 border-2 border-amber-900/50 rounded-lg p-3 shadow-[0_0_15px_rgba(255,100,0,0.3)] backdrop-blur-sm min-w-[320px] text-center">
                        <div className="flex justify-between items-end mb-1 px-1">
                            <span className="text-amber-500 font-bold text-lg">Wave {altarRoomWave} / {maxWaves}</span>
                            <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">{progressText}</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-2">
                            <div
                                className="h-full bg-gradient-to-r from-orange-600 to-amber-400 transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>

                        {/* Death Counter */}
                        <div className="flex justify-center items-center gap-2 mt-1">
                            <span className="text-xs text-white/40 uppercase font-bold tracking-tighter">Resurrection Limit</span>
                            <div className="flex gap-1">
                                {Array.from({ length: maxDeaths }).map((_, i) => (
                                    <div
                                        key={i}
                                        className={`w-3 h-1.5 rounded-sm transition-all duration-500 ${i < (maxDeaths - altarDeathCount)
                                            ? 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]'
                                            : 'bg-zinc-800'
                                            }`}
                                    />
                                ))}
                            </div>
                            <span className={`text-xs font-bold ml-1 ${altarDeathCount >= 7 ? 'text-red-500 animate-pulse' : 'text-red-900/60'}`}>
                                {altarDeathCount} / {maxDeaths}
                            </span>
                        </div>
                    </div>
                </>
            ) : (
                <div className="bg-black/80 border-2 border-green-500/80 rounded-lg p-4 shadow-[0_0_25px_rgba(34,197,94,0.5)] backdrop-blur-sm animate-pulse-slow text-center min-w-[350px]">
                    <h2 className="text-2xl font-bold text-green-400 drop-shadow-md uppercase tracking-widest">
                        Ritual Complete
                    </h2>
                    <p className="text-green-200/80 text-sm mt-1">The trial has ended for now.</p>
                </div>
            )}
        </div>
    );
}
