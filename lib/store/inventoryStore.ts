"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
    Inventory,
    getInitialInventory,
    MaterialItemId,
    ReedStrength,
    ALL_RECIPES,
} from "../game/inventory";

/**
 * Inventory Store
 * Manages materials, reeds, and crafting recipes.
 * Separated from playerStore for maintainability.
 */
export interface InventoryState {
    inventory: Inventory;
    // Echoes is duplicated here for inventory sync (primary source is playerStore.echoes)
    echoes: number;
    version: number;

    // Actions
    addMaterial: (itemId: MaterialItemId, quantity: number) => void;
    addMaterials: (items: Partial<Record<MaterialItemId, number>>) => void;
    addReed: (strength: ReedStrength, quantity: number) => void;
    removeMaterial: (itemId: MaterialItemId, quantity: number) => boolean;
    removeReed: (strength: ReedStrength, quantity: number) => boolean;
    craftRecipe: (recipeId: string) => boolean;

    // For cross-store sync
    setEchoes: (echoes: number) => void;
    syncEchoes: (delta: number) => void;
}

export const useInventoryStore = create<InventoryState>()(
    subscribeWithSelector((set, get) => ({
        inventory: { ...getInitialInventory() },
        echoes: 0,
        version: 0,

        setEchoes: (echoes) => set({
            echoes,
            inventory: {
                ...get().inventory,
                materials: { ...get().inventory.materials, echoes },
            },
        }),

        syncEchoes: (delta) => set((state) => ({
            echoes: state.echoes + delta,
            version: state.version + 1,
            inventory: {
                ...state.inventory,
                materials: { ...state.inventory.materials, echoes: state.echoes + delta },
            },
        })),

        addMaterial: (itemId, quantity) => set((state) => {
            const newMaterials = {
                ...state.inventory.materials,
                [itemId]: state.inventory.materials[itemId] + quantity,
            };

            if (itemId === 'echoes') {
                return {
                    echoes: state.echoes + quantity,
                    version: state.version + 1,
                    inventory: { ...state.inventory, materials: newMaterials },
                };
            }

            return {
                inventory: { ...state.inventory, materials: newMaterials },
                version: state.version + 1,
            };
        }),

        addMaterials: (items) => set((state) => {
            const newMaterials = { ...state.inventory.materials };
            let echoesAdded = 0;
            for (const [itemId, qty] of Object.entries(items)) {
                if (qty && qty > 0) {
                    newMaterials[itemId as MaterialItemId] = (newMaterials[itemId as MaterialItemId] || 0) + qty;
                    if (itemId === 'echoes') echoesAdded += qty;
                }
            }
            return {
                ...(echoesAdded > 0 ? { echoes: state.echoes + echoesAdded } : {}),
                inventory: { ...state.inventory, materials: newMaterials },
                version: state.version + 1,
            };
        }),

        addReed: (strength, quantity) => set((state) => ({
            inventory: {
                ...state.inventory,
                reeds: {
                    ...state.inventory.reeds,
                    [strength]: state.inventory.reeds[strength] + quantity,
                },
            },
            version: state.version + 1,
        })),

        removeMaterial: (itemId, quantity) => {
            const state = get();
            const currentQty = state.inventory.materials[itemId];
            if (currentQty < quantity) return false;

            const newMaterials = {
                ...state.inventory.materials,
                [itemId]: currentQty - quantity,
            };

            if (itemId === 'echoes') {
                const { usePlayerStore } = require('./playerStore');
                usePlayerStore.getState().collectEchoes(-quantity);
                return true;
            }

            set({
                inventory: { ...state.inventory, materials: newMaterials },
            });
            return true;
        },

        removeReed: (strength, quantity) => {
            const state = get();
            const currentQty = state.inventory.reeds[strength];
            if (currentQty < quantity) return false;

            set({
                inventory: {
                    ...state.inventory,
                    reeds: {
                        ...state.inventory.reeds,
                        [strength]: currentQty - quantity,
                    },
                },
                version: state.version + 1,
            });
            return true;
        },

        craftRecipe: (recipeId) => {
            const state = get();
            const recipe = ALL_RECIPES.find(r => r.id === recipeId);
            if (!recipe) return false;

            // Check ingredients
            const inventory = state.inventory;
            for (const ing of recipe.ingredients) {
                let currentQty = 0;
                if (ing.itemId in inventory.materials) {
                    currentQty = inventory.materials[ing.itemId as MaterialItemId] || 0;
                } else if (ing.itemId in inventory.reeds) {
                    currentQty = inventory.reeds[ing.itemId as ReedStrength] || 0;
                } else if (ing.itemId === 'echoes') {
                    currentQty = state.echoes;
                }

                if (currentQty < ing.quantity) return false;
            }

            // Deduct ingredients
            set((state) => {
                const newMaterials = { ...state.inventory.materials };
                const newReeds = { ...state.inventory.reeds };
                let newEchoes = state.echoes;

                for (const ing of recipe.ingredients) {
                    if (ing.itemId === 'echoes') {
                        newEchoes -= ing.quantity;
                        newMaterials.echoes = newEchoes;
                    } else if (ing.itemId in newMaterials) {
                        newMaterials[ing.itemId as MaterialItemId] -= ing.quantity;
                    } else if (ing.itemId in newReeds) {
                        newReeds[ing.itemId as ReedStrength] -= ing.quantity;
                    }
                }

                // Deduct from playerStore if echoes were used
                if (newEchoes !== state.echoes) {
                    const { usePlayerStore } = require('./playerStore');
                    usePlayerStore.getState().collectEchoes(-(state.echoes - newEchoes));
                }

                // Add output
                if (recipe.outputId in newReeds) {
                    newReeds[recipe.outputId as ReedStrength] = (newReeds[recipe.outputId as ReedStrength] || 0) + recipe.outputQuantity;

                    // Award XP for crafting reeds — call into playerStore
                    const strengthVal = parseFloat(recipe.outputId as string);
                    if (!isNaN(strengthVal)) {
                        const xpReward = Math.floor((strengthVal ** 2) * 10);
                        // Lazy import to avoid circular dependency
                        const { usePlayerStore } = require('./playerStore');
                        usePlayerStore.getState().addXp(xpReward);
                    }
                } else if (recipe.outputId in newMaterials) {
                    newMaterials[recipe.outputId as MaterialItemId] = (newMaterials[recipe.outputId as MaterialItemId] || 0) + recipe.outputQuantity;
                }

                return {
                    echoes: newEchoes,
                    inventory: { ...state.inventory, materials: newMaterials, reeds: newReeds },
                    version: state.version + 1,
                };
            });

            return true;
        },
    }))
);

// Subscribe to playerStore to keep echoes in sync
if (typeof window !== 'undefined') {
    const { usePlayerStore } = require('./playerStore');
    usePlayerStore.subscribe(
        (state: any) => state.echoes,
        (echoes: number) => {
            const currentEchoes = useInventoryStore.getState().echoes;
            if (currentEchoes !== echoes) {
                useInventoryStore.getState().setEchoes(echoes);
            }
        }
    );
}

export default useInventoryStore;
