'use client';

import React from 'react';

export interface DungeonTimeUpgradeCardProps {
    inventory: any;
    onUpgrade: () => boolean;
    getCost: () => { valves: number; heavyValves: number; timeIncrease: number };
    getCurrentLimit: () => number;
}

export function DungeonTimeUpgradeCard({ inventory, onUpgrade, getCost, getCurrentLimit }: DungeonTimeUpgradeCardProps) {
    const cost = getCost();
    const currentLimit = getCurrentLimit();

    // Check if affordable
    const valves = inventory.materials.valves || 0;
    const heavyValves = inventory.materials.heavy_valves || 0;
    const canAfford = valves >= cost.valves && heavyValves >= cost.heavyValves;

    return (
        <div className="flex items-center justify-between p-3 bg-slate-800/40 border border-yellow-600/30 rounded-lg hover:bg-slate-800/60 transition-colors">
            {/* Info */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-yellow-900/30 border border-yellow-600/50 flex items-center justify-center text-xl text-yellow-500">
                    ⏱️
                </div>
                <div>
                    <div className="font-bold text-yellow-500">
                        Dungeon Time Limit
                        <span className="ml-2 text-xs text-slate-400">{currentLimit}s</span>
                    </div>
                    <div className="text-xs text-yellow-500/70">
                        Increase time by <span className="text-white font-bold">+{cost.timeIncrease}s</span>
                    </div>
                </div>
            </div>

            {/* Cost & Button */}
            <div className="flex items-center gap-6">
                <div className="flex flex-col gap-1 text-xs text-right">
                    <div className={`flex items-center justify-end gap-1 ${valves >= cost.valves ? 'text-slate-400' : 'text-red-400'}`}>
                        <span>{cost.valves} Valves</span>
                        <span className="opacity-50">({valves})</span>
                    </div>
                    <div className={`flex items-center justify-end gap-1 ${heavyValves >= cost.heavyValves ? 'text-slate-400' : 'text-red-400'}`}>
                        <span>{cost.heavyValves} Heavy Valves</span>
                        <span className="opacity-50">({heavyValves})</span>
                    </div>
                </div>

                <button
                    onClick={onUpgrade}
                    disabled={!canAfford}
                    className={`px-4 py-2 rounded font-bold text-xs uppercase tracking-wider transition-all ${canAfford
                        ? 'bg-yellow-600 hover:bg-yellow-500 text-slate-900 shadow-lg shadow-yellow-900/20'
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        }`}
                >
                    Upgrade
                </button>
            </div>
        </div>
    );
}

export default DungeonTimeUpgradeCard;
