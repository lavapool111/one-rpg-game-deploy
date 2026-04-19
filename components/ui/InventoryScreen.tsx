'use client';

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { usePlayerStore } from '@/lib/store';
import { useAccessoryStore } from '@/lib/store/accessoryStore';
import { useInventoryStore } from '@/lib/store/inventoryStore';
import { getTerms, getAbilityName, localizeItemName, SLOT_BONUSES } from '@/lib/store/playerStore';
import {
    ITEM_DEFINITIONS,
    MaterialItemId,
    ReedStrength,
    getRarityColor,
    getRarityBorderColor,
    REED_MULTIPLIERS,
    ItemId,
    RECIPE_MAP,
    MATERIAL_RECIPES,
    REED_RECIPES,
    LIGATURE_DATA,
    getLigatureData,
    getLigatureUpgradeCost,
    MOUTHPIECE_DATA,
    getMouthpieceData,
    getMouthpieceUpgradeCost,
    CASE_DATA,
    getCaseStats,
    getCaseData,
    getCaseUpgradeCost,
    getEnchantmentData,
    ENCHANTMENT_SLOT_LEVELS,
    MeldType,
    MELD_TYPE_INFO,
    MELD_UNLOCK_LEVEL,
    getMeldStats,
    getMeldTierCost
} from '@/lib/game/inventory';
import { EnchantmentScreen } from './EnchantmentScreen';
import { AbilityUpgradeSubTab } from './AbilityUpgradeSubTab';
import { AbilityUpgradeScreen } from './AbilityUpgradeScreen';

// Sub-components
import { InventorySlot } from './inventory/InventorySlot';
import { RecipeCard } from './inventory/RecipeCard';
import { DungeonTimeUpgradeCard } from './inventory/DungeonTimeUpgradeCard';
import { UpgradeCard } from './inventory/UpgradeCard';
import { EquippedItemSummary } from './inventory/EquippedItemSummary';
import { CategoryTabs, SubTabs } from './inventory/InventoryTabSystem';

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
    const [activeTab, setActiveTab] = useState<'materials' | 'accessories' | 'crafting' | 'enchantments' | 'ability_upgrades'>('materials');
    const [selectedItemId, setSelectedItemId] = useState<ItemId | null>(null);
    const [hoveredItemId, setHoveredItemId] = useState<ItemId | null>(null);
    const [showEnchantmentScreen, setShowEnchantmentScreen] = useState(false);
    const [showAbilityUpgradeScreen, setShowAbilityUpgradeScreen] = useState(false);

    const inventory = useInventoryStore((state) => state.inventory);
    const echoes = usePlayerStore((state) => state.echoes);
    const equippedReed = useAccessoryStore((state) => state.equippedReed);
    const reedDurability = useAccessoryStore((state) => state.reedDurability);
    const equipReed = useAccessoryStore((state) => state.equipReed);
    const unequipReed = useAccessoryStore((state) => state.unequipReed);
    const craftRecipe = useInventoryStore((state) => state.craftRecipe);
    const upgradeDungeonTime = useAccessoryStore((state) => state.upgradeDungeonTime);
    const getNextDungeonUpgradeCost = useAccessoryStore((state) => state.getNextDungeonUpgradeCost);
    const getDungeonTimeLimit = useAccessoryStore((state) => state.getDungeonTimeLimit);

    // Ligature hooks
    const equippedLigature = useAccessoryStore((state) => state.equippedLigature);
    const equipLigature = useAccessoryStore((state) => state.equipLigature);
    const unequipLigature = useAccessoryStore((state) => state.unequipLigature);
    const craftLigature = useAccessoryStore((state) => state.craftLigature);
    const upgradeLigature = useAccessoryStore((state) => state.upgradeLigature);
    const getLigatureBonus = useAccessoryStore((state) => state.getLigatureBonus);
    const accessorySlots = useAccessoryStore((state) => state.accessorySlots);

    // Mouthpiece hooks
    const equippedMouthpiece = useAccessoryStore((state) => state.equippedMouthpiece);
    const equipMouthpiece = useAccessoryStore((state) => state.equipMouthpiece);
    const unequipMouthpiece = useAccessoryStore((state) => state.unequipMouthpiece);
    const craftMouthpiece = useAccessoryStore((state) => state.craftMouthpiece);
    const upgradeMouthpiece = useAccessoryStore((state) => state.upgradeMouthpiece);
    const getMouthpieceBonus = useAccessoryStore((state) => state.getMouthpieceBonus);

    // Case hooks
    const equippedCase = useAccessoryStore((state) => state.equippedCase);
    const equipCase = useAccessoryStore((state) => state.equipCase);
    const unequipCase = useAccessoryStore((state) => state.unequipCase);
    const craftCase = useAccessoryStore((state) => state.craftCase);
    const upgradeCase = useAccessoryStore((state) => state.upgradeCase);
    const getCaseBonus = useAccessoryStore((state) => state.getCaseBonus);

    // Case melding hooks
    const meldCase = useAccessoryStore((state) => state.meldCase);
    const getMeldBonus = useAccessoryStore((state) => state.getMeldBonus);

    // Enchantment hooks
    const equippedEnchantments = useAccessoryStore((state) => state.equippedEnchantments);
    const enchantmentSlots = useAccessoryStore((state) => state.enchantmentSlots);
    const equipEnchantment = useAccessoryStore((state) => state.equipEnchantment);
    const unequipEnchantment = useAccessoryStore((state) => state.unequipEnchantment);
    const craftEnchantment = useAccessoryStore((state) => state.craftEnchantment);
    const getEnchantmentBonus = useAccessoryStore((state) => state.getEnchantmentBonus);
    const isEnchantmentSlotUnlocked = useAccessoryStore((state) => state.isEnchantmentSlotUnlocked);
    const level = usePlayerStore((state) => state.level);

    // Slot position hooks
    const ligatureSlot = useAccessoryStore((state) => state.ligatureSlot);
    const mouthpieceSlot = useAccessoryStore((state) => state.mouthpieceSlot);
    const reedSlot = useAccessoryStore((state) => state.reedSlot);
    const caseSlot = useAccessoryStore((state) => state.caseSlot);
    const setLigatureSlot = useAccessoryStore((state) => state.setLigatureSlot);
    const setMouthpieceSlot = useAccessoryStore((state) => state.setMouthpieceSlot);
    const setReedSlot = useAccessoryStore((state) => state.setReedSlot);
    const setCaseSlot = useAccessoryStore((state) => state.setCaseSlot);
    const getSlotContent = useAccessoryStore((state) => state.getSlotContent);

    // Selected slot for placement UI (null = no slot selected)
    const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

    // Crafting sub-tab state
    const [craftingSubTab, setCraftingSubTab] = useState<'materials' | 'reeds' | 'ligatures' | 'mouthpieces' | 'cases'>('materials');

    // Materials sub-tab state
    const [materialSubTab, setMaterialSubTab] = useState<'general' | 'case_fragments'>('general');

    // Player class for terminology
    const playerClass = usePlayerStore((state) => state.playerClass);
    const terms = getTerms(playerClass);

    // Staggered rendering phase (0 to 3)
    const [renderPhase, setRenderPhase] = useState(0);
    const [isClosing, setIsClosing] = useState(false);

    const accessoryStoreMemo = useMemo(() => ({
        ligatureSlot, mouthpieceSlot, reedSlot, caseSlot,
        equippedLigature, equippedMouthpiece, equippedReed, equippedCase,
        reedDurability, getCaseBonus
    }), [
        ligatureSlot, mouthpieceSlot, reedSlot, caseSlot,
        equippedLigature, equippedMouthpiece, equippedReed, equippedCase,
        reedDurability, getCaseBonus
    ]);

    useEffect(() => {
        let frame: number;
        const nextPhase = () => {
            setRenderPhase(prev => {
                if (prev < 4) {
                    frame = requestAnimationFrame(nextPhase);
                    return prev + 1;
                }
                return prev;
            });
        };
        frame = requestAnimationFrame(nextPhase);
        return () => cancelAnimationFrame(frame);
    }, []);

    const handleClose = useCallback(() => {
        if (isClosing) return;
        setIsClosing(true);

        let frameIdx = 0;
        const closeFrames = () => {
            frameIdx++;
            if (frameIdx < 3) {
                setRenderPhase(prev => Math.max(0, prev - 1));
                requestAnimationFrame(closeFrames);
            } else {
                onClose();
            }
        };
        requestAnimationFrame(closeFrames);
    }, [isClosing, onClose]);

    const handleItemHover = useCallback((itemId: ItemId | null) => {
        setHoveredItemId(itemId);
    }, []);

    const handleItemClick = useCallback((itemId: ItemId) => {
        setSelectedItemId(prev => prev === itemId ? null : itemId);
    }, []);

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

    // Case Fragment item IDs for filtering - defined outside or memoized
    const caseFragmentIds = useMemo(() => new Set<MaterialItemId>([
        'plated_fragment_t1', 'plated_fragment_t2', 'plated_fragment_t3', 'plated_fragment_t4', 'plated_fragment_t5',
        'weaved_fragment_t1', 'weaved_fragment_t2', 'weaved_fragment_t3', 'weaved_fragment_t4', 'weaved_fragment_t5',
        'sundered_fragment_t1', 'sundered_fragment_t2', 'sundered_fragment_t3', 'sundered_fragment_t4', 'sundered_fragment_t5',
        'metallic_fragment_t1', 'metallic_fragment_t2', 'metallic_fragment_t3', 'metallic_fragment_t4', 'metallic_fragment_t5',
        'corrupted_fragment_t1', 'corrupted_fragment_t2', 'corrupted_fragment_t3', 'corrupted_fragment_t4', 'corrupted_fragment_t5',
    ]), []);

    const fragmentGroups = useMemo(() => [
        { label: 'Plated Fragments', emoji: '🛡️', ids: ['plated_fragment_t1', 'plated_fragment_t2', 'plated_fragment_t3', 'plated_fragment_t4', 'plated_fragment_t5'] as MaterialItemId[] },
        { label: 'Weaved Fragments', emoji: '🧵', ids: ['weaved_fragment_t1', 'weaved_fragment_t2', 'weaved_fragment_t3', 'weaved_fragment_t4', 'weaved_fragment_t5'] as MaterialItemId[] },
        { label: 'Sundered Fragments', emoji: '⚡', ids: ['sundered_fragment_t1', 'sundered_fragment_t2', 'sundered_fragment_t3', 'sundered_fragment_t4', 'sundered_fragment_t5'] as MaterialItemId[] },
        { label: 'Metallic Fragments', emoji: '⚙️', ids: ['metallic_fragment_t1', 'metallic_fragment_t2', 'metallic_fragment_t3', 'metallic_fragment_t4', 'metallic_fragment_t5'] as MaterialItemId[] },
        { label: 'Corrupted Fragments', emoji: '💀', ids: ['corrupted_fragment_t1', 'corrupted_fragment_t2', 'corrupted_fragment_t3', 'corrupted_fragment_t4', 'corrupted_fragment_t5'] as MaterialItemId[] },
    ], []);

    // Memoize the filtered materials list
    const generalMaterials = useMemo(() => (
        (Object.keys(inventory.materials) as MaterialItemId[])
            .filter(id => !caseFragmentIds.has(id))
            .map(itemId => {
                const quantity = inventory.materials[itemId] || 0;
                const item = ITEM_DEFINITIONS[itemId];
                return { itemId, quantity, item };
            })
    ), [inventory.materials, caseFragmentIds]);

    const items = useMemo(() => {
        if (activeTab === 'materials') return []; // Handled by sub-tabs
        if (activeTab === 'accessories') return []; // Handled by slots
        return [];
    }, [activeTab]);

    // Get items for the current category
    const renderItems = () => {
        switch (activeTab) {
            case 'materials': {
                return (
                    <div className="space-y-3">
                        <SubTabs
                            tabs={['general', 'case_fragments'] as const}
                            activeTab={materialSubTab}
                            onTabChange={setMaterialSubTab}
                            getLabel={(tab) => tab === 'general' ? 'General' : 'Case Fragments'}
                        />

                        {materialSubTab === 'general' && renderPhase >= 3 && (
                            <div className="grid grid-cols-4 gap-3">
                                {generalMaterials.map(({ itemId, quantity, item }) => {
                                    if (!item && !itemId) return null;
                                    const itemName = item?.name || itemId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

                                    return (
                                        <InventorySlot
                                            key={itemId}
                                            name={localizeItemName(itemName, playerClass)}
                                            quantity={quantity}
                                            rarity={item?.rarity || 'common'}
                                            description={item?.description || ''}
                                            isSelected={selectedItemId === itemId}
                                            onHover={(hovering) => handleItemHover(hovering ? itemId : null)}
                                            onClick={() => handleItemClick(itemId)}
                                        />
                                    );
                                })}
                            </div>
                        )}

                        {materialSubTab === 'case_fragments' && renderPhase >= 4 && (
                            <div className="space-y-4">
                                {fragmentGroups.map((group) => (
                                    <div key={group.label}>
                                        <h3 className="text-yellow-500 text-xs font-bold uppercase tracking-wider mb-2">{group.emoji} {group.label}</h3>
                                        <div className="grid grid-cols-5 gap-2">
                                            {group.ids.map((itemId) => {
                                                const quantity = inventory.materials[itemId] || 0;
                                                const item = ITEM_DEFINITIONS[itemId];
                                                const itemName = item?.name || itemId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

                                                return (
                                                    <InventorySlot
                                                        key={itemId}
                                                        name={localizeItemName(itemName, playerClass)}
                                                        quantity={quantity}
                                                        rarity={item?.rarity || 'common'}
                                                        description={item?.description || ''}
                                                        isSelected={selectedItemId === itemId}
                                                        onHover={(hovering) => handleItemHover(hovering ? itemId : null)}
                                                        onClick={() => handleItemClick(itemId)}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            }



            case 'accessories': {
                const ligatureBonus = getLigatureBonus();

                return (
                    <div className="space-y-4">
                        {/* Accessory Slots Grid - 4x2 */}
                        <div>
                            <h3 className="text-yellow-500 text-xs font-bold uppercase tracking-wider mb-2">Accessory Slots ({accessorySlots} slots) - Click to select</h3>
                            <div className="grid grid-cols-4 gap-2">
                                {renderPhase >= 3 && Array.from({ length: 8 }).map((_, i) => (
                                    <AccessorySlotDisplay
                                        key={i}
                                        index={i}
                                        isSelected={selectedSlot === i}
                                        onSelect={setSelectedSlot}
                                        accessoryStore={accessoryStoreMemo}
                                        playerClass={playerClass}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Slot Selection Panel - Shows when a slot is selected */}
                        {selectedSlot !== null && (
                            <div className="p-3 rounded-lg border border-yellow-500/50 bg-yellow-900/10">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-yellow-400 font-semibold text-sm">Slot {selectedSlot + 1} - Choose Accessory</h3>
                                    <button
                                        onClick={() => setSelectedSlot(null)}
                                        className="text-slate-400 hover:text-white text-lg"
                                    >×</button>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {/* Ligatures */}
                                    {inventory.ligatures.length > 0 && inventory.ligatures.map((lig, idx) => {
                                        const data = getLigatureData(lig.id);
                                        const isEquippedHere = ligatureSlot === selectedSlot && equippedLigature?.id === lig.id && equippedLigature?.level === lig.level;
                                        const isEquippedElsewhere = equippedLigature?.id === lig.id && equippedLigature?.level === lig.level && ligatureSlot !== selectedSlot;
                                        return (
                                            <button
                                                key={`lig-${idx}`}
                                                disabled={isEquippedElsewhere}
                                                onClick={() => {
                                                    if (isEquippedHere) {
                                                        unequipLigature();
                                                        setLigatureSlot(-1);
                                                    } else {
                                                        equipLigature(idx);
                                                        setLigatureSlot(selectedSlot);
                                                    }
                                                    setSelectedSlot(null);
                                                }}
                                                className={`p-2 rounded border text-left ${isEquippedHere ? 'border-green-500 bg-green-900/30' : isEquippedElsewhere ? 'border-slate-600 bg-slate-800/50 opacity-50 cursor-not-allowed' : 'border-slate-600 bg-slate-800/50 hover:border-green-500/50'}`}
                                            >
                                                <div className="flex items-center gap-1">
                                                    <span>🎺</span>
                                                    <span className={`text-[10px] ${getRarityColor(data.rarity)}`}>{localizeItemName(data.name, playerClass)}</span>
                                                </div>
                                                <div className="text-[9px] text-slate-400">Lv {lig.level}</div>
                                                {isEquippedHere && <div className="text-[9px] text-green-400">Click to remove</div>}
                                                {isEquippedElsewhere && <div className="text-[9px] text-slate-500">In slot {ligatureSlot + 1}</div>}
                                            </button>
                                        );
                                    })}
                                    {/* Mouthpieces */}
                                    {inventory.mouthpieces.length > 0 && inventory.mouthpieces.map((mp, idx) => {
                                        const data = getMouthpieceData(mp.id);
                                        const displayName = playerClass === 'viola' ? data.violaName : data.name;
                                        const isEquippedHere = mouthpieceSlot === selectedSlot && equippedMouthpiece?.id === mp.id && equippedMouthpiece?.level === mp.level;
                                        const isEquippedElsewhere = equippedMouthpiece?.id === mp.id && equippedMouthpiece?.level === mp.level && mouthpieceSlot !== selectedSlot;
                                        return (
                                            <button
                                                key={`mp-${idx}`}
                                                disabled={isEquippedElsewhere}
                                                onClick={() => {
                                                    if (isEquippedHere) {
                                                        unequipMouthpiece();
                                                        setMouthpieceSlot(-1);
                                                    } else {
                                                        equipMouthpiece(idx);
                                                        setMouthpieceSlot(selectedSlot);
                                                    }
                                                    setSelectedSlot(null);
                                                }}
                                                className={`p-2 rounded border text-left ${isEquippedHere ? 'border-orange-500 bg-orange-900/30' : isEquippedElsewhere ? 'border-slate-600 bg-slate-800/50 opacity-50 cursor-not-allowed' : 'border-slate-600 bg-slate-800/50 hover:border-orange-500/50'}`}
                                            >
                                                <div className="flex items-center gap-1">
                                                    <span>{mp.id === 'plastic' ? '🎵' : '🎶'}</span>
                                                    <span className={`text-[10px] ${getRarityColor(data.rarity)}`}>{displayName}</span>
                                                </div>
                                                <div className="text-[9px] text-slate-400">Lv {mp.level}</div>
                                                {isEquippedHere && <div className="text-[9px] text-orange-400">Click to remove</div>}
                                                {isEquippedElsewhere && <div className="text-[9px] text-slate-500">In slot {mouthpieceSlot + 1}</div>}
                                            </button>
                                        );
                                    })}
                                    {/* Reeds */}
                                    {(Object.keys(inventory.reeds) as ReedStrength[])
                                        .filter(strength => parseFloat(strength) <= maxInventoryVisible && inventory.reeds[strength] > 0)
                                        .map((strength) => {
                                            const item = ITEM_DEFINITIONS[strength];
                                            const isEquippedHere = reedSlot === selectedSlot && equippedReed === strength;
                                            const isEquippedElsewhere = equippedReed === strength && reedSlot !== selectedSlot && reedSlot !== -1;
                                            if (!item) return null;
                                            return (
                                                <button
                                                    key={`reed-${strength}`}
                                                    disabled={isEquippedElsewhere}
                                                    onClick={() => {
                                                        if (isEquippedHere) {
                                                            unequipReed();
                                                            setReedSlot(-1);
                                                        } else {
                                                            equipReed(strength);
                                                            setReedSlot(selectedSlot);
                                                        }
                                                        setSelectedSlot(null);
                                                    }}
                                                    className={`p-2 rounded border text-left ${isEquippedHere ? 'border-cyan-500 bg-cyan-900/30' : isEquippedElsewhere ? 'border-slate-600 bg-slate-800/50 opacity-50 cursor-not-allowed' : 'border-slate-600 bg-slate-800/50 hover:border-cyan-500/50'}`}
                                                >
                                                    <div className="flex items-center gap-1">
                                                        <span>🎼</span>
                                                        <span className={`text-[10px] ${getRarityColor(item.rarity)}`}>{localizeItemName(item.name, playerClass)}</span>
                                                    </div>
                                                    <div className="text-[9px] text-slate-400">x{inventory.reeds[strength]}</div>
                                                    {isEquippedHere && <div className="text-[9px] text-cyan-400">Click to remove</div>}
                                                    {isEquippedElsewhere && <div className="text-[9px] text-slate-500">In slot {reedSlot + 1}</div>}
                                                </button>
                                            );
                                        })}
                                    {/* Cases */}
                                    {inventory.cases.length > 0 && inventory.cases.map((caseItem, idx) => {
                                        const data = getCaseData(caseItem.id);
                                        const stats = getCaseStats(caseItem.id, caseItem.level);
                                        const isEquippedHere = caseSlot === selectedSlot && equippedCase?.id === caseItem.id && equippedCase?.level === caseItem.level;
                                        const isEquippedElsewhere = equippedCase?.id === caseItem.id && equippedCase?.level === caseItem.level && caseSlot !== selectedSlot;
                                        return (
                                            <button
                                                key={`case-${idx}`}
                                                disabled={isEquippedElsewhere}
                                                onClick={() => {
                                                    if (isEquippedHere) {
                                                        unequipCase();
                                                        setCaseSlot(-1);
                                                    } else {
                                                        equipCase(idx);
                                                        setCaseSlot(selectedSlot);
                                                    }
                                                    setSelectedSlot(null);
                                                }}
                                                className={`p-2 rounded border text-left ${isEquippedHere ? 'border-purple-500 bg-purple-900/30' : isEquippedElsewhere ? 'border-slate-600 bg-slate-800/50 opacity-50 cursor-not-allowed' : 'border-slate-600 bg-slate-800/50 hover:border-purple-500/50'}`}
                                            >
                                                <div className="flex items-center gap-1">
                                                    <span>📦</span>
                                                    <span className={`text-[10px] ${getRarityColor(data.rarity)}`}>{stats.name}</span>
                                                </div>
                                                <div className="text-[9px] text-slate-400">Lv {caseItem.level}</div>
                                                {isEquippedHere && <div className="text-[9px] text-purple-400">Click to remove</div>}
                                                {isEquippedElsewhere && <div className="text-[9px] text-slate-500">In slot {caseSlot + 1}</div>}
                                            </button>
                                        );
                                    })}
                                </div>
                                {inventory.ligatures.length === 0 && inventory.mouthpieces.length === 0 && Object.values(inventory.reeds).every(q => q === 0) && inventory.cases.length === 0 && (
                                    <p className="text-slate-500 text-sm text-center py-2">No accessories available. Craft some in the Crafting tab!</p>
                                )}
                            </div>
                        )}

                        <div className="space-y-3">
                            {/* Equipped Ligature Stats */}
                            {equippedLigature && (
                                <EquippedItemSummary
                                    title={`${localizeItemName(getLigatureData(equippedLigature.id).name, playerClass)}`}
                                    slotIndex={ligatureSlot}
                                    textClass="text-yellow-500"
                                    borderClass="border-yellow-600/30"
                                    onUnequip={() => { unequipLigature(); setLigatureSlot(-1); }}
                                >
                                    <div className="text-slate-400">
                                        {getAbilityName(playerClass)}: <span className="text-green-400">+{(ligatureBonus.longToneDurationMs / 1000).toFixed(1)}s</span>
                                    </div>
                                    <div className="text-slate-400">
                                        Tuba Damage: <span className="text-blue-400">+{(ligatureBonus.tubaDamageBonus * 100).toFixed(0)}%</span>
                                    </div>
                                </EquippedItemSummary>
                            )}

                            {/* Equipped Mouthpiece Stats */}
                            {equippedMouthpiece && (
                                <EquippedItemSummary
                                    title={`${playerClass === 'viola' ? getMouthpieceData(equippedMouthpiece.id).violaName : getMouthpieceData(equippedMouthpiece.id).name} Lv ${equippedMouthpiece.level}`}
                                    slotIndex={mouthpieceSlot}
                                    textClass="text-orange-500"
                                    borderClass="border-orange-600/30"
                                    onUnequip={() => { unequipMouthpiece(); setMouthpieceSlot(-1); }}
                                >
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
                                </EquippedItemSummary>
                            )}

                            {/* Equipped Reed Stats */}
                            {equippedReed && (
                                <EquippedItemSummary
                                    title={localizeItemName(ITEM_DEFINITIONS[equippedReed]?.name || `${terms.reed} ${equippedReed}`, playerClass)}
                                    slotIndex={reedSlot}
                                    textClass="text-cyan-500"
                                    borderClass="border-cyan-600/30"
                                    onUnequip={() => { unequipReed(); setReedSlot(-1); }}
                                    gridCols={3}
                                    footer={`Durability: ${Math.floor(reedDurability / 60)}m ${Math.floor(reedDurability % 60)}s remaining`}
                                >
                                    <div className="text-slate-400">
                                        Crit: <span className="text-cyan-400">+{((REED_MULTIPLIERS[equippedReed]?.crit || 0) * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="text-slate-400">
                                        Def: <span className="text-blue-400">+{((REED_MULTIPLIERS[equippedReed]?.def || 0) * 100).toFixed(1)}%</span>
                                    </div>
                                    <div className="text-slate-400">
                                        Spd: <span className="text-green-400">+{Math.round(((REED_MULTIPLIERS[equippedReed]?.speed || 1) - 1) * 100)}%</span>
                                    </div>
                                </EquippedItemSummary>
                            )}

                            {/* Equipped Case Stats */}
                            {equippedCase && (
                                <EquippedItemSummary
                                    title={`${getCaseBonus()?.name || 'Undefined'} Lv ${equippedCase?.level ?? 'Undefined'}`}
                                    slotIndex={caseSlot}
                                    textClass="text-purple-500"
                                    borderClass="border-purple-600/30"
                                    onUnequip={() => { unequipCase(); setCaseSlot(-1); }}
                                    footer={equippedCase?.meldType && equippedCase?.meldTier && equippedCase.meldTier >= 1 && (
                                        <div className="text-slate-400 mt-1">
                                            Meld: <span className="text-amber-400">{MELD_TYPE_INFO[equippedCase.meldType].emoji} {MELD_TYPE_INFO[equippedCase.meldType].name} (Tier {equippedCase.meldTier})</span>
                                            {equippedCase.meldTier >= 2 && (() => {
                                                const meldStats = getMeldStats(equippedCase.meldType!, equippedCase.meldTier!);
                                                let statDisplay = '';
                                                if (meldStats.defense > 0) statDisplay = `+${(meldStats.defense * 100).toFixed(1)}% Defense`;
                                                else if (meldStats.selfHeal > 0) statDisplay = `+${(meldStats.selfHeal * 100).toFixed(2)}% HP/s`;
                                                else if (meldStats.critChance > 0) statDisplay = `+${(meldStats.critChance * 100).toFixed(1)}% Crit`;
                                                else if (meldStats.impact > 0) statDisplay = `+${meldStats.impact} Impact`;
                                                else if (meldStats.lifesteal > 0) statDisplay = `+${(meldStats.lifesteal * 100).toFixed(2)}% LifeSteal`;
                                                return <span className="text-xs text-amber-300 ml-1">({statDisplay})</span>;
                                            })()}
                                        </div>
                                    )}
                                >
                                    <div className="text-slate-400">
                                        Health: <span className="text-purple-400">×{(getCaseBonus()?.healthMultiplier || 1).toFixed(2)}</span>
                                    </div>
                                    {(getCaseBonus()?.speedBonus || 0) > 0 && (
                                        <div className="text-slate-400">
                                            Speed: <span className="text-green-400">+{(getCaseBonus()?.speedBonus || 0).toFixed(2)} ft/s</span>
                                        </div>
                                    )}
                                </EquippedItemSummary>
                            )}
                        </div>
                    </div>
                );
            }

            case 'crafting':
                return (
                    <div className="space-y-3">
                        <SubTabs
                            tabs={['materials', 'reeds', 'ligatures', 'mouthpieces', 'cases'] as const}
                            activeTab={craftingSubTab}
                            onTabChange={setCraftingSubTab}
                            getLabel={(tab) => tab === 'materials' ? 'Materials & Upgrades' : tab === 'reeds' ? terms.reeds : tab === 'ligatures' ? terms.ligatures : tab === 'mouthpieces' ? (playerClass === 'viola' ? 'Rosin' : 'Mouthpieces') : 'Cases'}
                        />

                        {/* Materials Sub-Tab */}
                        {craftingSubTab === 'materials' && (
                            <div className="space-y-3">
                                <div className="mb-2">
                                    <h3 className="text-yellow-500 text-xs font-bold uppercase tracking-wider mb-2">Backstage Halls Upgrades</h3>
                                    {renderPhase >= 3 && (
                                        <DungeonTimeUpgradeCard
                                            inventory={inventory}
                                            onUpgrade={upgradeDungeonTime}
                                            getCost={getNextDungeonUpgradeCost}
                                            getCurrentLimit={getDungeonTimeLimit}
                                        />
                                    )}
                                </div>

                                <h3 className="text-yellow-500 text-xs font-bold uppercase tracking-wider mb-2 mt-4">Material Crafting</h3>
                                {renderPhase >= 4 && MATERIAL_RECIPES.map((recipe) => (
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
                                {renderPhase >= 3 && REED_RECIPES.filter(recipe => {
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
                                        {renderPhase >= 3 && LIGATURE_DATA.map((ligature) => {
                                            const recipeId = `ligature_${ligature.id}_craft`;
                                            const recipe = RECIPE_MAP.get(recipeId);
                                            if (!recipe) return null;

                                            return (
                                                <RecipeCard
                                                    key={recipeId}
                                                    recipe={recipe}
                                                    inventory={inventory}
                                                    echoes={echoes}
                                                    onCraft={() => craftLigature(ligature.id)}
                                                    playerClass={playerClass}
                                                />
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
                                                const data = getLigatureData(lig.id);
                                                return (
                                                    <UpgradeCard
                                                        key={`lig-up-${index}`}
                                                        name={localizeItemName(data.name, playerClass)}
                                                        level={lig.level}
                                                        rarity={data.rarity}
                                                        ingredients={getLigatureUpgradeCost(lig.id, lig.level)}
                                                        inventory={inventory}
                                                        echoes={echoes}
                                                        onUpgrade={() => upgradeLigature(index)}
                                                        colorClass="purple-400"
                                                    />
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
                                        {renderPhase >= 3 && MOUTHPIECE_DATA.filter((mouthpiece) => mouthpiece.id !== 'crystal' || inventory.mouthpieces.some(m => m.id === 'crystal')).map((mouthpiece) => (
                                            <RecipeCard
                                                key={`mp-craft-${mouthpiece.id}`}
                                                recipe={{
                                                    id: `mouthpiece_${mouthpiece.id}_craft`,
                                                    outputId: mouthpiece.id as ItemId,
                                                    outputQuantity: 1,
                                                    name: playerClass === 'viola' ? mouthpiece.violaName : mouthpiece.name,
                                                    description: playerClass === 'viola' ? mouthpiece.violaDescription : mouthpiece.description,
                                                    ingredients: mouthpiece.recipe,
                                                    category: 'mouthpieces',
                                                    rarity: mouthpiece.rarity
                                                }}
                                                inventory={inventory}
                                                echoes={echoes}
                                                onCraft={() => craftMouthpiece(mouthpiece.id)}
                                                playerClass={playerClass}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Mouthpiece Upgrades */}
                                {inventory.mouthpieces.length > 0 && (
                                    <div>
                                        <h3 className="text-orange-400 text-xs font-bold uppercase tracking-wider mb-2">Upgrade {playerClass === 'viola' ? 'Rosin' : 'Mouthpieces'}</h3>
                                        <div className="space-y-2">
                                            {inventory.mouthpieces.map((mp, index) => {
                                                const data = getMouthpieceData(mp.id);
                                                return (
                                                    <UpgradeCard
                                                        key={`mp-up-${index}`}
                                                        name={playerClass === 'viola' ? data.violaName : data.name}
                                                        level={mp.level}
                                                        rarity={data.rarity}
                                                        ingredients={getMouthpieceUpgradeCost(mp.id, mp.level)}
                                                        inventory={inventory}
                                                        echoes={echoes}
                                                        onUpgrade={() => upgradeMouthpiece(index)}
                                                        colorClass="orange-400"
                                                        icon={mp.id === 'plastic' ? '🎵' : '🎶'}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Cases Sub-Tab */}
                        {craftingSubTab === 'cases' && (
                            <div className="space-y-4">
                                {/* Base Case Crafting */}
                                <div>
                                    <h3 className="text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">Craft New Cases</h3>
                                    <div className="space-y-2">
                                        {CASE_DATA.map((caseItem) => (
                                            <RecipeCard
                                                key={`case-craft-${caseItem.id}`}
                                                recipe={{
                                                    id: `case_${caseItem.id}_craft`,
                                                    outputId: caseItem.id as ItemId,
                                                    outputQuantity: 1,
                                                    name: caseItem.name,
                                                    description: caseItem.description,
                                                    ingredients: caseItem.recipe,
                                                    category: 'cases',
                                                    rarity: caseItem.rarity
                                                }}
                                                inventory={inventory}
                                                echoes={echoes}
                                                onCraft={() => craftCase(caseItem.id)}
                                                playerClass={playerClass}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Case Upgrades */}
                                {inventory.cases.length > 0 && (
                                    <div>
                                        <h3 className="text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">Upgrade Cases</h3>
                                        <div className="space-y-2">
                                            {inventory.cases.map((caseItem, index) => {
                                                const data = getCaseData(caseItem.id);
                                                return (
                                                    <UpgradeCard
                                                        key={`case-up-${index}`}
                                                        name={data.name}
                                                        level={caseItem.level}
                                                        rarity={data.rarity}
                                                        ingredients={getCaseUpgradeCost(caseItem.id, caseItem.level)}
                                                        inventory={inventory}
                                                        echoes={echoes}
                                                        onUpgrade={() => upgradeCase(index)}
                                                        colorClass="purple-400"
                                                        icon="📦"
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Case Melding */}
                                {level >= MELD_UNLOCK_LEVEL && inventory.cases.length > 0 && (
                                    <div>
                                        <h3 className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">🔮 Meld Cases (Lv {MELD_UNLOCK_LEVEL}+)</h3>
                                        <p className="text-[10px] text-slate-500 mb-2">Meld fragments onto a case to gain a stat bonus. Each case can have one meld type, upgradeable to tier 5.</p>
                                        <div className="space-y-2">
                                            {inventory.cases.map((caseItem, index) => {
                                                const stats = getCaseStats(caseItem.id, caseItem.level);
                                                const currentTier = caseItem.meldTier || 0;
                                                const currentMeldType = caseItem.meldType;

                                                // Case has no meld yet - show type selection
                                                if (currentTier === 0) {
                                                    return (
                                                        <div key={`meld-${index}`} className="p-3 bg-slate-800/40 border border-amber-600/30 rounded-lg">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <span className="text-lg">📦</span>
                                                                <span className="font-bold text-slate-200">{stats.name} (Lv {caseItem.level})</span>
                                                                <span className="text-xs text-amber-400">— Choose Meld Type</span>
                                                            </div>
                                                            <div className="grid grid-cols-5 gap-1">
                                                                {(Object.keys(MELD_TYPE_INFO) as MeldType[]).map((mt) => (
                                                                    <button
                                                                        key={mt}
                                                                        onClick={() => meldCase(index, mt)}
                                                                        className="p-2 rounded border border-slate-600 bg-slate-800/50 hover:border-amber-500/50 hover:bg-amber-900/20 transition-colors text-center"
                                                                    >
                                                                        <div className="text-lg">{MELD_TYPE_INFO[mt].emoji}</div>
                                                                        <div className="text-[9px] text-slate-300">{MELD_TYPE_INFO[mt].name}</div>
                                                                        <div className="text-[8px] text-slate-500">{MELD_TYPE_INFO[mt].statName}</div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                // Case is melded
                                                const meldInfo = MELD_TYPE_INFO[currentMeldType!];
                                                const currentStats = getMeldStats(currentMeldType!, currentTier);

                                                // Show stat value
                                                let statLabel = '';
                                                if (currentTier >= 2) {
                                                    if (currentStats.defense > 0) statLabel = `+${(currentStats.defense * 100).toFixed(1)}% Defense`;
                                                    else if (currentStats.selfHeal > 0) statLabel = `+${(currentStats.selfHeal * 100).toFixed(2)}% HP/s`;
                                                    else if (currentStats.critChance > 0) statLabel = `+${(currentStats.critChance * 100).toFixed(1)}% Crit`;
                                                    else if (currentStats.impact > 0) statLabel = `+${currentStats.impact} Impact`;
                                                    else if (currentStats.lifesteal > 0) statLabel = `+${(currentStats.lifesteal * 100).toFixed(2)}% LifeSteal`;
                                                } else {
                                                    statLabel = 'No bonus (Tier 1)';
                                                }

                                                // Max tier
                                                if (currentTier >= 5) {
                                                    return (
                                                        <div key={`meld-${index}`} className="flex items-center justify-between p-3 bg-slate-800/40 border border-amber-600/30 rounded-lg">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded bg-amber-900/30 border border-amber-600/50 flex items-center justify-center text-xl">
                                                                    {meldInfo.emoji}
                                                                </div>
                                                                <div>
                                                                    <span className="font-bold text-amber-400">{stats.name} — {meldInfo.name} Meld</span>
                                                                    <span className="text-xs text-yellow-400 ml-2">(MAX TIER 5)</span>
                                                                    <div className="text-[10px] text-amber-300">{statLabel}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                // Upgradeable
                                                const nextTier = currentTier + 1;
                                                const upgradeCost = getMeldTierCost(currentMeldType!, nextTier);
                                                const canAfford = upgradeCost.every(ing => {
                                                    const have = inventory.materials[ing.itemId as MaterialItemId] || 0;
                                                    return have >= ing.quantity;
                                                });

                                                return (
                                                    <div key={`meld-${index}`} className="flex items-center justify-between p-3 bg-slate-800/40 border border-slate-700 rounded-lg hover:bg-slate-800/60 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded bg-amber-900/30 border border-amber-600/50 flex items-center justify-center text-xl">
                                                                {meldInfo.emoji}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-200">
                                                                    {stats.name} — {meldInfo.name} Meld
                                                                </div>
                                                                <div className="text-xs text-amber-400">Tier {currentTier} → Tier {nextTier}</div>
                                                                <div className="text-[10px] text-amber-300">{statLabel}</div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-6">
                                                            <div className="flex flex-col gap-1 text-xs">
                                                                {upgradeCost.map((ing, i) => {
                                                                    const have = inventory.materials[ing.itemId as MaterialItemId] || 0;
                                                                    const enough = have >= ing.quantity;
                                                                    return (
                                                                        <div key={i} className={`flex items-center gap-1 ${enough ? 'text-slate-400' : 'text-red-400'}`}>
                                                                            <span>{ing.quantity}x {ITEM_DEFINITIONS[ing.itemId as ItemId]?.name || ing.itemId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                                                                            <span className="opacity-50">({have})</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>

                                                            <button
                                                                onClick={() => meldCase(index, currentMeldType!)}
                                                                disabled={!canAfford}
                                                                className={`px-4 py-2 rounded font-bold text-xs uppercase tracking-wider transition-all ${canAfford
                                                                    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20'
                                                                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                                                    }`}
                                                            >
                                                                Meld
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                {level < MELD_UNLOCK_LEVEL && inventory.cases.length > 0 && (
                                    <div className="p-3 bg-slate-800/40 border border-slate-700/50 rounded-lg">
                                        <p className="text-sm text-slate-500">🔮 Case Melding unlocks at <span className="text-amber-400">Level {MELD_UNLOCK_LEVEL}</span></p>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                );

            case 'enchantments':
                return (
                    <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                            <h3 className="text-yellow-500 text-xs font-bold uppercase tracking-wider mb-2">Weapon Enchantments</h3>
                            <p className="text-sm text-slate-400 mb-4">
                                Enchantments enhance your weapon with magical properties. You can equip one enchantment from each tier (Common, Infused, Arcane) for a maximum of 3 active enchantments.
                            </p>

                            {/* Equipped Enchantments Summary */}
                            <div className="grid grid-cols-3 gap-2 mb-4">
                                {(['common', 'infused', 'arcane'] as const).map((tier) => {
                                    const enchant = equippedEnchantments[tier];
                                    const isUnlocked = isEnchantmentSlotUnlocked(tier);
                                    return (
                                        <div key={tier} className={`p-2 rounded border ${enchant ? 'border-green-500 bg-green-900/20' : 'border-slate-700 bg-slate-800/30'}`}>
                                            <p className="text-[10px] text-slate-500 uppercase">{tier}</p>
                                            {enchant ? (
                                                <>
                                                    <p className={`text-sm font-bold ${getRarityColor(getEnchantmentData(enchant.id, tier).rarity)}`}>
                                                        {tier === 'common' ? '✨' : tier === 'infused' ? '🔮' : '🌟'} {getEnchantmentData(enchant.id, tier).name}
                                                    </p>
                                                    <p className="text-[9px] text-green-400">Equipped</p>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="text-sm text-slate-600">Empty</p>
                                                    {!isUnlocked && <p className="text-[9px] text-red-400">Lv {ENCHANTMENT_SLOT_LEVELS[tier]} Required</p>}
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => setShowEnchantmentScreen(true)}
                                className="w-full py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
                            >
                                ✨ Open Enchantment Menu
                            </button>
                        </div>
                    </div>
                );

            case 'ability_upgrades':
                return (
                    <AbilityUpgradeSubTab
                        playerClass={playerClass}
                        onOpenUpgradeScreen={() => setShowAbilityUpgradeScreen(true)}
                    />
                );
        }
    };

    if (showEnchantmentScreen) {
        return <EnchantmentScreen onClose={() => setShowEnchantmentScreen(false)} />;
    }

    if (showAbilityUpgradeScreen) {
        return <AbilityUpgradeScreen onClose={() => setShowAbilityUpgradeScreen(false)} />;
    }

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-150 ${isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'} ${renderPhase === 0 ? 'bg-black/0' : 'bg-black/70 backdrop-blur-sm'}`}>
            <div className="bg-slate-900/95 border border-yellow-600/30 rounded-xl max-w-2xl w-full mx-4 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-yellow-600/20 bg-slate-800/50 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-yellow-500 tracking-wider uppercase">
                        Inventory
                    </h2>
                    <button
                        onClick={handleClose}
                        className="text-slate-400 hover:text-white transition-colors text-2xl font-bold"
                    >
                        ×
                    </button>
                </div>

                {/* Tabs */}
                {renderPhase >= 1 && (
                    <div className="flex border-b border-slate-700 flex-shrink-0">
                        {(['materials', 'accessories', 'crafting', 'enchantments', 'ability_upgrades'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => { setActiveTab(tab); setHoveredItemId(null); }}
                                className={`flex-1 py-3 px-4 text-center font-medium uppercase tracking-wider transition-all ${activeTab === tab
                                    ? 'text-yellow-400 bg-slate-800/50 border-b-2 border-yellow-500'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                                    }`}
                            >
                                {tab === 'enchantments' ? '✨ Enchant' :
                                    tab === 'ability_upgrades' ? '⬆️ Upgrades' : tab}
                            </button>
                        ))}
                    </div>
                )}

                {/* Content */}
                <div className="p-6 overflow-y-auto min-h-[200px] flex-grow">
                    {renderPhase >= 1 && renderItems()}
                </div>

                {/* Description Panel */}
                {renderPhase >= 2 && (
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
                                        CRIT: +{((REED_MULTIPLIERS[displayedItem.id as ReedStrength]?.crit || 0) * 100).toFixed(1)}% |
                                        DEF: +{((REED_MULTIPLIERS[displayedItem.id as ReedStrength]?.def || 0) * 100).toFixed(1)}% |
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
                )}

                {/* Footer */}
                {renderPhase >= 3 && (
                    <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/30 flex-shrink-0">
                        <button
                            onClick={handleClose}
                            className="w-full py-2 px-4 bg-yellow-600/20 border border-yellow-600/40 text-yellow-500 rounded hover:bg-yellow-600/30 transition-colors font-medium"
                        >
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

const AccessorySlotDisplay = memo(({ index, isSelected, onSelect, accessoryStore, playerClass }: any) => {
    const {
        ligatureSlot, mouthpieceSlot, reedSlot, caseSlot,
        equippedLigature, equippedMouthpiece, equippedReed, equippedCase,
        reedDurability, getCaseBonus
    } = accessoryStore;

    const hasLigature = ligatureSlot === index && equippedLigature;
    const hasMouthpiece = mouthpieceSlot === index && equippedMouthpiece;
    const hasReed = reedSlot === index && equippedReed;
    const hasCase = caseSlot === index && equippedCase;
    const isEmpty = !hasLigature && !hasMouthpiece && !hasReed && !hasCase;
    const bonus = Math.round((SLOT_BONUSES[index] || 0) * 100);

    let borderColor = 'border-slate-700';
    let bgColor = 'bg-slate-800/30';

    if (hasLigature) { borderColor = 'border-green-500'; bgColor = 'bg-green-900/20'; }
    if (hasMouthpiece) { borderColor = 'border-orange-500'; bgColor = 'bg-orange-900/20'; }
    if (hasReed) { borderColor = 'border-cyan-500'; bgColor = 'bg-cyan-900/20'; }
    if (hasCase) { borderColor = 'border-purple-500'; bgColor = 'bg-purple-900/20'; }
    if (isSelected) { borderColor = 'border-yellow-400'; bgColor = 'bg-yellow-900/20'; }

    return (
        <div
            className={`p-2 rounded-lg border-2 ${borderColor} ${bgColor} flex flex-col items-center justify-center min-h-[72px] cursor-pointer hover:border-yellow-500/50 transition-colors relative overflow-hidden`}
            onClick={() => onSelect(isSelected ? null : index)}
        >
            {/* Bonus Badge */}
            {bonus > 0 && (
                <div className={`absolute top-0 right-0 text-[8px] font-bold px-1 rounded-bl ${isEmpty ? 'bg-slate-700 text-slate-400' : 'bg-yellow-500/80 text-black'}`}>
                    +{bonus}%
                </div>
            )}

            {hasLigature && (
                <>
                    <span className="text-lg">🎺</span>
                    <p className="text-[10px] text-center text-green-400 truncate w-full px-1">
                        {localizeItemName(getLigatureData(equippedLigature!.id).name, playerClass)}
                    </p>
                    <p className="text-[9px] text-slate-400">Lv {equippedLigature?.level ?? 'Undefined'}</p>
                </>
            )}
            {hasMouthpiece && (
                <>
                    <span className="text-lg">{equippedMouthpiece!.id === 'plastic' ? '🎵' : '🎶'}</span>
                    <p className="text-[10px] text-center text-orange-400 truncate w-full px-1">
                        {playerClass === 'viola' ? getMouthpieceData(equippedMouthpiece!.id).violaName : getMouthpieceData(equippedMouthpiece!.id).name}
                    </p>
                    <p className="text-[9px] text-slate-400">Lv {equippedMouthpiece?.level ?? 'Undefined'}</p>
                </>
            )}
            {hasReed && (
                <>
                    <span className="text-lg">🎼</span>
                    <p className="text-[10px] text-center text-cyan-400 truncate w-full px-1">
                        {localizeItemName(ITEM_DEFINITIONS[equippedReed as ItemId]?.name || `Reed ${equippedReed}`, playerClass)}
                    </p>
                    <p className="text-[9px] text-slate-400">{Math.floor((reedDurability || 0) / 60)}m left</p>
                </>
            )}
            {hasCase && (
                <>
                    <span className="text-lg">📦</span>
                    <p className="text-[10px] text-center text-purple-400 truncate w-full px-1">
                        {getCaseBonus()?.name || 'Undefined'}
                    </p>
                    <p className="text-[9px] text-slate-400">Lv {equippedCase?.level ?? 'Undefined'}</p>
                </>
            )}
            {isEmpty && (
                <>
                    <p className="text-[10px] text-slate-500 font-medium">Slot {index + 1}</p>
                    {bonus > 0 && <p className="text-[9px] text-yellow-600/70">+{bonus}% Stats</p>}
                </>
            )}
        </div>
    );
});

export default InventoryScreen;
