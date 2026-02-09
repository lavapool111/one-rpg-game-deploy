'use client';

import { useState } from 'react';
import { usePlayerStore } from '@/lib/store';
import { getTerms, getAbilityName, localizeItemName } from '@/lib/store/playerStore';
import {
    ItemCategory,
    ITEM_DEFINITIONS,
    MaterialItemId,
    ReedStrength,
    getRarityColor,
    getRarityBorderColor,
    getRarityBgColor,
    REED_MULTIPLIERS,
    ItemId,
    ALL_RECIPES,
    Recipe,
    Ingredient,
    LIGATURE_DATA,
    LigatureId,
    LigatureInstance,
    getLigatureStats,
    getLigatureData,
    MOUTHPIECE_DATA,
    MouthpieceId,
    MouthpieceInstance,
    getMouthpieceStats,
    getMouthpieceData,
    getMouthpieceUpgradeCost
} from '@/lib/game/inventory';

/**
 * Inventory Screen Component
 * 
 * Displays player inventory with category tabs:
 * - Materials
 * - Reeds
 * - Accessories
 * - Crafting
 */

interface InventoryScreenProps {
    onClose: () => void;
}

export function InventoryScreen({ onClose }: InventoryScreenProps) {
    const [activeTab, setActiveTab] = useState<ItemCategory | 'crafting'>('materials');
    const [selectedItemId, setSelectedItemId] = useState<ItemId | null>(null);
    const [hoveredItemId, setHoveredItemId] = useState<ItemId | null>(null);

    const inventory = usePlayerStore((state) => state.inventory);
    const echoes = usePlayerStore((state) => state.echoes);
    const equippedReed = usePlayerStore((state) => state.equippedReed);
    const equipReed = usePlayerStore((state) => state.equipReed);
    const unequipReed = usePlayerStore((state) => state.unequipReed);
    const craftRecipe = usePlayerStore((state) => state.craftRecipe);
    const upgradeDungeonTime = usePlayerStore((state) => state.upgradeDungeonTime);
    const getNextDungeonUpgradeCost = usePlayerStore((state) => state.getNextDungeonUpgradeCost);
    const getDungeonTimeLimit = usePlayerStore((state) => state.getDungeonTimeLimit);

    // Ligature hooks
    const equippedLigature = usePlayerStore((state) => state.equippedLigature);
    const equipLigature = usePlayerStore((state) => state.equipLigature);
    const unequipLigature = usePlayerStore((state) => state.unequipLigature);
    const craftLigature = usePlayerStore((state) => state.craftLigature);
    const upgradeLigature = usePlayerStore((state) => state.upgradeLigature);
    const getLigatureBonus = usePlayerStore((state) => state.getLigatureBonus);
    const accessorySlots = usePlayerStore((state) => state.accessorySlots);

    // Mouthpiece hooks
    const equippedMouthpiece = usePlayerStore((state) => state.equippedMouthpiece);
    const equipMouthpiece = usePlayerStore((state) => state.equipMouthpiece);
    const unequipMouthpiece = usePlayerStore((state) => state.unequipMouthpiece);
    const craftMouthpiece = usePlayerStore((state) => state.craftMouthpiece);
    const upgradeMouthpiece = usePlayerStore((state) => state.upgradeMouthpiece);
    const getMouthpieceBonus = usePlayerStore((state) => state.getMouthpieceBonus);

    // Crafting sub-tab state
    const [craftingSubTab, setCraftingSubTab] = useState<'materials' | 'reeds' | 'ligatures' | 'mouthpieces'>('materials');

    // Player class for terminology
    const playerClass = usePlayerStore((state) => state.playerClass);
    const terms = getTerms(playerClass);

    const displayedItem = hoveredItemId ? ITEM_DEFINITIONS[hoveredItemId] : (selectedItemId ? ITEM_DEFINITIONS[selectedItemId] : null);

    // Calculate highest owned reed strength
    const highestOwnedStrength = Object.entries(inventory.reeds)
        .filter(([_, qty]) => qty > 0)
        .reduce((max, [strength]) => Math.max(max, parseFloat(strength)), 0);

    // Visibility thresholds based on rules:
    // Crafting: Show up to 2.5 initially, then highest + 0.5
    const maxCraftingVisible = Math.max(2.5, highestOwnedStrength + 0.5);

    // Inventory: Show up to 2.0 initially, then highest + 0.5
    const maxInventoryVisible = Math.max(2.0, highestOwnedStrength + 0.5);

    // Get items for the current category
    const renderItems = () => {
        switch (activeTab) {
            case 'materials':
                return (
                    <div className="grid grid-cols-4 gap-3">
                        {(Object.keys(inventory.materials) as MaterialItemId[]).map((itemId) => {
                            const quantity = inventory.materials[itemId];
                            const item = ITEM_DEFINITIONS[itemId];
                            if (!item) return null;

                            return (
                                <InventorySlot
                                    key={itemId}
                                    name={localizeItemName(item.name, playerClass)}
                                    quantity={quantity}
                                    rarity={item.rarity}
                                    description={item.description}
                                    isSelected={selectedItemId === itemId}
                                    onHover={(hovering) => setHoveredItemId(hovering ? itemId : null)}
                                    onClick={() => setSelectedItemId(itemId)}
                                />
                            );
                        })}
                    </div>
                );

            case 'reeds':
                return (
                    <div className="grid grid-cols-3 gap-3">
                        {(Object.keys(inventory.reeds) as ReedStrength[])
                            .filter(strength => parseFloat(strength) <= maxInventoryVisible)
                            .map((strength) => {
                                const quantity = inventory.reeds[strength];
                                const item = ITEM_DEFINITIONS[strength];
                                if (!item) return null;

                                return (
                                    <InventorySlot
                                        key={strength}
                                        name={localizeItemName(item.name, playerClass)}
                                        quantity={quantity}
                                        rarity={item.rarity}
                                        description={item.description}
                                        isSelected={selectedItemId === strength}
                                        isEquipped={equippedReed === strength}
                                        onHover={(hovering) => setHoveredItemId(hovering ? strength : null)}
                                        onClick={() => setSelectedItemId(strength)}
                                    />
                                );
                            })}
                    </div>
                );

            case 'accessories': {
                const ligatureBonus = getLigatureBonus();
                return (
                    <div className="space-y-4">
                        {/* Accessory Slots Grid - 4x2 */}
                        <div>
                            <h3 className="text-yellow-500 text-xs font-bold uppercase tracking-wider mb-2">Accessory Slots ({accessorySlots} slots)</h3>
                            <div className="grid grid-cols-4 gap-2">
                                {/* Slot 1: Ligature */}
                                <div
                                    className={`p-2 rounded-lg border ${equippedLigature ? 'border-green-500 bg-green-900/20' : 'border-slate-600 bg-slate-800/50'} flex flex-col items-center justify-center min-h-[72px]`}
                                >
                                    {equippedLigature ? (
                                        <>
                                            <span className="text-lg">🎺</span>
                                            <p className="text-[10px] text-center text-green-400 truncate w-full">
                                                {localizeItemName(getLigatureData(equippedLigature.id).name.split(' ').slice(0, 2).join(' '), playerClass)}
                                            </p>
                                            <p className="text-[9px] text-slate-400">Lv {equippedLigature.level}</p>
                                        </>
                                    ) : (
                                        <p className="text-[10px] text-slate-500">{terms.ligature}</p>
                                    )}
                                </div>
                                {/* Slot 2: Mouthpiece */}
                                <div
                                    className={`p-2 rounded-lg border ${equippedMouthpiece ? 'border-orange-500 bg-orange-900/20' : 'border-slate-600 bg-slate-800/50'} flex flex-col items-center justify-center min-h-[72px]`}
                                >
                                    {equippedMouthpiece ? (
                                        <>
                                            <span className="text-lg">{equippedMouthpiece.id === 'plastic' ? '🎵' : '🎶'}</span>
                                            <p className="text-[10px] text-center text-orange-400 truncate w-full">
                                                {playerClass === 'viola' ? getMouthpieceData(equippedMouthpiece.id).violaName : getMouthpieceData(equippedMouthpiece.id).name}
                                            </p>
                                            <p className="text-[9px] text-slate-400">Lv {equippedMouthpiece.level}</p>
                                        </>
                                    ) : (
                                        <p className="text-[10px] text-slate-500">{playerClass === 'viola' ? 'Rosin' : 'Mouthpiece'}</p>
                                    )}
                                </div>
                                {/* Remaining 6 empty slots */}
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="p-2 rounded-lg border border-slate-700 bg-slate-800/30 flex items-center justify-center min-h-[72px]">
                                        <p className="text-[10px] text-slate-600">Empty</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Equipped Ligature Stats */}
                        {equippedLigature && (
                            <div className="p-3 rounded-lg border border-yellow-600/30 bg-slate-800/50">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-yellow-500 font-semibold">{localizeItemName(getLigatureData(equippedLigature.id).name, playerClass)}</span>
                                    <button
                                        onClick={() => unequipLigature()}
                                        className="px-2 py-1 text-xs bg-red-900/50 hover:bg-red-800 text-red-400 rounded"
                                    >
                                        Unequip
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="text-slate-400">
                                        {getAbilityName(playerClass)}: <span className="text-green-400">+{(ligatureBonus.longToneDurationMs / 1000).toFixed(1)}s</span>
                                    </div>
                                    <div className="text-slate-400">
                                        Tuba Defense: <span className="text-blue-400">+{(ligatureBonus.lowBrassDefense * 100).toFixed(0)}%</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Owned Ligatures */}
                        <div>
                            <h3 className="text-yellow-500 text-xs font-bold uppercase tracking-wider mb-2">Owned {terms.ligatures}</h3>
                            {inventory.ligatures.length === 0 ? (
                                <p className="text-slate-500 text-sm">No {terms.ligatures.toLowerCase()}. Craft them in the Crafting tab!</p>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {inventory.ligatures.map((lig, index) => {
                                        const data = getLigatureData(lig.id);
                                        const stats = getLigatureStats(lig.id, lig.level);
                                        const isEquipped = equippedLigature?.id === lig.id && equippedLigature?.level === lig.level;
                                        return (
                                            <div
                                                key={index}
                                                className={`p-2 rounded-lg border ${isEquipped ? 'border-green-500 bg-green-900/20' : 'border-slate-600 bg-slate-800/50'} cursor-pointer hover:border-yellow-500/50`}
                                                onClick={() => !isEquipped && equipLigature(index)}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-xs font-medium ${getRarityColor(data.rarity)}`}>
                                                        {localizeItemName(data.name, playerClass)}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">Lv {lig.level}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 mt-1">
                                                    +{stats.longToneBonus.toFixed(1)}s / +{(stats.lowBrassDefense * 100).toFixed(0)}% def
                                                </div>
                                                {isEquipped && (
                                                    <span className="text-[10px] text-green-400">Equipped</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Equipped Mouthpiece Stats */}
                        {equippedMouthpiece && (
                            <div className="p-3 rounded-lg border border-orange-600/30 bg-slate-800/50">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-orange-500 font-semibold">
                                        {playerClass === 'viola' ? getMouthpieceData(equippedMouthpiece.id).violaName : getMouthpieceData(equippedMouthpiece.id).name} (Lv {equippedMouthpiece.level})
                                    </span>
                                    <button
                                        onClick={() => unequipMouthpiece()}
                                        className="px-2 py-1 text-xs bg-red-900/50 hover:bg-red-800 text-red-400 rounded"
                                    >
                                        Unequip
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    {getMouthpieceBonus().critFactor > 0 && (
                                        <div className="text-slate-400">
                                            Crit Factor: <span className="text-orange-400">+{getMouthpieceBonus().critFactor.toFixed(1)}</span>
                                        </div>
                                    )}
                                    {getMouthpieceBonus().critChance > 0 && (
                                        <div className="text-slate-400">
                                            Crit Chance: <span className="text-orange-400">+{(getMouthpieceBonus().critChance * 100).toFixed(0)}%</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Owned Mouthpieces */}
                        <div>
                            <h3 className="text-orange-500 text-xs font-bold uppercase tracking-wider mb-2">Owned {playerClass === 'viola' ? 'Rosin' : 'Mouthpieces'}</h3>
                            {inventory.mouthpieces.length === 0 ? (
                                <p className="text-slate-500 text-sm">No {playerClass === 'viola' ? 'rosin' : 'mouthpieces'}. Craft them in the Crafting tab!</p>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {inventory.mouthpieces.map((mp, index) => {
                                        const data = getMouthpieceData(mp.id);
                                        const stats = getMouthpieceStats(mp.id, mp.level);
                                        const isEquipped = equippedMouthpiece?.id === mp.id && equippedMouthpiece?.level === mp.level;
                                        const displayName = playerClass === 'viola' ? data.violaName : data.name;
                                        return (
                                            <div
                                                key={index}
                                                className={`p-2 rounded-lg border ${isEquipped ? 'border-orange-500 bg-orange-900/20' : 'border-slate-600 bg-slate-800/50'} cursor-pointer hover:border-orange-500/50`}
                                                onClick={() => !isEquipped && equipMouthpiece(index)}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-xs font-medium ${getRarityColor(data.rarity)}`}>
                                                        {displayName}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400">Lv {mp.level}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 mt-1">
                                                    {stats.critFactor > 0 ? `+${stats.critFactor.toFixed(1)} crit factor` : `+${(stats.critChance * 100).toFixed(0)}% crit chance`}
                                                </div>
                                                {isEquipped && (
                                                    <span className="text-[10px] text-orange-400">Equipped</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                );
            }

            case 'crafting':
                return (
                    <div className="space-y-3">
                        {/* Crafting Sub-Tabs */}
                        <div className="flex gap-2 border-b border-slate-700 pb-2">
                            {(['materials', 'reeds', 'ligatures', 'mouthpieces'] as const).map((subTab) => (
                                <button
                                    key={subTab}
                                    onClick={() => setCraftingSubTab(subTab)}
                                    className={`px-3 py-1 text-xs font-medium rounded-t transition-colors ${craftingSubTab === subTab
                                        ? 'bg-yellow-600/30 text-yellow-400 border-b-2 border-yellow-500'
                                        : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                >
                                    {subTab === 'materials' ? 'Materials & Upgrades' : subTab === 'reeds' ? terms.reeds : subTab === 'ligatures' ? terms.ligatures : subTab === 'mouthpieces' ? (playerClass === 'viola' ? 'Rosin' : 'Mouthpieces') : subTab}
                                </button>
                            ))}
                        </div>

                        {/* Materials Sub-Tab */}
                        {craftingSubTab === 'materials' && (
                            <div className="space-y-3">
                                <div className="mb-2">
                                    <h3 className="text-yellow-500 text-xs font-bold uppercase tracking-wider mb-2">Backstage Halls Upgrades</h3>
                                    <DungeonTimeUpgradeCard
                                        inventory={inventory}
                                        onUpgrade={upgradeDungeonTime}
                                        getCost={getNextDungeonUpgradeCost}
                                        getCurrentLimit={getDungeonTimeLimit}
                                    />
                                </div>

                                <h3 className="text-yellow-500 text-xs font-bold uppercase tracking-wider mb-2 mt-4">Material Crafting</h3>
                                {ALL_RECIPES.filter(recipe => recipe.category === 'materials').map((recipe) => (
                                    <RecipeCard
                                        key={recipe.id}
                                        recipe={recipe}
                                        inventory={inventory}
                                        echoes={echoes}
                                        onCraft={() => craftRecipe(recipe.id)}
                                        playerClass={playerClass}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Reeds Sub-Tab */}
                        {craftingSubTab === 'reeds' && (
                            <div className="space-y-3">
                                <h3 className="text-yellow-500 text-xs font-bold uppercase tracking-wider mb-2">{terms.reed} Crafting</h3>
                                {ALL_RECIPES.filter(recipe => {
                                    if (recipe.category !== 'reeds') return false;
                                    // Apply reed visibility rules
                                    if (!isNaN(parseFloat(recipe.outputId as string))) {
                                        return parseFloat(recipe.outputId as string) <= maxCraftingVisible;
                                    }
                                    return true;
                                }).map((recipe) => (
                                    <RecipeCard
                                        key={recipe.id}
                                        recipe={recipe}
                                        inventory={inventory}
                                        echoes={echoes}
                                        onCraft={() => craftRecipe(recipe.id)}
                                        playerClass={playerClass}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Ligatures Sub-Tab */}
                        {craftingSubTab === 'ligatures' && (
                            <div className="space-y-4">
                                {/* Base Ligature Crafting */}
                                <div>
                                    <h3 className="text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">Craft New {terms.ligatures}</h3>
                                    <div className="space-y-2">
                                        {LIGATURE_DATA.map((ligature) => {
                                            const recipe = ALL_RECIPES.find(r => r.id === `ligature_${ligature.id}_craft`);
                                            if (!recipe) return null;

                                            // Check if can afford
                                            const canAfford = recipe.ingredients.every(ing => {
                                                const have = inventory.materials[ing.itemId as MaterialItemId] || 0;
                                                return have >= ing.quantity;
                                            });

                                            return (
                                                <div key={ligature.id} className="flex items-center justify-between p-3 bg-slate-800/40 border border-slate-700 rounded-lg hover:bg-slate-800/60 transition-colors">
                                                    {/* Output Info */}
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded bg-purple-900/30 border border-purple-600/50 flex items-center justify-center text-xl">
                                                            🎼
                                                        </div>
                                                        <div>
                                                            <div className={`font-bold ${getRarityColor(ligature.rarity)}`}>
                                                                {localizeItemName(ligature.name, playerClass)}
                                                            </div>
                                                            <div className="text-xs text-slate-400">{ligature.description}</div>
                                                            <div className="text-[10px] text-purple-400">
                                                                +{ligature.longToneBonus}s Long Tone / +{(ligature.lowBrassDefense * 100).toFixed(0)}% Tuba Def
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Ingredients & Button */}
                                                    <div className="flex items-center gap-6">
                                                        <div className="flex flex-col gap-1 text-xs">
                                                            {recipe.ingredients.map((ing, i) => {
                                                                const have = inventory.materials[ing.itemId as MaterialItemId] || 0;
                                                                const enough = have >= ing.quantity;
                                                                return (
                                                                    <div key={i} className={`flex items-center gap-1 ${enough ? 'text-slate-400' : 'text-red-400'}`}>
                                                                        <span>{ing.quantity}x {ITEM_DEFINITIONS[ing.itemId]?.name || ing.itemId}</span>
                                                                        <span className="opacity-50">({have})</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        <button
                                                            onClick={() => craftLigature(ligature.id)}
                                                            disabled={!canAfford}
                                                            className={`px-4 py-2 rounded font-bold text-xs uppercase tracking-wider transition-all ${canAfford
                                                                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20'
                                                                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                                                }`}
                                                        >
                                                            Craft
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Ligature Upgrades */}
                                {inventory.ligatures.length > 0 && (
                                    <div>
                                        <h3 className="text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">Upgrade {terms.ligatures}</h3>
                                        <div className="space-y-2">
                                            {inventory.ligatures.map((lig, index) => {
                                                if (lig.level >= 10) {
                                                    return (
                                                        <div key={index} className="flex items-center justify-between p-3 bg-slate-800/40 border border-purple-600/30 rounded-lg">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded bg-purple-900/30 border border-purple-600/50 flex items-center justify-center text-xl">
                                                                    ⭐
                                                                </div>
                                                                <div>
                                                                    <span className="font-bold text-purple-400">{localizeItemName(getLigatureData(lig.id).name, playerClass)}</span>
                                                                    <span className="text-xs text-yellow-400 ml-2">(MAX LEVEL 10)</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                const nextLevel = lig.level + 1;
                                                const recipe = ALL_RECIPES.find(r => r.id === `ligature_${lig.id}_upgrade_${nextLevel}`);
                                                if (!recipe) return null;

                                                const canAfford = recipe.ingredients.every(ing => {
                                                    const have = inventory.materials[ing.itemId as MaterialItemId] || 0;
                                                    return have >= ing.quantity;
                                                });

                                                return (
                                                    <div key={index} className="flex items-center justify-between p-3 bg-slate-800/40 border border-slate-700 rounded-lg hover:bg-slate-800/60 transition-colors">
                                                        {/* Output Info */}
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded bg-blue-900/30 border border-blue-600/50 flex items-center justify-center text-xl">
                                                                ⬆️
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-200">
                                                                    {localizeItemName(getLigatureData(lig.id).name, playerClass)}
                                                                </div>
                                                                <div className="text-xs text-blue-400">Lv {lig.level} → Lv {nextLevel}</div>
                                                            </div>
                                                        </div>

                                                        {/* Ingredients & Button */}
                                                        <div className="flex items-center gap-6">
                                                            <div className="flex flex-col gap-1 text-xs">
                                                                {recipe.ingredients.map((ing, i) => {
                                                                    const have = inventory.materials[ing.itemId as MaterialItemId] || 0;
                                                                    const enough = have >= ing.quantity;
                                                                    return (
                                                                        <div key={i} className={`flex items-center gap-1 ${enough ? 'text-slate-400' : 'text-red-400'}`}>
                                                                            <span>{ing.quantity}x {ITEM_DEFINITIONS[ing.itemId]?.name || ing.itemId}</span>
                                                                            <span className="opacity-50">({have})</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>

                                                            <button
                                                                onClick={() => upgradeLigature(index)}
                                                                disabled={!canAfford}
                                                                className={`px-4 py-2 rounded font-bold text-xs uppercase tracking-wider transition-all ${canAfford
                                                                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
                                                                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                                                    }`}
                                                            >
                                                                Upgrade
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Mouthpieces Sub-Tab */}
                        {craftingSubTab === 'mouthpieces' && (
                            <div className="space-y-4">
                                {/* Base Mouthpiece Crafting */}
                                <div>
                                    <h3 className="text-orange-400 text-xs font-bold uppercase tracking-wider mb-2">Craft New {playerClass === 'viola' ? 'Rosin' : 'Mouthpieces'}</h3>
                                    <div className="space-y-2">
                                        {MOUTHPIECE_DATA.map((mouthpiece) => {
                                            const recipe = mouthpiece.recipe;

                                            // Check if can afford
                                            const canAfford = recipe.every(ing => {
                                                const have = inventory.materials[ing.itemId as MaterialItemId] || 0;
                                                return have >= ing.quantity;
                                            });

                                            const displayName = playerClass === 'viola' ? mouthpiece.violaName : mouthpiece.name;
                                            const displayDesc = playerClass === 'viola' ? mouthpiece.violaDescription : mouthpiece.description;

                                            return (
                                                <div key={mouthpiece.id} className="flex items-center justify-between p-3 bg-slate-800/40 border border-slate-700 rounded-lg hover:bg-slate-800/60 transition-colors">
                                                    {/* Output Info */}
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded bg-orange-900/30 border border-orange-600/50 flex items-center justify-center text-xl">
                                                            {mouthpiece.id === 'plastic' ? '🎵' : '🎶'}
                                                        </div>
                                                        <div>
                                                            <div className={`font-bold ${getRarityColor(mouthpiece.rarity)}`}>
                                                                {displayName}
                                                            </div>
                                                            <div className="text-xs text-slate-400">{displayDesc}</div>
                                                            <div className="text-[10px] text-orange-400">
                                                                {mouthpiece.critFactorPerLevel > 0
                                                                    ? `+${mouthpiece.critFactorPerLevel} Crit Factor/Lv`
                                                                    : `+${(mouthpiece.critChancePerLevel * 100).toFixed(0)}% Crit Chance/Lv`}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Ingredients & Button */}
                                                    <div className="flex items-center gap-6">
                                                        <div className="flex flex-col gap-1 text-xs">
                                                            {recipe.map((ing, i) => {
                                                                const have = inventory.materials[ing.itemId as MaterialItemId] || 0;
                                                                const enough = have >= ing.quantity;
                                                                return (
                                                                    <div key={i} className={`flex items-center gap-1 ${enough ? 'text-slate-400' : 'text-red-400'}`}>
                                                                        <span>{ing.quantity}x {ITEM_DEFINITIONS[ing.itemId]?.name || ing.itemId}</span>
                                                                        <span className="opacity-50">({have})</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        <button
                                                            onClick={() => craftMouthpiece(mouthpiece.id)}
                                                            disabled={!canAfford}
                                                            className={`px-4 py-2 rounded font-bold text-xs uppercase tracking-wider transition-all ${canAfford
                                                                ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-900/20'
                                                                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                                                }`}
                                                        >
                                                            Craft
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Mouthpiece Upgrades */}
                                {inventory.mouthpieces.length > 0 && (
                                    <div>
                                        <h3 className="text-orange-400 text-xs font-bold uppercase tracking-wider mb-2">Upgrade {playerClass === 'viola' ? 'Rosin' : 'Mouthpieces'}</h3>
                                        <div className="space-y-2">
                                            {inventory.mouthpieces.map((mp, index) => {
                                                if (mp.level >= 10) {
                                                    const data = getMouthpieceData(mp.id);
                                                    const displayName = playerClass === 'viola' ? data.violaName : data.name;
                                                    return (
                                                        <div key={index} className="flex items-center justify-between p-3 bg-slate-800/40 border border-orange-600/30 rounded-lg">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded bg-orange-900/30 border border-orange-600/50 flex items-center justify-center text-xl">
                                                                    ⭐
                                                                </div>
                                                                <div>
                                                                    <span className="font-bold text-orange-400">{displayName}</span>
                                                                    <span className="text-xs text-yellow-400 ml-2">(MAX LEVEL 10)</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                const nextLevel = mp.level + 1;
                                                const upgradeCost = getMouthpieceUpgradeCost(mp.id, mp.level);
                                                const data = getMouthpieceData(mp.id);
                                                const displayName = playerClass === 'viola' ? data.violaName : data.name;

                                                const canAfford = upgradeCost.every(ing => {
                                                    const have = inventory.materials[ing.itemId as MaterialItemId] || 0;
                                                    return have >= ing.quantity;
                                                });

                                                return (
                                                    <div key={index} className="flex items-center justify-between p-3 bg-slate-800/40 border border-slate-700 rounded-lg hover:bg-slate-800/60 transition-colors">
                                                        {/* Output Info */}
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded bg-blue-900/30 border border-blue-600/50 flex items-center justify-center text-xl">
                                                                ⬆️
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-200">
                                                                    {displayName}
                                                                </div>
                                                                <div className="text-xs text-blue-400">Lv {mp.level} → Lv {nextLevel}</div>
                                                            </div>
                                                        </div>

                                                        {/* Ingredients & Button */}
                                                        <div className="flex items-center gap-6">
                                                            <div className="flex flex-col gap-1 text-xs">
                                                                {upgradeCost.map((ing, i) => {
                                                                    const have = inventory.materials[ing.itemId as MaterialItemId] || 0;
                                                                    const enough = have >= ing.quantity;
                                                                    return (
                                                                        <div key={i} className={`flex items-center gap-1 ${enough ? 'text-slate-400' : 'text-red-400'}`}>
                                                                            <span>{ing.quantity}x {ITEM_DEFINITIONS[ing.itemId]?.name || ing.itemId}</span>
                                                                            <span className="opacity-50">({have})</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>

                                                            <button
                                                                onClick={() => upgradeMouthpiece(index)}
                                                                disabled={!canAfford}
                                                                className={`px-4 py-2 rounded font-bold text-xs uppercase tracking-wider transition-all ${canAfford
                                                                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
                                                                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                                                    }`}
                                                            >
                                                                Upgrade
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900/95 border border-yellow-600/30 rounded-xl max-w-2xl w-full mx-4 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-yellow-600/20 bg-slate-800/50 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-yellow-500 tracking-wider uppercase">
                        Inventory
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors text-2xl font-bold"
                    >
                        ×
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-700 flex-shrink-0">
                    {(['materials', 'reeds', 'accessories', 'crafting'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab); setHoveredItemId(null); }}
                            className={`flex-1 py-3 px-4 text-center font-medium uppercase tracking-wider transition-all ${activeTab === tab
                                ? 'text-yellow-400 bg-slate-800/50 border-b-2 border-yellow-500'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                                }`}
                        >
                            {tab === 'reeds' ? terms.reeds : tab}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto min-h-[200px] flex-grow">
                    {renderItems()}
                </div>

                {/* Description Panel */}
                <div className="px-6 py-4 bg-slate-900 border-t border-slate-700 min-h-[100px] flex-shrink-0 flex items-start justify-between gap-4">
                    {displayedItem ? (
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`font-bold text-lg ${getRarityColor(displayedItem.rarity)}`}>
                                    {displayedItem.name}
                                </span>
                                {displayedItem.rarity && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded border ${getRarityBorderColor(displayedItem.rarity)} ${getRarityColor(displayedItem.rarity)} bg-slate-950 opacity-80 uppercase tracking-widest`}>
                                        {displayedItem.rarity}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-slate-300 mb-2">{displayedItem.description}</p>

                            {/* Stats Info for Reeds */}
                            {displayedItem.category === 'reeds' && (
                                <div className="text-xs text-yellow-500/80 font-mono">
                                    CRIT: +{(REED_MULTIPLIERS[displayedItem.id as ReedStrength]?.crit * 100).toFixed(1)}% |
                                    DEF: +{(REED_MULTIPLIERS[displayedItem.id as ReedStrength]?.def * 100).toFixed(1)}% |
                                    SPD: +{Math.round(((REED_MULTIPLIERS[displayedItem.id as ReedStrength]?.speed || 1) - 1) * 100)}%
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-500 italic flex-1">
                            Hover or click an item to view details
                        </div>
                    )}

                    {/* Action Buttons */}
                    {displayedItem && displayedItem.category === 'reeds' && (
                        <div className="flex flex-col gap-2 min-w-[120px]">
                            {/* Equip / Unequip Button */}
                            {equippedReed === displayedItem.id ? (
                                <button
                                    onClick={() => unequipReed()}
                                    className="w-full py-2 rounded font-bold text-sm uppercase tracking-wider transition-all bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20"
                                >
                                    Unequip
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        if (displayedItem.id) {
                                            equipReed(displayedItem.id as ReedStrength);
                                        }
                                    }}
                                    className="w-full py-2 rounded font-bold text-sm uppercase tracking-wider transition-all bg-yellow-600 hover:bg-yellow-500 text-slate-900 shadow-lg shadow-yellow-900/20"
                                >
                                    Equip
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/30 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full py-2 px-4 bg-yellow-600/20 border border-yellow-600/40 text-yellow-500 rounded hover:bg-yellow-600/30 transition-colors font-medium"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

interface InventorySlotProps {
    name: string;
    quantity: number;
    rarity?: string;
    description: string;
    isSelected?: boolean;
    isEquipped?: boolean;
    onHover: (hovering: boolean) => void;
    onClick: () => void;
}

function InventorySlot({ name, quantity, rarity, description, isSelected, isEquipped, onHover, onClick }: InventorySlotProps) {
    const rarityColor = getRarityColor(rarity);
    const borderColor = isSelected ? 'border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.3)]' : getRarityBorderColor(rarity);
    const bgColor = isSelected ? 'bg-slate-800' : getRarityBgColor(rarity);

    return (
        <div
            className={`relative p-3 rounded-lg border ${borderColor} ${bgColor} transition-all hover:scale-105 cursor-pointer ${isEquipped ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-slate-900' : ''}`}
            onMouseEnter={() => onHover(true)}
            onMouseLeave={() => onHover(false)}
            onClick={onClick}
        >
            {/* Item Icon Placeholder */}
            <div className="w-12 h-12 mx-auto mb-2 rounded bg-slate-700/50 flex items-center justify-center">
                <span className="text-2xl">📦</span>
            </div>

            {/* Item Name */}
            <p className={`text-xs text-center font-medium truncate ${rarityColor}`}>
                {name}
            </p>

            {/* Quantity Badge */}
            <div className="absolute -top-1 -right-1 bg-slate-900 border border-slate-600 rounded-full px-2 py-0.5 text-xs font-bold text-white">
                {quantity}
            </div>
        </div>
    );
}



interface RecipeCardProps {
    recipe: Recipe;
    inventory: any;
    echoes: number;
    onCraft: () => void;
    playerClass: 'bb_clarinet' | 'viola';
}

function RecipeCard({ recipe, inventory, echoes, onCraft, playerClass }: RecipeCardProps) {
    const outputItem = ITEM_DEFINITIONS[recipe.outputId];

    // Check can craft
    let canCraft = true;
    const ingredientsDisplay = recipe.ingredients.map(ing => {
        let has = 0;
        if (ing.itemId === 'echoes') has = echoes;
        else if (ing.itemId in inventory.materials) has = inventory.materials[ing.itemId];
        else if (ing.itemId in inventory.reeds) has = inventory.reeds[ing.itemId];

        const sufficient = has >= ing.quantity;
        if (!sufficient) canCraft = false;

        const def = ITEM_DEFINITIONS[ing.itemId];
        return { ...ing, name: def ? def.name : ing.itemId, has, sufficient };
    });

    return (
        <div className="flex items-center justify-between p-3 bg-slate-800/40 border border-slate-700 rounded-lg hover:bg-slate-800/60 transition-colors">
            {/* Output Info */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-slate-700/50 flex items-center justify-center text-xl">
                    🛠️
                </div>
                <div>
                    <div className="font-bold text-slate-200">
                        {outputItem ? localizeItemName(outputItem.name, playerClass) : recipe.outputId}
                        <span className="ml-2 text-xs text-slate-400">x{recipe.outputQuantity}</span>
                    </div>
                    <div className="text-xs text-slate-400">{localizeItemName(recipe.description || '', playerClass)}</div>
                </div>
            </div>

            {/* Ingredients & Button */}
            <div className="flex items-center gap-6">
                <div className="flex flex-col gap-1 text-xs">
                    {ingredientsDisplay.map((ing, idx) => (
                        <div key={idx} className={`flex items-center gap-1 ${ing.sufficient ? 'text-slate-400' : 'text-red-400'}`}>
                            <span>{ing.quantity}x {ing.name}</span>
                            <span className="opacity-50">({ing.has})</span>
                        </div>
                    ))}
                </div>

                <button
                    onClick={onCraft}
                    disabled={!canCraft}
                    className={`px-4 py-2 rounded font-bold text-xs uppercase tracking-wider transition-all ${canCraft
                        ? 'bg-yellow-600 hover:bg-yellow-500 text-slate-900 shadow-lg shadow-yellow-900/20'
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        }`}
                >
                    Craft
                </button>
            </div>
        </div>
    );
}

export default InventoryScreen;

interface DungeonTimeUpgradeCardProps {
    inventory: any;
    onUpgrade: () => boolean;
    getCost: () => { valves: number; heavyValves: number; timeIncrease: number };
    getCurrentLimit: () => number;
}

function DungeonTimeUpgradeCard({ inventory, onUpgrade, getCost, getCurrentLimit }: DungeonTimeUpgradeCardProps) {
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
