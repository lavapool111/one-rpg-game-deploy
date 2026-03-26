'use client';

import { usePlayerStore, getAbilityName } from '@/lib/store/playerStore';
import { useInventoryStore } from '@/lib/store/inventoryStore';
import { ABILITY_UPGRADES_UNLOCK_LEVEL, ABILITY_UPGRADES_TIER_2_UNLOCK_LEVEL } from '@/lib/game/abilityUpgrades';

interface AbilityUpgradeSubTabProps {
    playerClass: 'bb_clarinet' | 'viola';
    onOpenUpgradeScreen: () => void;
}

export function AbilityUpgradeSubTab({ playerClass, onOpenUpgradeScreen }: AbilityUpgradeSubTabProps) {
    const level = usePlayerStore((state) => state.level);
    const abilityUpgrades = usePlayerStore((state) => state.abilityUpgrades);
    const getAbilityUpgradeStats = usePlayerStore((state) => state.getAbilityUpgradeStats);
    const abilityName = getAbilityName(playerClass);
    const isUnlocked = level >= ABILITY_UPGRADES_UNLOCK_LEVEL;
    const isTier2Unlocked = level >= ABILITY_UPGRADES_TIER_2_UNLOCK_LEVEL;
    const abilityStats = getAbilityUpgradeStats();
    const brassEssence = useInventoryStore((state) => state.inventory.materials.brass_essence || 0);

    // Determine current tier and display
    const currentTier = abilityUpgrades.currentLevel === 0 ? 0 : abilityUpgrades.currentLevel <= 10 ? 1 : 2;
    const maxLevel = currentTier === 2 ? 25 : 10;
    const tierLabel = currentTier === 0 ? 'No Upgrades' : currentTier === 1 ? 'Tier 1' : 'Tier 2';

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="p-4 bg-slate-800/40 border border-slate-700 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-yellow-500 text-xs font-bold uppercase tracking-wider">{abilityName} Upgrades</h3>
                    <span className={`text-xs font-semibold ${isUnlocked ? 'text-green-400' : 'text-red-400'}`}>
                        {isUnlocked ? 'Unlocked' : `Requires Level ${ABILITY_UPGRADES_UNLOCK_LEVEL}`}
                    </span>
                </div>

                {!isUnlocked ? (
                    <p className="text-sm text-slate-400">
                        Ability upgrades unlock at level {ABILITY_UPGRADES_UNLOCK_LEVEL}. Current level: {level}
                    </p>
                ) : (
                    <div className="space-y-3">
                        {/* Tier Badge */}
                        <div className="flex items-center justify-between">
                            <span className="text-slate-400 text-sm">Current Tier:</span>
                            <span className={`text-sm font-bold px-2 py-1 rounded ${currentTier === 0 ? 'bg-slate-700 text-slate-400' :
                                    currentTier === 1 ? 'bg-blue-900/50 text-blue-400 border border-blue-700' :
                                        'bg-purple-900/50 text-purple-400 border border-purple-700'
                                }`}>
                                {tierLabel}
                            </span>
                        </div>

                        {/* Current Status */}
                        <div className="flex items-center justify-between">
                            <span className="text-slate-300">Current Upgrade Level:</span>
                            <span className="text-yellow-400 font-bold text-lg">
                                {abilityUpgrades.currentLevel} / {maxLevel}
                            </span>
                        </div>

                        {/* Tier 2 Lock */}
                        {abilityUpgrades.currentLevel >= 10 && !isTier2Unlocked && (
                            <div className="p-3 bg-red-900/20 border border-red-700/50 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <span className="text-red-400 text-sm font-semibold">Tier 2 Locked</span>
                                    <span className="text-red-400 text-xs">Requires Level {ABILITY_UPGRADES_TIER_2_UNLOCK_LEVEL}</span>
                                </div>
                                <p className="text-red-300/70 text-xs mt-1">
                                    Current level: {level} / {ABILITY_UPGRADES_TIER_2_UNLOCK_LEVEL}
                                </p>
                            </div>
                        )}

                        {abilityUpgrades.chosenPath && (
                            <div className="flex items-center justify-between">
                                <span className="text-slate-300">Chosen Path:</span>
                                <span className={`
                                    font-semibold
                                    ${abilityUpgrades.chosenPath === 'crits' ? 'text-orange-400' : ''}
                                    ${abilityUpgrades.chosenPath === 'brute_force' ? 'text-red-400' : ''}
                                    ${abilityUpgrades.chosenPath === 'poison' ? 'text-green-400' : ''}
                                `}>
                                    {abilityUpgrades.chosenPath === 'crits' ? 'Critical Hits' :
                                        abilityUpgrades.chosenPath === 'brute_force' ? 'Brute Force' : 'Poison'}
                                </span>
                            </div>
                        )}

                        {/* Brass Essence */}
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-400">Brass Essence Available:</span>
                            <span className="text-yellow-400 font-semibold">{brassEssence}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Active Bonuses */}
            {isUnlocked && abilityUpgrades.currentLevel > 0 && (
                <div className="p-4 bg-slate-800/30 border border-yellow-600/20 rounded-lg">
                    <h4 className="text-yellow-500 text-xs font-bold uppercase tracking-wider mb-3">Active Bonuses</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        {abilityStats.critChance > 0 && (
                            <div className="flex justify-between">
                                <span className="text-slate-400">Ability Crit Chance</span>
                                <span className="text-orange-400">+{(abilityStats.critChance * 100).toFixed(1)}%</span>
                            </div>
                        )}
                        {abilityStats.critFactor > 0 && (
                            <div className="flex justify-between">
                                <span className="text-slate-400">Ability Crit Factor</span>
                                <span className="text-orange-400">{abilityStats.critFactor.toFixed(2)}x</span>
                            </div>
                        )}
                        {abilityStats.baseDamageBonus > 0 && (
                            <div className="flex justify-between">
                                <span className="text-slate-400">Base Damage Bonus</span>
                                <span className="text-red-400">+{(abilityStats.baseDamageBonus * 100).toFixed(0)}%</span>
                            </div>
                        )}
                        {abilityStats.damageMultiplier > 1 && (
                            <div className="flex justify-between">
                                <span className="text-slate-400">Damage Multiplier</span>
                                <span className="text-yellow-400">×{abilityStats.damageMultiplier.toFixed(2)}</span>
                            </div>
                        )}
                        {abilityStats.rangeBonus > 0 && (
                            <div className="flex justify-between">
                                <span className="text-slate-400">Range Bonus</span>
                                <span className="text-cyan-400">+{abilityStats.rangeBonus.toFixed(1)} ft</span>
                            </div>
                        )}
                        {/* Tier 2 Stats */}
                        {abilityStats.tickSpeedBonus > 0 && (
                            <div className="flex justify-between">
                                <span className="text-slate-400">Tick Speed</span>
                                <span className="text-purple-400">+{(abilityStats.tickSpeedBonus * 100).toFixed(0)}%</span>
                            </div>
                        )}
                        {abilityUpgrades.chosenPath === 'brute_force' && abilityStats.impactBonus > 0 && (
                            <div className="flex justify-between">
                                <span className="text-slate-400">Impact</span>
                                <span className="text-red-400">+{abilityStats.impactBonus.toFixed(1)}</span>
                            </div>
                        )}
                        {abilityStats.durationBonus > 0 && (
                            <div className="flex justify-between">
                                <span className="text-slate-400">Duration Bonus</span>
                                <span className="text-green-400">+{abilityStats.durationBonus.toFixed(1)}s</span>
                            </div>
                        )}
                        {abilityStats.cooldownReduction > 0 && (
                            <div className="flex justify-between">
                                <span className="text-slate-400">Cooldown Reduction</span>
                                <span className="text-blue-400">-{(abilityStats.cooldownReduction * 100).toFixed(0)}%</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Open Full Upgrade Screen Button */}
            {isUnlocked && (
                <button
                    onClick={onOpenUpgradeScreen}
                    className="w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all bg-yellow-600 hover:bg-yellow-500 text-white shadow-lg shadow-yellow-900/20"
                >
                    {abilityUpgrades.currentLevel === 0 ? 'Choose Upgrade Path' : 'Purchase Upgrades'}
                </button>
            )}
        </div>
    );
}
