"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useGameStore } from "./gameStore";
import { getStatsForLevel, getXpRequiredForLevel } from "../game/stats";
import { Inventory, INITIAL_INVENTORY, MaterialItemId, ReedStrength, REED_MULTIPLIERS, ALL_RECIPES } from "../game/inventory";
import AudioManager from "../audio/AudioManager";

const DEATH_SOUND_KEY = 'player-death';
const DEATH_SOUND_SRC = '/audio/cymbal-crash-412547 1.mp3';

// Stat Calculation with new Reed Stats
function calculateStats(level: number, reed: ReedStrength | null) {
  const base = getStatsForLevel(level);
  const baseSpeed = 4.5;

  if (!reed) {
    return {
      ...base,
      speed: baseSpeed,
      basicAttackDamage: base.damage,
      critChance: 0,
      defense: 0
    };
  }

  const stats = REED_MULTIPLIERS[reed];

  return {
    health: base.health, // Reeds no longer scale HP
    damage: base.damage, // Reeds no longer scale Damage
    basicAttackDamage: base.damage,
    speed: Number((baseSpeed * stats.speed).toFixed(2)),
    critChance: stats.crit,
    defense: stats.def
  };
}

/**
 * Player Store
 * State management for the Bb Clarinet player character
 */

export interface PlayerStats {
  level: number;
  health: number;
  maxHealth: number;
  damage: number;
  basicAttackDamage: number;
  speed: number;
  critChance: number; // 0.0 - 1.0
  defense: number; // 0.0 - 1.0
  xp: number;
  maxXp: number;
  echoes: number;
  equippedReed: ReedStrength | null;
  reedDurability: number;
  embouchure: number;
  embouchureXp: number;
  // Positioning
  position: [number, number, number];
}

export interface PlayerState extends PlayerStats {
  // Animation state
  isAttacking: boolean;
  attackProgress: number;

  attackCooldown: number;
  lastAttackTime: number;

  // Combat status
  isInvincible: boolean;

  // Long Tone state
  isLongToneActive: boolean;
  longToneCooldown: number; // Current timestamp when cooldown ends
  longToneDuration: number; // 3000ms
  longToneTotalCooldown: number; // 7500ms

  // Tempo Combo System
  tempo: number; // Current combo count
  tempoRating: string; // F to Z rating
  lastKillTime: number; // Timestamp of last kill
  lastMoveTime: number; // Timestamp of last movement (for anti-camping)

  // Inventory
  inventory: Inventory;

  // Actions
  attack: () => void;
  addXp: (amount: number) => void;
  stopAttack: () => void;
  takeDamage: (amount: number) => void;
  heal: (amount: number) => void;
  levelUp: () => void;
  resetPlayer: () => void;
  setPosition: (x: number, y: number, z: number) => void;
  loadState: (savedState: Omit<Partial<PlayerStats>, 'position'> & { position?: { x: number, y: number, z: number }, inventory?: Inventory }) => void;

  // Combat Actions
  triggerLongTone: () => void;
  collectEchoes: (amount: number) => void;
  respawn: () => void;
  registerKill: (enemyLevel: number) => void;
  updateMoveTime: () => void;

  // Inventory Actions
  addMaterial: (itemId: MaterialItemId, quantity: number) => void;
  addReed: (strength: ReedStrength, quantity: number) => void;
  removeMaterial: (itemId: MaterialItemId, quantity: number) => boolean;
  removeReed: (strength: ReedStrength, quantity: number) => boolean;
  craftRecipe: (recipeId: string) => boolean;
  equipReed: (strength: ReedStrength | null) => void;
  unequipReed: () => void;
  tickReedDurability: (deltaSeconds: number) => void;

  // Status Effects
  speedModifier: number; // Multiplier (1.0 = normal, 0.5 = half speed)
  applySlow: (percent: number, durationSeconds: number) => void;

  // Embouchure Actions
  addEmbouchureXp: (amount: number) => void;
}

// Initial stats per PRD spec for Bb Clarinet
// Initial stats
const initialLevel = 1;
const initialStats = getStatsForLevel(initialLevel);
const initialMaxXp = getXpRequiredForLevel(initialLevel);

const INITIAL_STATS: PlayerStats = {
  level: initialLevel,
  health: initialStats.health,
  maxHealth: initialStats.health,
  damage: initialStats.damage,
  basicAttackDamage: initialStats.damage,
  speed: 4.5,
  critChance: 0,
  defense: 0,
  xp: 0,
  maxXp: initialMaxXp,
  echoes: 0,
  equippedReed: null,
  reedDurability: 0,
  embouchure: 1,
  embouchureXp: 0,
  position: [0, 1.5, 0],
};

export const usePlayerStore = create<PlayerState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    ...INITIAL_STATS,
    // position is already in INITIAL_STATS now
    inventory: { ...INITIAL_INVENTORY },
    isAttacking: false,
    attackProgress: 0,

    attackCooldown: 0.5, // 500ms cooldown (visual only here, actual logic in component/controller usually)
    lastAttackTime: 0,

    isInvincible: false,

    isLongToneActive: false,
    longToneCooldown: 0,
    longToneDuration: 3000,
    longToneTotalCooldown: 7500,

    // Tempo Combo System
    tempo: 0,
    tempoRating: 'F',
    lastKillTime: 0,
    lastMoveTime: Date.now(),

    // Actions
    attack: () => {
      const now = Date.now();
      const state = get();
      if (state.isAttacking || now - state.lastAttackTime < state.attackCooldown * 1000) return;
      set({ isAttacking: true, attackProgress: 0, lastAttackTime: now });
    },

    setPosition: (x, y, z) => set({ position: [x, y, z] }),

    loadState: (saved) => set((state) => {
      // Hydrate stats
      const newStats = { ...state };
      if (saved.level) newStats.level = saved.level;
      if (saved.health) newStats.health = saved.health;
      if (saved.xp) newStats.xp = saved.xp;
      if (saved.echoes) newStats.echoes = saved.echoes;

      // Recalculate derived stats to be safe
      if (saved.level) {
        const derived = calculateStats(saved.level, newStats.equippedReed);
        newStats.maxHealth = derived.health;
        newStats.damage = derived.damage;
        newStats.basicAttackDamage = derived.basicAttackDamage;
        newStats.speed = derived.speed;
        newStats.critChance = derived.critChance;
        newStats.defense = derived.defense;
        newStats.maxXp = getXpRequiredForLevel(saved.level);
      }

      if (saved.reedDurability) newStats.reedDurability = saved.reedDurability;
      if (saved.embouchure) newStats.embouchure = saved.embouchure;
      if (saved.embouchureXp) newStats.embouchureXp = saved.embouchureXp;

      // If loading saved equipped reed, recalculate stats
      if (saved.equippedReed !== undefined) {
        newStats.equippedReed = saved.equippedReed;
        const derived = calculateStats(newStats.level, newStats.equippedReed);
        newStats.maxHealth = derived.health;
        newStats.damage = derived.damage;
        newStats.basicAttackDamage = derived.basicAttackDamage;
        newStats.speed = derived.speed;
        newStats.critChance = derived.critChance;
        newStats.defense = derived.defense;
      }

      if (saved.maxHealth) newStats.maxHealth = saved.maxHealth;
      // Restore position if available
      if (saved.position) newStats.position = [saved.position.x, saved.position.y, saved.position.z];

      // Restore inventory if available (Deep merge to ensure new categories like reeds exist)
      if (saved.inventory) {
        newStats.inventory = {
          materials: { ...INITIAL_INVENTORY.materials, ...saved.inventory.materials },
          reeds: { ...INITIAL_INVENTORY.reeds, ...(saved.inventory.reeds || {}) },
          accessories: { ...INITIAL_INVENTORY.accessories, ...(saved.inventory.accessories || {}) }
        };
      }

      // Sync echoes to inventory for display
      if (newStats.inventory) {
        newStats.inventory.materials = {
          ...newStats.inventory.materials,
          echoes: newStats.echoes
        };
      }

      return newStats;
    }),

    addXp: (amount) =>
      set((state) => {
        let { xp, maxXp, level, health, maxHealth, damage, basicAttackDamage, speed, critChance, defense } = state;
        xp += amount;

        // Level up logic
        if (xp >= maxXp) {
          xp -= maxXp;
          level += 1;

          // Recalculate stats for new level
          const newStats = calculateStats(level, state.equippedReed);
          const newMaxXp = getXpRequiredForLevel(level);

          // Heal to full on level up
          health = newStats.health;
          maxHealth = newStats.health;
          damage = newStats.damage;
          basicAttackDamage = newStats.basicAttackDamage;
          speed = newStats.speed;
          critChance = newStats.critChance;
          defense = newStats.defense;
          maxXp = newMaxXp;
        }

        return { xp, maxXp, level, health, maxHealth, damage, basicAttackDamage, speed, critChance, defense };
      }),

    stopAttack: () => {
      set({ isAttacking: false, attackProgress: 0 });
    },

    takeDamage: (amount) =>
      set((state) => {
        if (state.isInvincible) return {}; // No damage if invincible

        // Apply Defense
        const reducedAmount = Math.max(0, amount * (1.0 - state.defense));

        const newHealth = Math.max(0, state.health - reducedAmount);
        if (newHealth <= 0) {
          // Play death sound
          AudioManager.load(DEATH_SOUND_KEY, DEATH_SOUND_SRC);
          AudioManager.play(DEATH_SOUND_KEY, 'sfx', { volume: 0.5 });
          useGameStore.getState().setGameState('gameOver');
        }
        return { health: newHealth };
      }),

    heal: (amount) =>
      set((state) => ({
        health: Math.min(state.maxHealth, state.health + amount),
      })),

    levelUp: () =>
      set((state) => {
        const newLevel = state.level + 1;
        const newStats = calculateStats(newLevel, state.equippedReed);
        return {
          level: newLevel,
          maxHealth: newStats.health,
          health: newStats.health, // Full heal on level up
          damage: newStats.damage,
          speed: newStats.speed,
        };
      }),

    resetPlayer: () =>
      set({
        ...INITIAL_STATS,
        position: [0, 1.5, 0],
        inventory: { ...INITIAL_INVENTORY },
        health: INITIAL_STATS.maxHealth, // Ensure full health
        isAttacking: false,
        attackProgress: 0,
        lastAttackTime: 0,
        isInvincible: false,
        isLongToneActive: false,
        longToneCooldown: 0,
        equippedReed: null,
      }),

    triggerLongTone: () => {
      const now = Date.now();
      const state = get();
      if (now < state.longToneCooldown) return;

      set({
        isLongToneActive: true,
        longToneCooldown: now + state.longToneTotalCooldown
      });

      // Auto-deactivate after duration
      setTimeout(() => {
        set({ isLongToneActive: false });
      }, state.longToneDuration);
    },

    collectEchoes: (amount) => set((state) => ({
      echoes: state.echoes + amount,
      inventory: {
        ...state.inventory,
        materials: {
          ...state.inventory.materials,
          echoes: (state.inventory.materials.echoes || 0) + amount
        }
      }
    })),

    respawn: () => {
      set((state) => ({
        health: state.maxHealth,
        isAttacking: false,
        isLongToneActive: false,
        isInvincible: true, // Invincible on respawn
        position: [0, 1.5, 0], // Reset position to center for respawn
        speedModifier: 1.0, // Reset speed on respawn
        tempo: 0, // Reset tempo on death
        tempoRating: 'F',
        lastKillTime: 0,
      }));

      // Remove invincibility after 2s
      setTimeout(() => {
        set({ isInvincible: false });
      }, 2000);

      // Reset game state to playing if needed
      useGameStore.getState().setGameState('playing');
    },

    // === Tempo Combo System ===
    registerKill: (enemyLevel: number) => {
      const now = Date.now();
      const state = get();
      const COMBO_WINDOW = 7000; // 7 seconds

      let newTempo = state.tempo;

      // Check if within combo window
      if (state.lastKillTime > 0 && now - state.lastKillTime <= COMBO_WINDOW) {
        // Continuing combo - increment
        newTempo += 1;
      } else {
        // Combo broken or first kill - start fresh at 1
        newTempo = 1;
      }

      // Calculate Tempo Rating (F to Z based on tempo count)
      // F=0, D=1-2, C=3-5, B=6-10, A=11-20, S=21-40, SS=41-70, SSS=71-100, Z=101+
      let rating = 'F';
      if (newTempo >= 101) rating = 'Z';
      else if (newTempo >= 71) rating = 'SSS';
      else if (newTempo >= 41) rating = 'SS';
      else if (newTempo >= 21) rating = 'S';
      else if (newTempo >= 11) rating = 'A';
      else if (newTempo >= 6) rating = 'B';
      else if (newTempo >= 3) rating = 'C';
      else if (newTempo >= 1) rating = 'D';

      // Calculate XP bonus: +0.1x per 2 Tempo
      const bonusMultiplier = 1 + Math.floor(newTempo / 2) * 0.1;

      // Base XP scales with enemy level (1 + 0.2 per level above 1)
      const baseXp = 1 + (enemyLevel - 1) * 0.2;
      const finalXp = baseXp * bonusMultiplier;

      set({ tempo: newTempo, tempoRating: rating, lastKillTime: now });

      // Grant XP with bonus applied
      get().addXp(finalXp);
    },

    updateMoveTime: () => set({ lastMoveTime: Date.now() }),

    speedModifier: 1.0,

    applySlow: (percent, duration) => {
      // e.g. percent 20 = 0.8 modifier
      const modifier = Math.max(0.1, 1 - percent / 100);
      set({ speedModifier: modifier });

      // Reset after duration
      setTimeout(() => {
        set((state) => {
          // Only reset if it hasn't been overwritten by a stronger slow?
          // For MVP, just reset to 1.0. A real system would need a stack of effects.
          // Checking if current modifier matches what we set would be safer but simple is fine.
          return { speedModifier: 1.0 };
        });
      }, duration * 1000);
    },

    // Inventory Actions
    addMaterial: (itemId, quantity) => set((state) => ({
      inventory: {
        ...state.inventory,
        materials: {
          ...state.inventory.materials,
          [itemId]: state.inventory.materials[itemId] + quantity,
        },
      },
    })),

    addReed: (strength, quantity) => set((state) => ({
      inventory: {
        ...state.inventory,
        reeds: {
          ...state.inventory.reeds,
          [strength]: state.inventory.reeds[strength] + quantity,
        },
      },
    })),

    removeMaterial: (itemId, quantity) => {
      const state = get();
      const currentQty = state.inventory.materials[itemId];
      if (currentQty < quantity) return false;

      set({
        inventory: {
          ...state.inventory,
          materials: {
            ...state.inventory.materials,
            [itemId]: currentQty - quantity,
          },
        },
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
      });
      return true;
    },

    equipReed: (strength) => set((state) => {
      if (!strength) {
        // Null passed -> Unequip
        return {
          equippedReed: null,
          reedDurability: 0,
          // Recalc stats to base
          ...calculateStats(state.level, null)
        } as Partial<PlayerState>;
      }

      // Equip specific strength
      if (state.inventory.reeds[strength] <= 0) return {}; // Check ownership

      // Consume usage? Logic: Take from inventory, put on MP.
      // Decrement inventory
      const newReeds = { ...state.inventory.reeds };
      newReeds[strength] = Math.max(0, newReeds[strength] - 1);

      const newStats = calculateStats(state.level, strength);
      // Maintain HP percentage
      const hpRatio = state.maxHealth > 0 ? state.health / state.maxHealth : 1;
      const newHealth = Math.max(1, Math.floor(newStats.health * hpRatio));

      return {
        equippedReed: strength,
        reedDurability: 600, // 10 minutes
        inventory: {
          ...state.inventory,
          reeds: newReeds
        },
        maxHealth: newStats.health,
        health: newHealth,
        damage: newStats.damage,
        speed: newStats.speed,
        critChance: newStats.critChance,
        defense: newStats.defense
      };
    }),

    unequipReed: () => set((state) => {
      if (!state.equippedReed) return {};

      const newStats = calculateStats(state.level, null);
      const hpRatio = state.maxHealth > 0 ? state.health / state.maxHealth : 1;
      const newHealth = Math.max(1, Math.floor(newStats.health * hpRatio));

      return {
        equippedReed: null,
        reedDurability: 0,
        maxHealth: newStats.health,
        health: newHealth,
        damage: newStats.damage,
        speed: newStats.speed,
        critChance: newStats.critChance,
        defense: newStats.defense
      };
    }),

    tickReedDurability: (dt) => set((state) => {
      if (!state.equippedReed || state.reedDurability <= 0) return {};

      const newDurability = state.reedDurability - dt;
      if (newDurability <= 0) {
        // Break!
        // Automatically unequip
        const newStats = calculateStats(state.level, null);
        const hpRatio = state.maxHealth > 0 ? state.health / state.maxHealth : 1;
        const newHealth = Math.max(1, Math.floor(newStats.health * hpRatio));

        // TODO: Ideally notify user via toast/message here?
        // Store has no UI access. UI subscribes to store.

        return {
          equippedReed: null,
          reedDurability: 0,
          maxHealth: newStats.health,
          health: newHealth,
          damage: newStats.damage,
          speed: newStats.speed,
          critChance: newStats.critChance,
          defense: newStats.defense
        };
      }

      return { reedDurability: newDurability };
    }),

    addEmbouchureXp: (amount) => set((state) => {
      if (state.embouchure >= 10) return {}; // Max level

      let { embouchure, embouchureXp } = state;
      embouchureXp += amount;

      // Exponential scaling for Embouchure
      // Level 1->2: 100
      // Level 2->3: 200
      // ...
      const xpRequired = embouchure * 100;

      if (embouchureXp >= xpRequired) {
        embouchureXp -= xpRequired;
        embouchure += 1;
        // Cap at 10
        if (embouchure > 10) {
          embouchure = 10;
          embouchureXp = 0;
        }
      }

      return { embouchure, embouchureXp };
    }),

    craftRecipe: (recipeId) => {
      const state = get();
      const recipe = ALL_RECIPES.find(r => r.id === recipeId);
      if (!recipe) return false;

      // Check ingredients
      const inventory = state.inventory;
      for (const ing of recipe.ingredients) {
        // Determine type
        let currentQty = 0;
        // Check materials
        if (ing.itemId in inventory.materials) {
          currentQty = inventory.materials[ing.itemId as MaterialItemId] || 0;
        } else if (ing.itemId in inventory.reeds) {
          currentQty = inventory.reeds[ing.itemId as ReedStrength] || 0;
        } else if (ing.itemId === 'echoes') {
          // Echoes are special currency
          // Wait, echoes logic in store is `state.echoes` (currency) AND `state.inventory.materials.echoes`?
          // Wait, logic in Step 730 `collectEchoes`: "collects currency AND adds to inventory".
          // So we can check inventory.materials.echoes?
          // Or stick to `state.echoes` as spending currency?
          // The `inventory.materials.echoes` was for display.
          // Ideally I should spend from BOTH to keep them in sync.
          currentQty = state.echoes;
        }

        if (currentQty < ing.quantity) return false;
      }

      // Deduct ingredients
      set((state) => {
        const newMaterials = { ...state.inventory.materials };
        const newReeds = { ...state.inventory.reeds };
        let newEchoes = state.echoes;

        // First pass: Deduct
        for (const ing of recipe.ingredients) {
          if (ing.itemId === 'echoes') {
            newEchoes -= ing.quantity;
            // Also sync inventory display
            newMaterials.echoes = newEchoes;
          } else if (ing.itemId in newMaterials) {
            newMaterials[ing.itemId as MaterialItemId] -= ing.quantity;
          } else if (ing.itemId in newReeds) {
            newReeds[ing.itemId as ReedStrength] -= ing.quantity;
          }
        }

        // Second pass: Add output
        if (recipe.outputId in newReeds) {
          newReeds[recipe.outputId as ReedStrength] = (newReeds[recipe.outputId as ReedStrength] || 0) + recipe.outputQuantity;

          // Award XP for crafting reeds
          // Normalize strength to a number for scaling
          const strengthVal = parseFloat(recipe.outputId as string);
          if (!isNaN(strengthVal)) {
            // Base XP: 50 * Strength
            // 1.0 -> 50 XP
            // 2.5 -> 125 XP
            // 5.0 -> 250 XP
            const xpReward = Math.floor((strengthVal ** 2) * 10);
            get().addXp(xpReward);
          }

        } else if (recipe.outputId in newMaterials) {
          newMaterials[recipe.outputId as MaterialItemId] = (newMaterials[recipe.outputId as MaterialItemId] || 0) + recipe.outputQuantity;
        }

        return {
          echoes: newEchoes,
          inventory: {
            ...state.inventory,
            materials: newMaterials,
            reeds: newReeds
          }
        };
      });

      return true;
    },
  }))
);

export default usePlayerStore;
