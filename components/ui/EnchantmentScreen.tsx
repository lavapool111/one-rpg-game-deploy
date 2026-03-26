'use client';

import { useState } from 'react';
import { usePlayerStore } from '@/lib/store';
import { useAccessoryStore } from '@/lib/store/accessoryStore';
import { useInventoryStore } from '@/lib/store/inventoryStore';
import {
    ITEM_DEFINITIONS,
    MaterialItemId,
    getRarityColor,
    getRarityBorderColor,
    ALL_RECIPES,
    EnchantmentId,
    EnchantmentTier,
    EnchantmentDefinition,
    ENCHANTMENT_DATA,
    getEnchantmentData,
    ENCHANTMENT_SLOT_LEVELS,
    getEnchantmentsForTier
} from '@/lib/game/inventory';

interface EnchantmentScreenProps {
    onClose: () => void;
}

export function EnchantmentScreen({ onClose }: EnchantmentScreenProps) {
    const [activeTier, setActiveTier] = useState<EnchantmentTier>('common');

    // Player state
    const inventory = useInventoryStore((state) => state.inventory);
    const level = usePlayerStore((state) => state.level);
    const equippedEnchantments = useAccessoryStore((state) => state.equippedEnchantments);
    const craftEnchantment = useAccessoryStore((state) => state.craftEnchantment);
    const equipEnchantment = useAccessoryStore((state) => state.equipEnchantment);
    const unequipEnchantment = useAccessoryStore((state) => state.unequipEnchantment);
    const isEnchantmentSlotUnlocked = useAccessoryStore((state) => state.isEnchantmentSlotUnlocked);

    const tiers: { id: EnchantmentTier; name: string; levelReq: number; color: string; icon: string }[] = [
        { id: 'common', name: 'Common', levelReq: 1, color: 'blue', icon: '✨' },
        { id: 'infused', name: 'Infused', levelReq: 100, color: 'purple', icon: '🔮' },
        { id: 'arcane', name: 'Arcane', levelReq: 250, color: 'yellow', icon: '🌟' }
    ];

    const renderEnchantmentCard = (enchantment: EnchantmentDefinition, tier: EnchantmentTier) => {
        const recipe = ALL_RECIPES.find(r => r.id === `enchantment_${enchantment.id}_craft`);
        if (!recipe) return null;

        const isUnlocked = isEnchantmentSlotUnlocked(tier);
        const canAfford = recipe.ingredients.every(ing => {
            const have = inventory.materials[ing.itemId as MaterialItemId] || 0;
            return have >= ing.quantity;
        });
        const ownedEnchant = inventory.enchantments.find(e => e.id === enchantment.id && e.tier === tier);
        const isEquipped = equippedEnchantments[tier]?.id === enchantment.id;
        const ownedIndex = inventory.enchantments.findIndex(e => e.id === enchantment.id && e.tier === tier);

        // Get effect description
        let effectDesc = '';
        if (enchantment.critFactorBonus) effectDesc += `+${enchantment.critFactorBonus} Crit Factor `;
        if (enchantment.defenseBonus) effectDesc += `+${(enchantment.defenseBonus * 100).toFixed(0)}% Defense `;
        if (enchantment.trumpetDamageMultiplier) effectDesc += `${enchantment.trumpetDamageMultiplier}x Trumpet Damage `;
        if (enchantment.euphoniumDefenseBonus) effectDesc += `+${(enchantment.euphoniumDefenseBonus * 100).toFixed(0)}% vs Euphoniums `;
        if (enchantment.hornRetaliationDamage) effectDesc += `Horn retaliation ${(enchantment.hornRetaliationDamage * 100).toFixed(0)}% `;
        if (enchantment.procAttackCount) {
            effectDesc += `Every ${enchantment.procAttackCount} attacks: Heal ${(enchantment.healPercent || 0) * 100}%`;
            if (enchantment.permanentSpeedBonus) effectDesc += ` & +${(enchantment.permanentSpeedBonus * 100).toFixed(0)}% Speed permanently`;
        }

        return (
            <div
                key={`${tier}-${enchantment.id}`}
                className={`rounded-lg border p-4 transition-all ${isEquipped
                        ? 'border-green-500 bg-green-900/20 shadow-lg shadow-green-900/20'
                        : ownedEnchant
                            ? 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
                            : isUnlocked
                                ? 'border-slate-700 bg-slate-800/30 hover:bg-slate-800/50'
                                : 'border-slate-800 bg-slate-900/30 opacity-60'
                    }`}
            >
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${tier === 'common' ? 'bg-blue-900/30 border border-blue-600/50' :
                            tier === 'infused' ? 'bg-purple-900/30 border border-purple-600/50' :
                                'bg-yellow-900/30 border border-yellow-600/50'
                        }`}>
                        {tier === 'common' ? '✨' : tier === 'infused' ? '🔮' : '🌟'}
                    </div>
                    <div className="flex-1">
                        <h3 className={`font-bold ${getRarityColor(enchantment.rarity)}`}>
                            {enchantment.name}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">{enchantment.description}</p>
                    </div>
                    {isEquipped && (
                        <span className="px-2 py-1 bg-green-600/30 text-green-400 text-xs font-bold rounded border border-green-500/50">
                            EQUIPPED
                        </span>
                    )}
                </div>

                {/* Effects */}
                <div className="mb-3">
                    <p className={`text-xs font-medium ${tier === 'common' ? 'text-blue-400' :
                            tier === 'infused' ? 'text-purple-400' :
                                'text-yellow-400'
                        }`}>
                        {effectDesc}
                    </p>
                </div>

                {/* Recipe */}
                {!ownedEnchant && (
                    <div className="space-y-2 mb-3">
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Crafting Recipe</p>
                        <div className="flex flex-wrap gap-2">
                            {recipe.ingredients.map((ing, i) => {
                                const have = inventory.materials[ing.itemId as MaterialItemId] || 0;
                                const enough = have >= ing.quantity;
                                return (
                                    <div
                                        key={i}
                                        className={`px-2 py-1 rounded text-xs border ${enough
                                                ? 'bg-slate-800/50 border-slate-600 text-slate-300'
                                                : 'bg-red-900/20 border-red-600/50 text-red-400'
                                            }`}
                                    >
                                        {ing.quantity}x {ITEM_DEFINITIONS[ing.itemId]?.name || ing.itemId.replace(/_/g, ' ')}
                                        <span className="opacity-60 ml-1">({have})</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Action Button */}
                <button
                    onClick={() => {
                        if (isEquipped) {
                            unequipEnchantment(tier);
                        } else if (ownedEnchant && ownedIndex >= 0) {
                            equipEnchantment(ownedIndex);
                        } else {
                            craftEnchantment(enchantment.id as EnchantmentId, tier);
                        }
                    }}
                    disabled={!isUnlocked || (!ownedEnchant && !canAfford)}
                    className={`w-full py-2 rounded font-bold text-xs uppercase tracking-wider transition-all ${isEquipped
                            ? 'bg-red-600/80 hover:bg-red-500 text-white'
                            : ownedEnchant
                                ? 'bg-green-600/80 hover:bg-green-500 text-white'
                                : isUnlocked && canAfford
                                    ? tier === 'common'
                                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
                                        : tier === 'infused'
                                            ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20'
                                            : 'bg-yellow-600 hover:bg-yellow-500 text-white shadow-lg shadow-yellow-900/20'
                                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        }`}
                >
                    {!isUnlocked
                        ? `Unlock at Level ${ENCHANTMENT_SLOT_LEVELS[tier]}`
                        : isEquipped
                            ? 'Unequip'
                            : ownedEnchant
                                ? 'Equip'
                                : canAfford
                                    ? 'Craft'
                                    : 'Need Materials'
                    }
                </button>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900/95 border border-yellow-600/30 rounded-xl max-w-4xl w-full mx-4 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-yellow-600/20 bg-slate-800/50 flex-shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold text-yellow-500 tracking-wider uppercase">
                            Weapon Enchantments
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                            Enhance your weapon with magical properties
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors text-2xl font-bold"
                    >
                        ×
                    </button>
                </div>

                {/* Tier Tabs */}
                <div className="flex border-b border-slate-700 flex-shrink-0">
                    {tiers.map((tier) => {
                        const isUnlocked = level >= tier.levelReq;
                        const isActive = activeTier === tier.id;
                        const hasEquipped = equippedEnchantments[tier.id] !== null;

                        return (
                            <button
                                key={tier.id}
                                onClick={() => isUnlocked && setActiveTier(tier.id)}
                                disabled={!isUnlocked}
                                className={`flex-1 py-4 px-4 text-center font-medium uppercase tracking-wider transition-all relative ${isActive
                                        ? tier.id === 'common'
                                            ? 'text-blue-400 bg-blue-900/20 border-b-2 border-blue-500'
                                            : tier.id === 'infused'
                                                ? 'text-purple-400 bg-purple-900/20 border-b-2 border-purple-500'
                                                : 'text-yellow-400 bg-yellow-900/20 border-b-2 border-yellow-500'
                                        : isUnlocked
                                            ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                                            : 'text-slate-600 cursor-not-allowed'
                                    }`}
                            >
                                <div className="flex items-center justify-center gap-2">
                                    <span>{tier.icon}</span>
                                    <span>{tier.name}</span>
                                </div>
                                {!isUnlocked && (
                                    <span className="block text-[10px] text-slate-500 mt-1">
                                        Lv {tier.levelReq} Required
                                    </span>
                                )}
                                {hasEquipped && isUnlocked && !isActive && (
                                    <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full"></span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-grow">
                    {/* Equipped Display */}
                    {equippedEnchantments[activeTier] && (
                        <div className="mb-6 p-4 rounded-lg bg-green-900/20 border border-green-500/50">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">
                                    {activeTier === 'common' ? '✨' : activeTier === 'infused' ? '🔮' : '🌟'}
                                </span>
                                <div>
                                    <p className="text-xs text-green-400 font-medium uppercase tracking-wider">
                                        Currently Equipped - {activeTier.charAt(0).toUpperCase() + activeTier.slice(1)} Slot
                                    </p>
                                    <p className="font-bold text-white">
                                        {getEnchantmentData(equippedEnchantments[activeTier]!.id, activeTier).name}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Enchantment Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {getEnchantmentsForTier(activeTier).map((enchantment) =>
                            renderEnchantmentCard(enchantment, activeTier)
                        )}
                    </div>

                    {/* Info Section */}
                    <div className="mt-6 p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                        <h4 className="text-sm font-bold text-slate-300 mb-2">How Enchantments Work</h4>
                        <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                            <li>Each tier has its own enchantment slot</li>
                            <li>You can equip one enchantment per tier (up to 3 total)</li>
                            <li>Enchantments persist until you unequip them</li>
                            <li>Proc-based enchantments (Pulse, Percussive, Empowering) trigger every 25 attacks</li>
                            <li>Empowering's speed bonus is permanent once triggered</li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/30 flex-shrink-0 flex justify-between items-center">
                    <div className="text-xs text-slate-500">
                        Player Level: <span className="text-yellow-400 font-bold">{level}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-yellow-600/20 border border-yellow-600/40 text-yellow-500 rounded hover:bg-yellow-600/30 transition-colors font-medium"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

export default EnchantmentScreen;
