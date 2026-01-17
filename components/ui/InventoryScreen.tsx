'use client';

import { useState } from 'react';
import { usePlayerStore } from '@/lib/store';
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
    Ingredient
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
                                    name={item.name}
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
                                        name={item.name}
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

            case 'accessories':
                return (
                    <div className="flex items-center justify-center h-48 text-slate-500">
                        <p>No accessories yet. Coming soon!</p>
                    </div>
                );

            case 'crafting':
                return (
                    <div className="grid grid-cols-1 gap-3">
                        {ALL_RECIPES.filter(recipe => {
                            // Only apply reed visibility rules to reed recipes
                            // Check if outputId is a reed strength (a number-like string)
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
                            />
                        ))}
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
                            {tab}
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
}

function RecipeCard({ recipe, inventory, echoes, onCraft }: RecipeCardProps) {
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
                        {outputItem ? outputItem.name : recipe.outputId}
                        <span className="ml-2 text-xs text-slate-400">x{recipe.outputQuantity}</span>
                    </div>
                    <div className="text-xs text-slate-400">{recipe.description}</div>
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
