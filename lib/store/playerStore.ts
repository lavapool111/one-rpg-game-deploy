"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useGameStore } from "./gameStore";
import { getStatsForLevel, getXpRequiredForLevel } from "../game/stats";
import { Inventory, INITIAL_INVENTORY, MaterialItemId, ReedStrength, REED_MULTIPLIERS, ALL_RECIPES, LigatureInstance, LigatureId, getLigatureStats, getLigatureData, LIGATURE_DATA, MouthpieceInstance, MouthpieceId, getMouthpieceStats, getMouthpieceData, getMouthpieceUpgradeCost } from "../game/inventory";
import AudioManager from "../audio/AudioManager";
import { GAME_CONFIG } from "../game/config";

const DEATH_SOUND_KEY = 'player-death';
const DEATH_SOUND_SRC = '/audio/cymbal-crash-412547 1.mp3';

// Stat Calculation with new Reed Stats
// Embouchure grants +2% crit chance per level past 1
function calculateStats(level: number, reed: ReedStrength | null, embouchure: number = 1) {
  const base = getStatsForLevel(level);
  const baseSpeed = 4.5;
  const embouchureCritBonus = (embouchure - 1) * 0.02; // 2% per level past 1

  if (!reed) {
    return {
      ...base,
      speed: baseSpeed,
      basicAttackDamage: base.damage,
      critChance: embouchureCritBonus,
      defense: 0
    };
  }

  const stats = REED_MULTIPLIERS[reed];

  return {
    health: base.health, // Reeds no longer scale HP
    damage: base.damage, // Reeds no longer scale Damage
    basicAttackDamage: base.damage,
    speed: Number((baseSpeed * stats.speed).toFixed(2)),
    critChance: stats.crit + embouchureCritBonus, // Reed crit + embouchure bonus
    defense: stats.def
  };
}

/**
 * Player Store
 * State management for the player character
 */

// Player Class Types
export type PlayerClass = 'bb_clarinet' | 'viola';

// Helper to get ability name based on class
export function getAbilityName(playerClass: PlayerClass): string {
  switch (playerClass) {
    case 'viola':
      return 'Sustained Bow';
    case 'bb_clarinet':
    default:
      return 'Long Tone';
  }
}

// Class display info
export const CLASS_INFO: Record<PlayerClass, { name: string; icon: string; description: string }> = {
  bb_clarinet: {
    name: 'Bb Clarinet',
    icon: '🎵',
    description: 'A versatile woodwind warrior. Master the Long Tone to devastate your brass enemies.'
  },
  viola: {
    name: 'Viola',
    icon: '🎻',
    description: 'A noble string fighter. Channel the Sustained Bow to unleash powerful attacks.'
  }
};

// Class-based terminology helper
export interface ClassTerms {
  embouchure: string;  // Embouchure (Clarinet) or Posture (Viola)
  reed: string;        // Reed (Clarinet) or String (Viola)
  reeds: string;       // Reeds (Clarinet) or Strings (Viola)
  reedStrength: string; // Reed Strength (Clarinet) or String Gauge (Viola)
  ligature: string;    // Ligature (Clarinet) or Bow (Viola)
  ligatures: string;   // Ligatures (Clarinet) or Bows (Viola)
}

export function getTerms(playerClass: PlayerClass): ClassTerms {
  if (playerClass === 'viola') {
    return {
      embouchure: 'Posture',
      reed: 'String',
      reeds: 'Strings',
      reedStrength: 'String Gauge',
      ligature: 'Bow',
      ligatures: 'Bows'
    };
  }
  // Default: Bb Clarinet
  return {
    embouchure: 'Embouchure',
    reed: 'Reed',
    reeds: 'Reeds',
    reedStrength: 'Reed Strength',
    ligature: 'Ligature',
    ligatures: 'Ligatures'
  };
}

/**
 * Transform item names based on player class
 * Replaces "Reed" with "String" and converts Ligature names to Bow names for Viola
 */
export function localizeItemName(name: string, playerClass: PlayerClass): string {
  if (playerClass === 'viola') {
    // First handle specific ligature-to-bow name mappings
    const bowNameMap: Record<string, string> = {
      'One-Screw Fabric Ligature': 'Student Practice Bow',
      'Two-Screw Fabric Ligature': 'Intermediate Bow',
      'One-Screw Metal Ligature': 'Professional Bow',
      'Two-Screw Metal Ligature': 'Master Performance Bow',
      'One-Screw Reinforced Metal Ligature': 'Concert Soloist Bow',
      'Two-Screw Reinforced Metal Ligature': 'Virtuoso Performance Bow'
    };

    // Check for exact ligature name match
    if (bowNameMap[name]) {
      return bowNameMap[name];
    }

    // Then do general replacements
    return name
      .replace(/\bReed\b/g, 'String')
      .replace(/\bReeds\b/g, 'Strings')
      .replace(/\bLigature\b/g, 'Bow')
      .replace(/\bLigatures\b/g, 'Bows');
  }
  return name;
}

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
  // Player Class
  playerClass: PlayerClass;
  // Ligature System
  equippedLigature: LigatureInstance | null;
  // Mouthpiece System
  equippedMouthpiece: MouthpieceInstance | null;
  critFactor: number; // Critical hit damage multiplier (base 1.5)
  accessorySlots: number; // 8 slots to start
  // Dungeon Upgrades
  dungeonTimeBonus: number; // Extra seconds for dungeon runs
  // Positioning
  position: [number, number, number];

  // Input State (Mobile)
  input: {
    joystick: { x: number, y: number };
    look: { x: number, y: number };
  };
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
  takeDamage: (amount: number, enemyType?: 'trumpet' | 'trombone' | 'tuba' | 'french_horn') => void;
  heal: (amount: number) => void;
  levelUp: () => void;
  resetPlayer: () => void;
  setPosition: (x: number, y: number, z: number) => void;
  loadState: (savedState: Omit<Partial<PlayerStats>, 'position'> & { position?: { x: number, y: number, z: number }, inventory?: Inventory }) => void;

  // Combat Actions
  triggerLongTone: () => void;
  collectEchoes: (amount: number) => void;
  respawn: () => void;
  registerKill: (enemyLevel: number, xpMultiplier?: number) => void;
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

  // Input Actions
  setInputJoystick: (x: number, y: number) => void;
  setInputLook: (x: number, y: number) => void;
  resetInputLook: () => void;

  // Status Effects
  speedModifier: number; // Multiplier (1.0 = normal, 0.5 = half speed)
  isStunned: boolean;
  applySlow: (percent: number, durationSeconds: number) => void;
  applyStun: (durationSeconds: number) => void;

  // Embouchure Actions
  addEmbouchureXp: (amount: number) => void;

  // Dungeon Upgrades
  getDungeonTimeLimit: () => number; // Returns base 20 + dungeonTimeBonus
  getNextDungeonUpgradeCost: () => { valves: number; heavyValves: number; timeIncrease: number };
  upgradeDungeonTime: () => boolean; // Returns true if successful

  // Ligature Actions
  equipLigature: (ligatureIndex: number) => void; // Equip ligature from inventory
  unequipLigature: () => void;
  craftLigature: (ligatureId: LigatureId) => boolean; // Craft base ligature at level 1
  upgradeLigature: (ligatureIndex: number) => boolean; // Upgrade ligature to next level
  getLigatureBonus: () => { longToneDurationMs: number; lowBrassDefense: number }; // Current ligature bonuses

  // Mouthpiece Actions
  equipMouthpiece: (mouthpieceIndex: number) => void;
  unequipMouthpiece: () => void;
  craftMouthpiece: (mouthpieceId: MouthpieceId) => boolean;
  upgradeMouthpiece: (mouthpieceIndex: number) => boolean;
  getMouthpieceBonus: () => { critFactor: number; critChance: number };

  // Class Selection
  setPlayerClass: (playerClass: PlayerClass) => void;
}

// Initial stats per PRD spec for Bb Clarinet
// Initial stats
const initialLevel = GAME_CONFIG.STARTING_LEVEL;
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
  echoes: GAME_CONFIG.STARTING_ECHOES,
  equippedReed: null,
  reedDurability: 0,
  embouchure: GAME_CONFIG.STARTING_EMBOUCHURE,
  embouchureXp: 0,
  playerClass: 'bb_clarinet', // Default to Bb Clarinet
  equippedLigature: null,
  equippedMouthpiece: null,
  critFactor: 1.5, // Base crit multiplier
  accessorySlots: 8, // 8 accessory slots to start
  dungeonTimeBonus: 0, // Upgraded via valves
  position: [0, 1.5, 0],
  input: {
    joystick: { x: 0, y: 0 },
    look: { x: 0, y: 0 },
  },
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
        const derived = calculateStats(saved.level, newStats.equippedReed, newStats.embouchure);
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
      if (saved.embouchureXp) newStats.embouchureXp = saved.embouchureXp;
      if (saved.dungeonTimeBonus !== undefined) {
        console.log('Loading dungeonTimeBonus:', saved.dungeonTimeBonus);
        newStats.dungeonTimeBonus = saved.dungeonTimeBonus;
      }

      // If loading saved equipped reed, recalculate stats
      if (saved.equippedReed !== undefined) {
        newStats.equippedReed = saved.equippedReed;
        const derived = calculateStats(newStats.level, newStats.equippedReed, newStats.embouchure);
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
          accessories: { ...INITIAL_INVENTORY.accessories, ...(saved.inventory.accessories || {}) },
          ligatures: saved.inventory.ligatures || [],
          mouthpieces: saved.inventory.mouthpieces || []
        };
      }

      // Sync echoes to inventory for display
      if (newStats.inventory) {
        newStats.inventory.materials = {
          ...newStats.inventory.materials,
          echoes: newStats.echoes
        };
      }

      // Restore equipped ligature if available
      if (saved.equippedLigature !== undefined) {
        newStats.equippedLigature = saved.equippedLigature;
      }

      // Restore equipped mouthpiece and critFactor if available
      if (saved.equippedMouthpiece !== undefined) {
        newStats.equippedMouthpiece = saved.equippedMouthpiece;
      }
      if (saved.critFactor !== undefined) {
        newStats.critFactor = saved.critFactor;
      }

      // Restore player class if available
      if (saved.playerClass) {
        newStats.playerClass = saved.playerClass;
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
          const newStats = calculateStats(level, state.equippedReed, state.embouchure);
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

    takeDamage: (amount, enemyType) =>
      set((state) => {
        if (state.isInvincible || GAME_CONFIG.INVINCIBLE) return {}; // No damage if invincible

        // Apply Defense
        let totalDefense = state.defense;

        // Apply ligature low brass defense for Tubas (and future Euphoniums)
        if (enemyType === 'tuba' && state.equippedLigature) {
          const ligatureBonus = getLigatureStats(state.equippedLigature.id, state.equippedLigature.level);
          totalDefense = Math.min(0.9, totalDefense + ligatureBonus.lowBrassDefense); // Cap at 90%
        }

        const reducedAmount = Math.max(0, amount * (1.0 - totalDefense));

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
        const newStats = calculateStats(newLevel, state.equippedReed, state.embouchure);
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

      // Calculate Long Tone duration with ligature bonus
      let duration = state.longToneDuration;
      if (state.equippedLigature) {
        const ligatureBonus = getLigatureStats(state.equippedLigature.id, state.equippedLigature.level);
        duration += ligatureBonus.longToneBonus * 1000; // Convert seconds to ms
      }

      set({
        isLongToneActive: true,
        longToneCooldown: now + state.longToneTotalCooldown
      });

      // Auto-deactivate after duration (with ligature bonus)
      setTimeout(() => {
        set({ isLongToneActive: false });
      }, duration);
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
    registerKill: (enemyLevel: number, xpMultiplier: number = 1) => {
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

      // Base XP scales with enemy level (0.25 per level + small exponential bonus for high levels)
      // Level 1: 1 XP, Level 10: 3.25 XP, Level 50: ~14.3 XP, Level 100: ~33 XP
      const linearXp = 1 + (enemyLevel - 1) * 0.25;
      const expBonus = Math.pow(1.01, enemyLevel / 5); // ~1% bonus per 5 levels
      const baseXp = linearXp * expBonus;
      // Apply enemy type multiplier (Trumpet=1, Trombone=1.5, Horn=2.5, Tuba=5)
      const finalXp = baseXp * bonusMultiplier * xpMultiplier;

      set({ tempo: newTempo, tempoRating: rating, lastKillTime: now });

      // Grant XP with bonus applied
      get().addXp(finalXp);
    },

    updateMoveTime: () => set({ lastMoveTime: Date.now() }),

    // Status Effects
    speedModifier: 1.0,

    isStunned: false,

    applyStun: (duration: number) => {
      // Stun overrides everything
      set({ isStunned: true, isAttacking: false, attackProgress: 0 });

      // Auto-remove stun
      setTimeout(() => {
        // Only remove if this specific stun is done?
        // Simple version: just set false. Overlapping stuns might bug out but it's MVP.
        set({ isStunned: false });
      }, duration * 1000);
    },

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
          ...calculateStats(state.level, null, state.embouchure)
        } as Partial<PlayerState>;
      }

      // Equip specific strength
      if (state.inventory.reeds[strength] <= 0) return {}; // Check ownership

      // Consume usage? Logic: Take from inventory, put on MP.
      // Decrement inventory
      const newReeds = { ...state.inventory.reeds };
      newReeds[strength] = Math.max(0, newReeds[strength] - 1);

      const newStats = calculateStats(state.level, strength, state.embouchure);
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

      const newStats = calculateStats(state.level, null, state.embouchure);
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
        const newStats = calculateStats(state.level, null, state.embouchure);
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

      let newCritChance = state.critChance;
      if (embouchureXp >= xpRequired) {
        embouchureXp -= xpRequired;
        embouchure += 1;
        // Cap at 10
        if (embouchure > 10) {
          embouchure = 10;
          embouchureXp = 0;
        }
        // Recalculate crit chance with new embouchure level
        const newStats = calculateStats(state.level, state.equippedReed, embouchure);
        newCritChance = newStats.critChance;
      }

      return { embouchure, embouchureXp, critChance: newCritChance };
    }),

    // Input Actions
    setInputJoystick: (x, y) => set((state) => ({
      input: { ...state.input, joystick: { x, y } }
    })),

    setInputLook: (x, y) => set((state) => ({
      input: {
        ...state.input,
        look: {
          x: state.input.look.x + x,
          y: state.input.look.y + y
        }
      }
    })),

    resetInputLook: () => set((state) => ({
      input: { ...state.input, look: { x: 0, y: 0 } }
    })),

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

    // ============= DUNGEON UPGRADES =============

    // Get the current dungeon time limit (base 20 + bonus)
    getDungeonTimeLimit: () => {
      return GAME_CONFIG.BASE_DUNGEON_TIME + get().dungeonTimeBonus;
    },

    // Calculate the cost for the next dungeon time upgrade
    getNextDungeonUpgradeCost: () => {
      const currentBonus = get().dungeonTimeBonus;
      const currentTotal = 20 + currentBonus;

      // Calculate which upgrade level we're at (0 = no upgrades yet)
      // Each upgrade adds 11 seconds until 108, then 12 seconds
      let level = 0;
      let total = 20;
      while (total < currentTotal) {
        level++;
        total += (total < 108) ? 11 : 12;
      }

      // Cost formula: valves = 10 + (level * 5), heavyValves = level + 1
      const valves = 10 + (level * 5);
      const heavyValves = level + 1;

      // Next upgrade gives 11 seconds if current total < 97, else 12
      const timeIncrease = currentTotal < 97 ? 11 : 12;

      return { valves, heavyValves, timeIncrease };
    },

    // Upgrade dungeon time - returns true if successful
    upgradeDungeonTime: () => {
      const state = get();
      const cost = state.getNextDungeonUpgradeCost();

      // Check if player has enough materials
      const valves = state.inventory.materials.valves || 0;
      const heavyValves = state.inventory.materials.heavy_valves || 0;

      if (valves < cost.valves || heavyValves < cost.heavyValves) {
        console.log('Not enough materials for dungeon time upgrade');
        return false;
      }

      // Deduct materials and add bonus time
      set((state) => ({
        dungeonTimeBonus: state.dungeonTimeBonus + cost.timeIncrease,
        inventory: {
          ...state.inventory,
          materials: {
            ...state.inventory.materials,
            valves: state.inventory.materials.valves - cost.valves,
            heavy_valves: state.inventory.materials.heavy_valves - cost.heavyValves,
          }
        }
      }));

      console.log(`Upgraded dungeon time! New limit: ${get().getDungeonTimeLimit()} seconds`);
      return true;
    },

    // === LIGATURE SYSTEM ===

    // Get current ligature bonuses (for UI display)
    getLigatureBonus: () => {
      const state = get();
      if (!state.equippedLigature) {
        return { longToneDurationMs: 0, lowBrassDefense: 0 };
      }
      const stats = getLigatureStats(state.equippedLigature.id, state.equippedLigature.level);
      return {
        longToneDurationMs: stats.longToneBonus * 1000,
        lowBrassDefense: stats.lowBrassDefense
      };
    },

    // Equip a ligature from inventory by index
    equipLigature: (ligatureIndex) => {
      const state = get();
      const ligature = state.inventory.ligatures[ligatureIndex];
      if (!ligature) {
        console.log('No ligature at index', ligatureIndex);
        return;
      }
      set({ equippedLigature: ligature });
      console.log(`Equipped ${getLigatureData(ligature.id).name} (Level ${ligature.level})`);
    },

    // Unequip current ligature
    unequipLigature: () => {
      set({ equippedLigature: null });
      console.log('Unequipped ligature');
    },

    // Craft a new ligature at level 1
    craftLigature: (ligatureId) => {
      const state = get();
      const ligatureData = getLigatureData(ligatureId);
      if (!ligatureData) return false;

      // Find the crafting recipe
      const recipe = ALL_RECIPES.find(r => r.id === `ligature_${ligatureId}_craft`);
      if (!recipe) return false;

      // Check if we have enough materials
      for (const ing of recipe.ingredients) {
        const materialId = ing.itemId as MaterialItemId;
        const have = state.inventory.materials[materialId] || 0;
        if (have < ing.quantity) {
          console.log(`Not enough ${materialId}: have ${have}, need ${ing.quantity}`);
          return false;
        }
      }

      // Deduct materials
      const newMaterials = { ...state.inventory.materials };
      for (const ing of recipe.ingredients) {
        const materialId = ing.itemId as MaterialItemId;
        newMaterials[materialId] = (newMaterials[materialId] || 0) - ing.quantity;
      }

      // Add ligature to inventory
      const newLigature: LigatureInstance = { id: ligatureId, level: 1 };
      const newLigatures = [...state.inventory.ligatures, newLigature];

      set({
        inventory: {
          ...state.inventory,
          materials: newMaterials,
          ligatures: newLigatures
        }
      });

      console.log(`Crafted ${ligatureData.name} at Level 1!`);
      return true;
    },

    // Upgrade an existing ligature to the next level
    upgradeLigature: (ligatureIndex) => {
      const state = get();
      const ligature = state.inventory.ligatures[ligatureIndex];
      if (!ligature) {
        console.log('No ligature at index', ligatureIndex);
        return false;
      }

      // Check if already max level
      if (ligature.level >= 10) {
        console.log('Ligature already at max level (10)');
        return false;
      }

      const nextLevel = ligature.level + 1;
      const ligatureData = getLigatureData(ligature.id);

      // Find upgrade recipe for the next level
      const recipe = ALL_RECIPES.find(r => r.id === `ligature_${ligature.id}_upgrade_${nextLevel}`);
      if (!recipe) {
        console.log('No upgrade recipe found for level', nextLevel);
        return false;
      }

      // Check if we have enough materials
      for (const ing of recipe.ingredients) {
        const materialId = ing.itemId as MaterialItemId;
        const have = state.inventory.materials[materialId] || 0;
        if (have < ing.quantity) {
          console.log(`Not enough ${materialId}: have ${have}, need ${ing.quantity}`);
          return false;
        }
      }

      // Deduct materials
      const newMaterials = { ...state.inventory.materials };
      for (const ing of recipe.ingredients) {
        const materialId = ing.itemId as MaterialItemId;
        newMaterials[materialId] = (newMaterials[materialId] || 0) - ing.quantity;
      }

      // Update ligature level
      const newLigatures = [...state.inventory.ligatures];
      newLigatures[ligatureIndex] = { ...ligature, level: nextLevel };

      // If this was the equipped ligature, update that too
      let newEquipped = state.equippedLigature;
      if (newEquipped && newEquipped.id === ligature.id && newEquipped.level === ligature.level) {
        newEquipped = { ...newEquipped, level: nextLevel };
      }

      set({
        equippedLigature: newEquipped,
        inventory: {
          ...state.inventory,
          materials: newMaterials,
          ligatures: newLigatures
        }
      });

      console.log(`Upgraded ${ligatureData.name} to Level ${nextLevel}!`);
      return true;
    },

    // === MOUTHPIECE ACTIONS ===
    equipMouthpiece: (mouthpieceIndex: number) => {
      const state = get();
      const mouthpiece = state.inventory.mouthpieces[mouthpieceIndex];
      if (!mouthpiece) return;

      // Calculate new crit stats with mouthpiece equipped
      const mouthpieceBonus = getMouthpieceStats(mouthpiece.id, mouthpiece.level);
      const baseStats = calculateStats(state.level, state.equippedReed, state.embouchure);

      set({
        equippedMouthpiece: mouthpiece,
        critFactor: 1.5 + mouthpieceBonus.critFactor,
        critChance: baseStats.critChance + mouthpieceBonus.critChance
      });
    },

    unequipMouthpiece: () => {
      const state = get();
      const baseStats = calculateStats(state.level, state.equippedReed, state.embouchure);
      set({
        equippedMouthpiece: null,
        critFactor: 1.5, // Reset to base
        critChance: baseStats.critChance // Reset to base (without mouthpiece bonus)
      });
    },

    craftMouthpiece: (mouthpieceId: MouthpieceId) => {
      const state = get();
      const mouthpieceData = getMouthpieceData(mouthpieceId);

      // Check if we have enough materials
      for (const ing of mouthpieceData.recipe) {
        const materialId = ing.itemId as MaterialItemId;
        const have = state.inventory.materials[materialId] || 0;
        if (have < ing.quantity) {
          console.log(`Not enough ${materialId}: have ${have}, need ${ing.quantity}`);
          return false;
        }
      }

      // Deduct materials
      const newMaterials = { ...state.inventory.materials };
      for (const ing of mouthpieceData.recipe) {
        const materialId = ing.itemId as MaterialItemId;
        newMaterials[materialId] = (newMaterials[materialId] || 0) - ing.quantity;
      }

      // Add new mouthpiece at level 1
      const newMouthpieces = [...state.inventory.mouthpieces, { id: mouthpieceId, level: 1 }];

      set({
        inventory: {
          ...state.inventory,
          materials: newMaterials,
          mouthpieces: newMouthpieces
        }
      });

      console.log(`Crafted ${mouthpieceData.name} at Level 1!`);
      return true;
    },

    upgradeMouthpiece: (mouthpieceIndex: number) => {
      const state = get();
      const mouthpiece = state.inventory.mouthpieces[mouthpieceIndex];
      if (!mouthpiece) return false;

      const nextLevel = mouthpiece.level + 1;
      if (nextLevel > 10) {
        console.log('Mouthpiece is already max level');
        return false;
      }

      // Get upgrade cost (level * base cost)
      const upgradeCost = getMouthpieceUpgradeCost(mouthpiece.id, mouthpiece.level);

      // Check if we have enough materials
      for (const ing of upgradeCost) {
        const materialId = ing.itemId as MaterialItemId;
        const have = state.inventory.materials[materialId] || 0;
        if (have < ing.quantity) {
          console.log(`Not enough ${materialId}: have ${have}, need ${ing.quantity}`);
          return false;
        }
      }

      // Deduct materials
      const newMaterials = { ...state.inventory.materials };
      for (const ing of upgradeCost) {
        const materialId = ing.itemId as MaterialItemId;
        newMaterials[materialId] = (newMaterials[materialId] || 0) - ing.quantity;
      }

      // Update mouthpiece level
      const newMouthpieces = [...state.inventory.mouthpieces];
      newMouthpieces[mouthpieceIndex] = { ...mouthpiece, level: nextLevel };

      // If this was the equipped mouthpiece, update stats
      let newEquipped = state.equippedMouthpiece;
      let newCritFactor = state.critFactor;
      let newCritChance = state.critChance;

      if (newEquipped && newEquipped.id === mouthpiece.id && newEquipped.level === mouthpiece.level) {
        newEquipped = { ...newEquipped, level: nextLevel };
        const mouthpieceBonus = getMouthpieceStats(newEquipped.id, nextLevel);
        const baseStats = calculateStats(state.level, state.equippedReed, state.embouchure);
        newCritFactor = 1.5 + mouthpieceBonus.critFactor;
        newCritChance = baseStats.critChance + mouthpieceBonus.critChance;
      }

      set({
        equippedMouthpiece: newEquipped,
        critFactor: newCritFactor,
        critChance: newCritChance,
        inventory: {
          ...state.inventory,
          materials: newMaterials,
          mouthpieces: newMouthpieces
        }
      });

      const mouthpieceData = getMouthpieceData(mouthpiece.id);
      console.log(`Upgraded ${mouthpieceData.name} to Level ${nextLevel}!`);
      return true;
    },

    getMouthpieceBonus: () => {
      const state = get();
      if (!state.equippedMouthpiece) {
        return { critFactor: 0, critChance: 0 };
      }
      return getMouthpieceStats(state.equippedMouthpiece.id, state.equippedMouthpiece.level);
    },

    // === CLASS SELECTION ===
    setPlayerClass: (playerClass) => {
      set({ playerClass });
      console.log(`Player class set to: ${playerClass}`);
    },
  }))
);

export default usePlayerStore;
