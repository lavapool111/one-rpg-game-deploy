'use client';

import { useState } from 'react';
import { usePlayerStore } from '@/lib/store';
import { useInventoryStore } from '@/lib/store/inventoryStore';
import { ABILITY_UPGRADES_UNLOCK_LEVEL, ABILITY_UPGRADES_TIER_1, ABILITY_UPGRADES_TIER_2, ABILITY_UPGRADES_TIER_2_UNLOCK_LEVEL, AbilityUpgradePath, getNextUpgrade } from '@/lib/game/abilityUpgrades';

interface AbilityUpgradeScreenProps {
    onClose: () => void;
}

export function AbilityUpgradeScreen({ onClose }: AbilityUpgradeScreenProps) {
    const [selectedPath, setSelectedPath] = useState<AbilityUpgradePath | null>(null);
    const [showPathSelection, setShowPathSelection] = useState(false);

    const playerLevel = usePlayerStore((state) => state.level);
    const abilityUpgrades = usePlayerStore((state) => state.abilityUpgrades);
    const inventory = useInventoryStore((state) => state.inventory);
    const purchaseUpgrade = usePlayerStore((state) => state.purchaseAbilityUpgrade);
    const isUnlocked = playerLevel >= ABILITY_UPGRADES_UNLOCK_LEVEL;
    const isTier2Unlocked = playerLevel >= ABILITY_UPGRADES_TIER_2_UNLOCK_LEVEL;
    const maxLevel = 25;

    const brassEssence = inventory.materials.brass_essence || 0;
    const currentLevel = abilityUpgrades.currentLevel;
    const chosenPath = abilityUpgrades.chosenPath;

    const isTier2 = (level: number) => level >= 10;

    // Calculate total cost to max out (Tier 1 + Tier 2 if unlocked)
    const totalRemainingCost = [...ABILITY_UPGRADES_TIER_1.slice(currentLevel), ...(isTier2Unlocked ? ABILITY_UPGRADES_TIER_2.slice(Math.max(0, currentLevel - 10)) : [])].reduce((sum, upgrade) => {
        return sum + upgrade.cost;
    }, 0);

    const handlePurchase = () => {
        if (!isUnlocked) return;

        if (currentLevel === 0 && !chosenPath && !selectedPath) {
            setShowPathSelection(true);
            return;
        }

        const path = currentLevel === 0 ? selectedPath : undefined;
        const success = purchaseUpgrade(path || undefined);

        if (success) {
            setShowPathSelection(false);
            setSelectedPath(null);
        }
    };

    const getNextUpgradeCost = () => {
        if (currentLevel >= maxLevel) return null;
        const isTier2Level = currentLevel >= 10;
        const upgrade = isTier2Level ? ABILITY_UPGRADES_TIER_2[currentLevel - 10] : ABILITY_UPGRADES_TIER_1[currentLevel];

        return upgrade.cost;
    };

    const nextCost = getNextUpgradeCost();
    const canAfford = nextCost !== null && brassEssence >= nextCost;

    const getPathName = (path: AbilityUpgradePath) => {
        switch (path) {
            case 'crits': return 'Critical Hits';
            case 'brute_force': return 'Brute Force';
            case 'poison': return 'Poison';
        }
    };

    const getPathDescription = (path: AbilityUpgradePath) => {
        switch (path) {
            case 'crits': return '+5% crit chance, 1.5x crit factor for ability';
            case 'brute_force': return '+5% base damage for ability';
            case 'poison': return '5% base damage/sec for 5 seconds';
        }
    };

    const getPathColor = (path: AbilityUpgradePath) => {
        switch (path) {
            case 'crits': return 'text-orange-400 border-orange-500 bg-orange-900/20';
            case 'brute_force': return 'text-red-400 border-red-500 bg-red-900/20';
            case 'poison': return 'text-green-400 border-green-500 bg-green-900/20';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-700">
                    <div>
                        <h2 className="text-2xl font-bold text-yellow-400">Ability Upgrades</h2>
                        <p className="text-slate-400 text-sm mt-1">
                            Enhance your Long Tone / Sustained Bow ability
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors text-2xl"
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Lock Status */}
                    {!isUnlocked && (
                        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 text-center">
                            <p className="text-red-300 font-semibold">
                                Requires Level {ABILITY_UPGRADES_UNLOCK_LEVEL} to unlock
                            </p>
                            <p className="text-red-400/70 text-sm mt-1">
                                Current level: {playerLevel}
                            </p>
                        </div>
                    )}

                    {/* Current Status */}
                    {isUnlocked && (
                        <div className="bg-slate-800/50 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-slate-300">Current Upgrade Level:</span>
                                <span className="text-yellow-400 font-bold text-lg">
                                    {currentLevel} / {maxLevel}
                                </span>
                            </div>

                            {chosenPath && (
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-300">Chosen Path:</span>
                                    <span className={`font-semibold ${chosenPath === 'crits' ? 'text-orange-400' :
                                        chosenPath === 'brute_force' ? 'text-red-400' :
                                            'text-green-400'
                                        }`}>
                                        {getPathName(chosenPath)}
                                    </span>
                                </div>
                            )}

                            <div className="mt-4 pt-4 border-t border-slate-700">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-400">Brass Essence:</span>
                                    <span className={`font-semibold ${canAfford ? 'text-yellow-400' : 'text-red-400'}`}>
                                        {brassEssence} / {nextCost !== null ? nextCost : '-'}
                                    </span>
                                </div>
                                {currentLevel < maxLevel && (
                                    <div className="flex items-center justify-between text-sm mt-2">
                                        <span className="text-slate-400">Total to max out:</span>
                                        <span className="text-yellow-400/70">
                                            {totalRemainingCost} Brass Essence
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Path Selection (for first upgrade) */}
                    {isUnlocked && currentLevel === 0 && !chosenPath && showPathSelection && (
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-slate-200">Choose Your Upgrade Path:</h3>
                            <div className="grid grid-cols-1 gap-3">
                                {(['crits', 'brute_force', 'poison'] as AbilityUpgradePath[]).map((path) => (
                                    <button
                                        key={path}
                                        onClick={() => setSelectedPath(path)}
                                        className={`p-4 rounded-lg border-2 transition-all text-left ${selectedPath === path
                                            ? getPathColor(path)
                                            : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
                                            }`}
                                    >
                                        <div className="font-semibold text-lg">
                                            {getPathName(path)}
                                        </div>
                                        <div className={`text-sm mt-1 ${selectedPath === path ? 'text-white/80' : 'text-slate-400'}`}>
                                            {getPathDescription(path)}
                                        </div>
                                        <div className={`text-xs mt-2 font-semibold ${selectedPath === path ? 'text-white' : 'text-slate-500'}`}>
                                            Cost: 3 Brass Essence
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Upgrade Progress */}
                    {isUnlocked && currentLevel > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-slate-200">Upgrade Progress:</h3>
                            <div className="flex flex-wrap gap-1 max-w-md">
                                {Array.from({ length: maxLevel }).map((_, i) => (
                                    <div
                                        key={i}
                                        className={`h-2 w-2 rounded-full flex-shrink-0 ${i < currentLevel
                                            ? chosenPath === 'crits' ? 'bg-orange-500' :
                                                chosenPath === 'brute_force' ? 'bg-red-500' :
                                                    'bg-green-500'
                                            : 'bg-slate-700'
                                            } ${i === 10 ? 'mr-2' : ''}`}
                                    />
                                ))}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                                Levels 1-10: Tier 1 | Levels 11-25: Tier 2
                            </div>
                            <div className="text-sm text-slate-400">
                                {currentLevel === maxLevel ? (
                                    <span className="text-yellow-400 font-semibold">Maximum upgrades reached!</span>
                                ) : currentLevel === 10 && !isTier2Unlocked ? (
                                    <span className="text-red-400 font-semibold">Requires Level {ABILITY_UPGRADES_TIER_2_UNLOCK_LEVEL} for Tier 2 upgrades</span>
                                ) : (
                                    <>Next upgrade: Level {currentLevel + 1}</>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Upgrade Details */}
                    {isUnlocked && currentLevel < maxLevel && chosenPath && (
                        <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700">
                            <h4 className="font-semibold text-slate-200 mb-2">
                                {currentLevel >= 10 ? 'Tier 2 Upgrade Benefits:' : 'Next Upgrade Benefits:'}
                            </h4>
                            <ul className="text-sm text-slate-400 space-y-1">
                                {(() => {
                                    const nextUpgrade = getNextUpgrade(currentLevel, chosenPath);
                                    if (!nextUpgrade) return null;

                                    if (currentLevel < 10) {
                                        // Tier 1 benefits
                                        return ([1, 2, 3, 4].includes(currentLevel) && (
                                            <>
                                                {chosenPath === 'crits' && <li>+{([1, 2].includes(currentLevel) ? 0.7 : [3].includes(currentLevel) ? 0.8 : 0.9)}% ability crit chance</li>}
                                                {chosenPath === 'brute_force' && <li>+{([1, 2].includes(currentLevel) ? 3 : [3].includes(currentLevel) ? 4 : 5)}% base damage</li>}
                                                {chosenPath === 'poison' && <li>+{([1, 2].includes(currentLevel) ? 3 : [3].includes(currentLevel) ? 4 : 5)}% DOT damage</li>}
                                            </>
                                        ));
                                    } else if (currentLevel === 10) {
                                        return <li>+20% tick speed</li>;
                                    } else if (currentLevel === 11) {
                                        return (
                                            <>
                                                {chosenPath === 'crits' && <li>+0.2 crit factor</li>}
                                                {chosenPath === 'brute_force' && <li>+0.5 impact</li>}
                                                {chosenPath === 'poison' && <li>+2% tick speed</li>}
                                            </>
                                        );
                                    } else if (currentLevel === 12) {
                                        return (
                                            <>
                                                {chosenPath === 'crits' && <li>+1.2% crit chance</li>}
                                                {chosenPath === 'brute_force' && <li>+0.6 impact</li>}
                                                {chosenPath === 'poison' && <li>+0.5s DOT duration</li>}
                                            </>
                                        );
                                    } else if (currentLevel === 13) {
                                        return (
                                            <>
                                                {chosenPath === 'crits' && <li>+0.3 crit factor</li>}
                                                {chosenPath === 'brute_force' && <li>+0.7 impact</li>}
                                                {chosenPath === 'poison' && <li>+2.5% tick speed</li>}
                                            </>
                                        );
                                    } else if (currentLevel === 14) {
                                        return <li>+1.5 feet range</li>;
                                    } else if (currentLevel === 15) {
                                        return (
                                            <>
                                                {chosenPath === 'crits' && <li>+0.35 crit factor</li>}
                                                {chosenPath === 'brute_force' && <li>+0.8 impact</li>}
                                                {chosenPath === 'poison' && <li>+3.5% tick speed</li>}
                                            </>
                                        );
                                    } else if (currentLevel === 16) {
                                        return (
                                            <>
                                                {chosenPath === 'crits' && <li>+1.5% crit chance</li>}
                                                {chosenPath === 'brute_force' && <li>+0.9 impact</li>}
                                                {chosenPath === 'poison' && <li>+4% tick speed</li>}
                                            </>
                                        );
                                    } else if (currentLevel === 17) {
                                        return <li>+1% cooldown reduction</li>;
                                    } else if (currentLevel === 18) {
                                        return (
                                            <>
                                                {chosenPath === 'crits' && <li>+0.4 crit factor</li>}
                                                {chosenPath === 'brute_force' && <li>+0.8 impact</li>}
                                                {chosenPath === 'poison' && <li>+3.5% tick speed</li>}
                                            </>
                                        );
                                    } else if (currentLevel === 19) {
                                        return (
                                            <>
                                                {chosenPath === 'crits' && <li>+0.5 crit factor</li>}
                                                {chosenPath === 'brute_force' && <li>+0.8 impact</li>}
                                                {chosenPath === 'poison' && <li>+3.5% tick speed</li>}
                                            </>
                                        );
                                    } else if (currentLevel === 20) {
                                        return <li>+2.5 seconds duration</li>;
                                    } else if (currentLevel === 21) {
                                        return (
                                            <>
                                                {chosenPath === 'crits' && <li>+0.45 crit factor</li>}
                                                {chosenPath === 'brute_force' && <li>+0.9 impact</li>}
                                                {chosenPath === 'poison' && <li>+4% tick speed</li>}
                                            </>
                                        );
                                    } else if (currentLevel === 22) {
                                        return (
                                            <>
                                                {chosenPath === 'crits' && <li>+1.8% crit chance</li>}
                                                {chosenPath === 'brute_force' && <li>+1.0 impact</li>}
                                                {chosenPath === 'poison' && <li>+4.5% tick speed</li>}
                                            </>
                                        );
                                    } else if (currentLevel === 23) {
                                        return (
                                            <>
                                                {chosenPath === 'crits' && <li>+0.5 crit factor</li>}
                                                {chosenPath === 'brute_force' && <li>+1.0 impact</li>}
                                                {chosenPath === 'poison' && <li>+4.5% tick speed</li>}
                                            </>
                                        );
                                    } else if (currentLevel === 24) {
                                        return <li>+2% cooldown reduction</li>;
                                    }
                                    return null;
                                })()}
                                {currentLevel < 10 && currentLevel === 4 && <li>+3% overall damage multiplier</li>}
                                {currentLevel < 10 && [5, 6, 7].includes(currentLevel) && (
                                    <>
                                        {chosenPath === 'crits' && <li>+{([5, 6].includes(currentLevel) ? 0.8 : 0.9)}% ability crit chance</li>}
                                        {chosenPath === 'brute_force' && <li>+{([5, 6].includes(currentLevel) ? 4 : 5)}% base damage</li>}
                                        {chosenPath === 'poison' && <li>+{([5, 6].includes(currentLevel) ? 4 : 5)}% DOT damage</li>}
                                    </>
                                )}
                                {currentLevel < 10 && currentLevel === 8 && <li>+4% overall damage multiplier</li>}
                                {currentLevel < 10 && currentLevel === 9 && <li>+2.5 feet range</li>}
                            </ul>
                        </div>
                    )}

                    {/* Purchase Button */}
                    {isUnlocked && currentLevel < maxLevel && (
                        <button
                            onClick={handlePurchase}
                            disabled={!canAfford || (currentLevel === 0 && !chosenPath && !selectedPath && showPathSelection) || (currentLevel >= 10 && !isTier2Unlocked)}
                            className={`w-full py-3 rounded-lg font-semibold transition-all ${canAfford && !(currentLevel === 0 && !chosenPath && !selectedPath && showPathSelection) && !(currentLevel >= 10 && !isTier2Unlocked)
                                ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                }`}
                        >
                            {currentLevel === 0 && !chosenPath && !showPathSelection
                                ? 'Choose Upgrade Path'
                                : currentLevel === 0 && !chosenPath && showPathSelection && !selectedPath
                                    ? 'Select a Path Above'
                                    : currentLevel >= 10 && !isTier2Unlocked
                                        ? `Requires Level ${ABILITY_UPGRADES_TIER_2_UNLOCK_LEVEL}`
                                        : `Purchase Upgrade (${nextCost} Brass Essence)`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
