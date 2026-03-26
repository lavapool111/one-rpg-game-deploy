'use client';

import { useEffect } from 'react';
import { useGameStore, usePlayerStore } from '@/lib/store';
import { TIER_COLORS } from '@/lib/game/dungeonTiers';
import { getTerms } from '@/lib/store/playerStore';

/**
 * DungeonSummaryScreen
 * 
 * Modal displayed after escaping or failing a dungeon run.
 * Shows: Tier achieved, Gold collected, Rewards granted.
 */

export function DungeonSummaryScreen() {
    const lastDungeonResult = useGameStore((state) => state.lastDungeonResult);
    const clearDungeonResult = useGameStore((state) => state.clearDungeonResult);
    const playerClass = usePlayerStore((state) => state.playerClass);
    const terms = getTerms(playerClass);

    // Release pointer lock when summary screen appears
    useEffect(() => {
        if (lastDungeonResult) {
            document.exitPointerLock();
        }
    }, [lastDungeonResult]);

    if (!lastDungeonResult) return null;

    const { gold, tier, tierName, rewards, success } = lastDungeonResult;
    const tierColor = TIER_COLORS[tier];

    const handleClose = () => {
        clearDungeonResult();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto">
            <div
                className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 max-w-md w-full mx-4 border border-white/10 shadow-2xl"
                style={{ borderColor: tierColor + '50' }}
            >
                {/* Header */}
                <div className="text-center mb-6">
                    <h2 className={`text-2xl font-bold mb-2 ${success ? 'text-green-400' : 'text-red-400'}`}>
                        {success ? '🏆 Dungeon Cleared!' : '💀 Run Failed'}
                    </h2>
                    <div
                        className="text-3xl font-black py-2 px-4 rounded-lg inline-block"
                        style={{ backgroundColor: tierColor + '33', color: tierColor }}
                    >
                        {tierName}
                    </div>
                </div>

                {/* Gold Collected */}
                <div className="bg-yellow-900/30 rounded-lg p-4 mb-4 text-center border border-yellow-500/30">
                    <div className="text-yellow-300 text-sm uppercase">Gold Collected</div>
                    <div className="text-yellow-400 text-4xl font-bold">💰 {gold}</div>
                </div>

                {/* Rewards List */}
                <div className="bg-black/30 rounded-lg p-4 mb-6">
                    <div className="text-white/70 text-sm uppercase mb-3">Rewards</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        {rewards.echoes > 0 && (
                            <RewardItem label="Echoes" value={rewards.echoes} icon="✨" />
                        )}
                        {rewards.valves > 0 && (
                            <RewardItem label="Valves" value={rewards.valves} icon="🔩" />
                        )}
                        {rewards.heavyValves > 0 && (
                            <RewardItem label="Heavy Valves" value={rewards.heavyValves} icon="⚙️" />
                        )}
                        {rewards.corkGrease > 0 && (
                            <RewardItem label="Cork Grease" value={rewards.corkGrease} icon="🧴" />
                        )}
                        {rewards.valveOil > 0 && (
                            <RewardItem label="Valve Oil" value={rewards.valveOil} icon="🛢️" />
                        )}
                        {rewards.slides > 0 && (
                            <RewardItem label="Slides" value={rewards.slides} icon="📏" />
                        )}
                        {rewards.brassIngots > 0 && (
                            <RewardItem label="Brass Ingots" value={rewards.brassIngots} icon="🟡" />
                        )}
                        {rewards.reinforcedIngots > 0 && (
                            <RewardItem label="Reinforced Ingots" value={rewards.reinforcedIngots} icon="⭐" />
                        )}
                        {rewards.moonlightAzarite > 0 && (
                            <RewardItem label="Moonlight Azarite" value={rewards.moonlightAzarite} icon="💎" />
                        )}
                        {rewards.sheetMusicCommon > 0 && (
                            <RewardItem label="Common Sheet Music" value={rewards.sheetMusicCommon} icon="🎶" />
                        )}
                        {rewards.sheetMusicRare > 0 && (
                            <RewardItem label="Rare Sheet Music" value={rewards.sheetMusicRare} icon="🎹" />
                        )}
                        {rewards.sheetMusicLegendary > 0 && (
                            <RewardItem label="Legendary Sheet Music" value={rewards.sheetMusicLegendary} icon="🎼" />
                        )}
                        {rewards.reeds.length > 0 && (
                            <RewardItem label={terms.reeds} value={rewards.reeds.length} icon="🎵" />
                        )}
                        {rewards.commonAccessory && (
                            <RewardItem label="Accessory" value={1} icon="💍" />
                        )}
                        {rewards.rareAccessory && (
                            <RewardItem label="Rare Accessory" value={1} icon="👑" />
                        )}
                    </div>
                    {rewards.echoes === 0 && rewards.valves === 0 && (
                        <div className="text-white/50 text-center py-2">No rewards this time...</div>
                    )}
                </div>

                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-lg hover:from-blue-500 hover:to-indigo-500 transition-all duration-200 shadow-lg"
                >
                    Continue
                </button>
            </div>
        </div>
    );
}

function RewardItem({ label, value, icon }: { label: string; value: number; icon: string }) {
    return (
        <div className="flex items-center gap-2 bg-white/5 rounded px-2 py-1.5">
            <span>{icon}</span>
            <span className="text-white/80">{label}</span>
            <span className="text-white font-bold ml-auto">x{value}</span>
        </div>
    );
}

export default DungeonSummaryScreen;
