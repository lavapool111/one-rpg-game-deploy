'use client';

import React from 'react';
import { Recipe, ITEM_DEFINITIONS, MaterialItemId, ReedStrength, ItemId, getRarityBorderColor, getRarityColor } from '@/lib/game/inventory';
import { localizeItemName } from '@/lib/store/playerStore';

interface RecipeCardProps {
    recipe: Recipe;
    inventory: any;
    echoes: number;
    onCraft: () => void;
    playerClass: 'bb_clarinet' | 'viola';
}

export function RecipeCard({ recipe, inventory, echoes, onCraft, playerClass }: RecipeCardProps) {
    const outputItem = ITEM_DEFINITIONS[recipe.outputId];
    const displayName = recipe.name || (outputItem ? localizeItemName(outputItem.name, playerClass) : recipe.outputId);
    const displayRarity = recipe.rarity || outputItem?.rarity || 'common';

    // Check can craft
    let canCraft = true;
    const ingredientsDisplay = recipe.ingredients.map(ing => {
        let has = 0;
        if (ing.itemId === 'echoes') has = echoes;
        else if (inventory.materials && ing.itemId in inventory.materials) has = inventory.materials[ing.itemId as MaterialItemId];
        else if (inventory.reeds && ing.itemId in inventory.reeds) has = inventory.reeds[ing.itemId as ReedStrength];

        const sufficient = has >= ing.quantity;
        if (!sufficient) canCraft = false;

        const def = ITEM_DEFINITIONS[ing.itemId as ItemId];
        return { ...ing, name: def ? def.name : ing.itemId, has, sufficient };
    });

    return (
        <div className="flex items-center justify-between p-3 bg-slate-800/40 border border-slate-700 rounded-lg hover:bg-slate-800/60 transition-colors">
            {/* Output Info */}
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded bg-slate-700/50 flex items-center justify-center text-xl border ${getRarityBorderColor(displayRarity)}`}>
                    🛠️
                </div>
                <div>
                    <div className={`font-bold ${getRarityColor(displayRarity)}`}>
                        {displayName}
                        <span className="ml-2 text-xs text-slate-400">x{recipe.outputQuantity}</span>
                    </div>
                    <div className="text-xs text-slate-400">{recipe.description ? localizeItemName(recipe.description, playerClass) : ''}</div>
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

export default RecipeCard;
