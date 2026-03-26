'use client';

import React from 'react';
import { ITEM_DEFINITIONS, MaterialItemId, getRarityColor, ItemId } from '@/lib/game/inventory';

interface Ingredient {
    readonly itemId: string;
    readonly quantity: number;
}

interface UpgradeCardProps {
    name: string;
    level: number;
    maxLevel?: number;
    rarity: string;
    ingredients: readonly Ingredient[];
    inventory: any;
    echoes: number;
    onUpgrade: () => void;
    colorClass: string; // e.g., 'purple-400', 'orange-400'
    icon?: string;
}

export function UpgradeCard({
    name,
    level,
    maxLevel,
    rarity,
    ingredients,
    inventory,
    echoes,
    onUpgrade,
    colorClass,
    icon = '⬆️'
}: UpgradeCardProps) {
    const isMaxLevel = maxLevel !== undefined && level >= maxLevel;

    if (isMaxLevel) {
        return (
            <div className={`flex items-center justify-between p-3 bg-slate-800/40 border border-${colorClass.split('-')[0]}-600/30 rounded-lg`}>
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded bg-${colorClass.split('-')[0]}-900/30 border border-${colorClass.split('-')[0]}-600/50 flex items-center justify-center text-xl`}>
                        ⭐
                    </div>
                    <div>
                        <span className={`font-bold text-${colorClass}`}>{name}</span>
                        <span className="text-xs text-yellow-400 ml-2">(MAX LEVEL {maxLevel})</span>
                    </div>
                </div>
            </div>
        );
    }

    const nextLevel = level + 1;
    const canAfford = ingredients.every(ing => {
        const have = ing.itemId === 'echoes' ? echoes : (inventory.materials[ing.itemId as MaterialItemId] || inventory.reeds[ing.itemId] || 0);
        return have >= ing.quantity;
    });

    return (
        <div className="flex items-center justify-between p-3 bg-slate-800/40 border border-slate-700 rounded-lg hover:bg-slate-800/60 transition-colors">
            {/* Output Info */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-blue-900/30 border border-blue-600/50 flex items-center justify-center text-xl">
                    {icon}
                </div>
                <div>
                    <div className="font-bold text-slate-200">
                        {name}
                    </div>
                    <div className="text-xs text-blue-400">Lv {level} → Lv {nextLevel}</div>
                </div>
            </div>

            {/* Ingredients & Button */}
            <div className="flex items-center gap-6">
                <div className="flex flex-col gap-1 text-xs">
                    {ingredients.map((ing, i) => {
                        const have = ing.itemId === 'echoes' ? echoes : (inventory.materials[ing.itemId as MaterialItemId] || inventory.reeds[ing.itemId] || 0);
                        const enough = have >= ing.quantity;
                        const itemName = ITEM_DEFINITIONS[ing.itemId as ItemId]?.name || ing.itemId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

                        return (
                            <div key={i} className={`flex items-center justify-end gap-1 ${enough ? 'text-slate-400' : 'text-red-400'}`}>
                                <span>{ing.quantity}x {itemName}</span>
                                <span className="opacity-50">({have})</span>
                            </div>
                        );
                    })}
                </div>

                <button
                    onClick={onUpgrade}
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
}

export default UpgradeCard;
