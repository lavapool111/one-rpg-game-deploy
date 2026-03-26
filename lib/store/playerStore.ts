"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useGameStore } from "./gameStore";
import { getStatsForLevel, getXpRequiredForLevel } from "../game/stats";
import {
  Inventory,
  getInitialInventory,
  MaterialItemId,
  ReedStrength,
  LigatureInstance,
  MouthpieceInstance,
  CaseInstance,
  EnchantmentInstance,
  EnchantmentTier,
  getMouthpieceStats,
  MeldStatBonus,
} from "../game/inventory";
import { AbilityUpgrades, AbilityUpgradePath, calculateAbilityUpgradeStats, ABILITY_UPGRADES_UNLOCK_LEVEL, ABILITY_UPGRADES_TIER_1, ABILITY_UPGRADES_TIER_2, ABILITY_UPGRADES_TIER_2_UNLOCK_LEVEL } from "../game/abilityUpgrades";
import AudioManager from "../audio/AudioManager";
import { GAME_CONFIG } from "../game/config";

// Re-export shared helpers from accessoryStore so existing imports still work
export { SLOT_BONUSES, getSlotMultiplier, calculateStats } from "./accessoryStore";

const DEATH_SOUND_KEY = 'player-death';
const DEATH_SOUND_SRC = '/audio/cymbal-crash-412547%201.mp3';

/**
 * Player Store
 * Core player state: stats, combat, class, abilities, position, movement.
 * Equipment/accessories are in accessoryStore.
 * Inventory/materials are in inventoryStore.
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
  embouchure: string;
  reed: string;
  reeds: string;
  reedStrength: string;
  ligature: string;
  ligatures: string;
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
 */
export function localizeItemName(name: string, playerClass: PlayerClass): string {
  if (playerClass === 'viola') {
    const bowNameMap: Record<string, string> = {
      'One-Screw Fabric Ligature': 'Student Practice Bow',
      'Two-Screw Fabric Ligature': 'Intermediate Bow',
      'One-Screw Metal Ligature': 'Professional Bow',
      'Two-Screw Metal Ligature': 'Master Performance Bow',
      'One-Screw Reinforced Metal Ligature': 'Concert Soloist Bow',
      'Two-Screw Reinforced Metal Ligature': 'Virtuoso Performance Bow'
    };
    if (bowNameMap[name]) return bowNameMap[name];
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
  critChance: number;
  superCritChance: number;
  defense: number;
  impact: number;
  xp: number;
  maxXp: number;
  echoes: number;
  embouchure: number;
  embouchureXp: number;
  playerClass: PlayerClass;
  dungeonTimeBonus: number;
  position: [number, number, number];
  input: {
    joystick: { x: number, y: number };
    look: { x: number, y: number };
  };
  sessionId: string;
  playerName: string;
  isLoading: boolean;
  version: number;
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
  longToneCooldown: number;
  longToneDuration: number;
  longToneTotalCooldown: number;

  // Ability Upgrades
  abilityUpgrades: AbilityUpgrades;

  // Overtone state
  isOvertoneActive: boolean;
  overtoneCooldown: number;
  overtoneDuration: number;
  overtoneTotalCooldown: number;
  lastOvertoneCastTime: number;

  // Tempo Combo System
  tempo: number;
  rating: string;
  lastKillTime: number;
  lastMoveTime: number;

  // Status Effects
  speedModifier: number;
  isStunned: boolean;

  // Performance caches
  _cachedAbilityStats: ReturnType<typeof calculateAbilityUpgradeStats> | null;

  // Actions
  attack: () => void;
  addXp: (amount: number) => void;
  stopAttack: () => void;
  takeDamage: (amount: number, enemyType?: 'trumpet' | 'trombone' | 'tuba' | 'french_horn' | 'euphonium') => void;
  heal: (amount: number) => void;
  levelUp: () => void;
  resetPlayer: () => void;
  setPosition: (x: number, y: number, z: number) => void;
  loadState: (savedState: any) => void;

  // Combat Actions
  triggerLongTone: () => void;
  triggerOvertone: () => void;
  collectEchoes: (amount: number) => void;
  respawn: () => void;
  registerKill: (enemyLevel: number, xpMultiplier?: number) => void;
  updateMoveTime: () => void;

  // Input Actions
  setInputJoystick: (x: number, y: number) => void;
  setInputLook: (x: number, y: number) => void;
  resetInputLook: () => void;

  // Status Effects
  applySlow: (percent: number, durationSeconds: number) => void;
  applyStun: (durationSeconds: number) => void;

  // Class Selection
  setPlayerClass: (playerClass: PlayerClass) => void;
  setPlayerName: (name: string) => void;

  // Ability Upgrade Actions
  purchaseAbilityUpgrade: (path?: AbilityUpgradePath) => boolean;
  getAbilityUpgradeStats: () => ReturnType<typeof calculateAbilityUpgradeStats>;
  isAbilityUpgradesUnlocked: () => boolean;
  _invalidateBonusCaches: () => void;
}

// Lazy import helpers to avoid circular dependencies
function getAccessoryStore() {
  return require('./accessoryStore').useAccessoryStore;
}

function getInventoryStore() {
  return require('./inventoryStore').useInventoryStore;
}

function applyAutoBuild() {
  const invStore = getInventoryStore();
  const accStore = getAccessoryStore().getState();
  const playerStore = usePlayerStore.getState();

  // 1. Give 100x Strength 5 Reeds
  invStore.getState().addReed('5.0', 100);

  // Define instances
  const ligature: LigatureInstance = { id: 'one_screw_reinforced_metal', level: 200 };
  const mouthpiece: MouthpieceInstance = { id: 'plastic', level: 1000 };
  const caseItem: CaseInstance = { id: 'fabric_case', level: 200, meldType: 'plated', meldTier: 5 };

  // 2-4. Add items to inventory correctly via setState
  invStore.setState((state: any) => ({
    inventory: {
      ...state.inventory,
      ligatures: [...state.inventory.ligatures, ligature],
      mouthpieces: [...state.inventory.mouthpieces, mouthpiece],
      cases: [...state.inventory.cases, caseItem],
    }
  }));

  const finalInv = invStore.getState().inventory;
  const ligIndex = finalInv.ligatures.length - 1;
  const mpIndex = finalInv.mouthpieces.length - 1;
  const caseIndex = finalInv.cases.length - 1;

  // 5. Set Slots and Equip
  accStore.setReedSlot(0);
  accStore.equipReed('5.0');

  accStore.setLigatureSlot(1);
  accStore.equipLigature(ligIndex);

  accStore.setMouthpieceSlot(2);
  accStore.equipMouthpiece(mpIndex);

  accStore.setCaseSlot(3);
  accStore.equipCase(caseIndex);

  console.log("Auto-build complete: Equipped high-level gear (Reeds 5.0, Ligature Lvl 20, Mouthpiece Lvl 20, Case Lvl 30).");
}

// Initial stats
function getInitialStats(): PlayerStats {
  const initialLevel = GAME_CONFIG.STARTING_LEVEL;
  const initialStats = getStatsForLevel(initialLevel);
  const initialMaxXp = getXpRequiredForLevel(initialLevel);

  return {
    level: initialLevel,
    health: initialStats.health,
    maxHealth: initialStats.health,
    damage: initialStats.damage,
    basicAttackDamage: initialStats.damage,
    speed: GAME_CONFIG.STARTING_SPEED,
    critChance: 0,
    superCritChance: 0,
    defense: 0,
    impact: 0,
    xp: 0,
    maxXp: initialMaxXp,
    echoes: GAME_CONFIG.STARTING_ECHOES,
    embouchure: GAME_CONFIG.STARTING_EMBOUCHURE,
    embouchureXp: 0,
    playerClass: 'bb_clarinet',
    dungeonTimeBonus: 0,
    position: [0, 1.5, 0],
    input: {
      joystick: { x: 0, y: 0 },
      look: { x: 0, y: 0 },
    },
    sessionId: Math.random().toString(36).substring(2, 15),
    playerName: '',
    isLoading: false,
    version: 0,
  };
}

export const usePlayerStore = create<PlayerState>()(
  subscribeWithSelector((set, get) => ({
    ...getInitialStats(),
    isAttacking: false,
    attackProgress: 0,
    attackCooldown: 0.5,
    lastAttackTime: 0,
    isInvincible: false,
    isLongToneActive: false,
    longToneCooldown: 0,
    longToneDuration: 3000,
    longToneTotalCooldown: 7500,
    abilityUpgrades: { chosenPath: null, currentLevel: 0, unlocked: false },
    isOvertoneActive: false,
    overtoneCooldown: 0,
    overtoneDuration: 2000,
    overtoneTotalCooldown: 15000,
    lastOvertoneCastTime: 0,
    tempo: 0,
    rating: 'F',
    lastKillTime: 0,
    lastMoveTime: Date.now(),
    speedModifier: 1.0,
    isStunned: false,
    _cachedAbilityStats: null,

    _invalidateBonusCaches: () => set({ _cachedAbilityStats: null }),

    // ========== CORE ACTIONS ==========

    attack: () => {
      const now = Date.now();
      const state = get();
      if (state.isAttacking || now - state.lastAttackTime < state.attackCooldown * 1000) return;
      set({ isAttacking: true, attackProgress: 0, lastAttackTime: now });
      getAccessoryStore().getState().incrementAttackCounter();
    },

    setPosition: (x, y, z) => set({ position: [x, y, z] }),

    loadState: (saved) => set((state) => {
      const newStats = { ...state };
      if (saved.level) newStats.level = saved.level;
      if (saved.health) newStats.health = saved.health;
      if (saved.xp) newStats.xp = saved.xp;
      if (saved.echoes) newStats.echoes = saved.echoes;

      if (saved.level) {
        const { calculateStats, getSlotMultiplier } = require('./accessoryStore');
        const accStore = getAccessoryStore().getState();
        const caseBonuses = accStore.getCaseBonus ? { healthMultiplier: accStore.getCaseBonus().healthMultiplier, speedBonus: accStore.getCaseBonus().speedBonus } : { healthMultiplier: 1, speedBonus: 0 };
        const derived = calculateStats(saved.level, accStore.equippedReed, newStats.embouchure, getSlotMultiplier(accStore.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedBonus);
        newStats.maxHealth = derived.health;
        newStats.damage = derived.damage;
        newStats.basicAttackDamage = derived.basicAttackDamage;
        newStats.speed = derived.speed;
        newStats.critChance = derived.critChance;
        newStats.superCritChance = (derived as any).superCritChance || 0;
        newStats.defense = derived.defense;
        newStats.maxXp = getXpRequiredForLevel(saved.level);
      }

      if (saved.reedDurability) getAccessoryStore().setState({ reedDurability: saved.reedDurability });
      if (saved.embouchure) newStats.embouchure = saved.embouchure;
      if (saved.embouchureXp) newStats.embouchureXp = saved.embouchureXp;
      if (saved.dungeonTimeBonus !== undefined) {
        newStats.dungeonTimeBonus = saved.dungeonTimeBonus;
        getAccessoryStore().setState({ dungeonTimeBonus: saved.dungeonTimeBonus });
      }

      if (saved.equippedReed !== undefined) {
        getAccessoryStore().setState({ equippedReed: saved.equippedReed });
        const { calculateStats, getSlotMultiplier } = require('./accessoryStore');
        const accStore = getAccessoryStore().getState();
        const caseBonuses = accStore.getCaseBonus ? { healthMultiplier: accStore.getCaseBonus().healthMultiplier, speedBonus: accStore.getCaseBonus().speedBonus } : { healthMultiplier: 1, speedBonus: 0 };
        const derived = calculateStats(newStats.level, saved.equippedReed, newStats.embouchure, getSlotMultiplier(accStore.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedBonus);
        newStats.maxHealth = derived.health;
        newStats.damage = derived.damage;
        newStats.basicAttackDamage = derived.basicAttackDamage;
        newStats.speed = derived.speed;
        newStats.critChance = derived.critChance;
        newStats.superCritChance = (derived as any).superCritChance || 0;
        newStats.defense = derived.defense;
      }

      if (saved.maxHealth) newStats.maxHealth = saved.maxHealth;
      if (saved.position) newStats.position = [saved.position.x, saved.position.y, saved.position.z];

      // Restore inventory
      if (saved.inventory) {
        const invStore = getInventoryStore();
        invStore.setState({
          inventory: {
            materials: { ...getInitialInventory().materials, ...saved.inventory.materials },
            reeds: { ...getInitialInventory().reeds, ...(saved.inventory.reeds || {}) },
            accessories: { ...getInitialInventory().accessories, ...(saved.inventory.accessories || {}) },
            ligatures: saved.inventory.ligatures || [],
            mouthpieces: saved.inventory.mouthpieces || [],
            cases: saved.inventory.cases || [],
            enchantments: saved.inventory.enchantments || [],
          },
          echoes: newStats.echoes,
        });
      }

      // Restore accessory state
      const accUpdates: any = {};
      if (saved.equippedLigature !== undefined) accUpdates.equippedLigature = saved.equippedLigature;
      if (saved.equippedMouthpiece !== undefined) accUpdates.equippedMouthpiece = saved.equippedMouthpiece;
      if (saved.critFactor !== undefined) accUpdates.critFactor = saved.critFactor;
      if (saved.equippedCase !== undefined) accUpdates.equippedCase = saved.equippedCase;
      if (saved.ligatureSlot !== undefined) accUpdates.ligatureSlot = saved.ligatureSlot;
      if (saved.mouthpieceSlot !== undefined) accUpdates.mouthpieceSlot = saved.mouthpieceSlot;
      if (saved.caseSlot !== undefined) accUpdates.caseSlot = saved.caseSlot;
      if (saved.reedSlot !== undefined) accUpdates.reedSlot = saved.reedSlot;
      if (saved.equippedEnchantments !== undefined) accUpdates.equippedEnchantments = saved.equippedEnchantments;
      if (saved.enchantmentSlots !== undefined) accUpdates.enchantmentSlots = saved.enchantmentSlots;
      if (saved.attackCounter !== undefined) accUpdates.attackCounter = saved.attackCounter;
      if (saved.hasEmpoweringSpeedBonus !== undefined) accUpdates.hasEmpoweringSpeedBonus = saved.hasEmpoweringSpeedBonus;
      if (saved.accessorySlots !== undefined) accUpdates.accessorySlots = saved.accessorySlots;
      if (Object.keys(accUpdates).length > 0) getAccessoryStore().setState(accUpdates);

      if (saved.currentAltarIndex !== undefined) {
        const { useGameStore } = require('./gameStore');
        useGameStore.getState().setAltarIndex(saved.currentAltarIndex);
      }

      if (saved.playerClass) newStats.playerClass = saved.playerClass;
      if (saved.playerName) newStats.playerName = saved.playerName;
      if (saved.abilityUpgrades) (newStats as any).abilityUpgrades = saved.abilityUpgrades;

      // Preserve current sessionId if we are loading into the same tab
      // But allow overriding if the save has one (though we usually want to keep our tab identity)
      newStats.sessionId = get().sessionId;
      newStats.isLoading = true; // Mark as loading while we do async recalculations

      // Fallback stat recalculation
      setTimeout(() => {
        const currentState = get();
        const { calculateStats, getSlotMultiplier } = require('./accessoryStore');
        const accStore = getAccessoryStore().getState();
        const caseBonuses = accStore.getCaseBonus ? { healthMultiplier: accStore.getCaseBonus().healthMultiplier, speedBonus: accStore.getCaseBonus().speedBonus } : { healthMultiplier: 1, speedBonus: 0 };
        const finalStats = calculateStats(currentState.level, accStore.equippedReed, currentState.embouchure, getSlotMultiplier(accStore.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedBonus);

        let mpCritBonus = 0;
        if (accStore.equippedMouthpiece) {
          const mpStats = getMouthpieceStats(accStore.equippedMouthpiece.id, accStore.equippedMouthpiece.level);
          mpCritBonus = mpStats.critChance * getSlotMultiplier(accStore.mouthpieceSlot);
        }

        let finalCritFactor = 1.5;
        if (accStore.equippedMouthpiece) {
          const mpStats = getMouthpieceStats(accStore.equippedMouthpiece.id, accStore.equippedMouthpiece.level);
          finalCritFactor = 1.5 + (mpStats.critFactor * getSlotMultiplier(accStore.mouthpieceSlot));
        }

        set((s) => ({
          maxHealth: finalStats.health,
          speed: finalStats.speed,
          critChance: finalStats.critChance + mpCritBonus,
          superCritChance: ((finalStats.critChance + mpCritBonus) > 1.0) ? ((finalStats.critChance + mpCritBonus) - 1.0) / 10 : 0,
          defense: finalStats.defense,
          health: Math.min(s.health, finalStats.health),
          isLoading: false, // Done loading!
        }));
        getAccessoryStore().setState({ critFactor: finalCritFactor });
      }, 300); // Slightly longer delay to ensure all stores are ready

      return {
        ...newStats,
        _cachedAbilityStats: null,
      };
    }),

    addXp: (amount) =>
      set((state) => {
        const { calculateStats, getSlotMultiplier } = require('./accessoryStore');
        let { xp, maxXp, level, health, maxHealth, damage, basicAttackDamage, speed, critChance, superCritChance, defense } = state;
        xp += amount;

        if (xp >= maxXp) {
          xp -= maxXp;
          level += 1;
          const accStore = getAccessoryStore().getState();
          const caseBonuses = accStore.getCaseBonus ? { healthMultiplier: accStore.getCaseBonus().healthMultiplier, speedBonus: accStore.getCaseBonus().speedBonus } : { healthMultiplier: 1, speedBonus: 0 };
          const newStats = calculateStats(level, accStore.equippedReed, state.embouchure, getSlotMultiplier(accStore.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedBonus);
          const newMaxXp = getXpRequiredForLevel(level);
          health = newStats.health;
          maxHealth = newStats.health;
          damage = newStats.damage;
          basicAttackDamage = newStats.basicAttackDamage;
          speed = newStats.speed;
          critChance = newStats.critChance;
          superCritChance = (newStats as any).superCritChance || 0;
          defense = newStats.defense;
          maxXp = newMaxXp;
        }

        return { xp, maxXp, level, health, maxHealth, damage, basicAttackDamage, speed, critChance, superCritChance, defense, version: state.version + 1 };
      }),

    stopAttack: () => set({ isAttacking: false, attackProgress: 0 }),

    takeDamage: (amount, enemyType) =>
      set((state) => {
        if (state.isInvincible || GAME_CONFIG.INVINCIBLE) return {};

        let totalDefense = state.defense;
        const accStore = getAccessoryStore().getState();
        const meldBonus = accStore.getMeldBonus();
        totalDefense += meldBonus.defense;

        if (enemyType === 'euphonium') {
          const enchantmentBonus = accStore.getEnchantmentBonus();
          totalDefense += enchantmentBonus.euphoniumDefenseBonus;
        }

        // Cap defense at 98% so players can never be completely immune to damage
        const effectiveDefense = Math.min(0.98, totalDefense);
        const reducedAmount = Math.max(0, amount * (1.0 - effectiveDefense));
        const newHealth = Math.max(0, state.health - reducedAmount);
        if (newHealth <= 0 && state.health > 0) {
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
        const { calculateStats, getSlotMultiplier } = require('./accessoryStore');
        const newLevel = state.level + 1;
        const accStore = getAccessoryStore().getState();
        const caseBonuses = accStore.getCaseBonus ? { healthMultiplier: accStore.getCaseBonus().healthMultiplier, speedBonus: accStore.getCaseBonus().speedBonus } : { healthMultiplier: 1, speedBonus: 0 };
        const newStats = calculateStats(newLevel, accStore.equippedReed, state.embouchure, getSlotMultiplier(accStore.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedBonus);
        return {
          level: newLevel,
          maxHealth: newStats.health,
          health: newStats.health,
          damage: newStats.damage,
          speed: newStats.speed,
          version: state.version + 1,
        };
      }),

    resetPlayer: () => {
      // Reset all three stores
      getAccessoryStore().setState({
        equippedReed: null, reedDurability: 0, equippedLigature: null, equippedMouthpiece: null,
        critFactor: 1.5, equippedCase: null, ligatureSlot: -1, mouthpieceSlot: -1, reedSlot: -1, caseSlot: -1,
        equippedEnchantments: { common: null, infused: null, arcane: null },
        enchantmentSlots: { common: -1, infused: -1, arcane: -1 },
        attackCounter: 0, hasEmpoweringSpeedBonus: false, dungeonTimeBonus: 0,
        _cachedLigatureBonus: null, _cachedMouthpieceBonus: null, _cachedCaseBonus: null,
        _cachedMeldBonus: null, _cachedEnchantmentBonus: null,
      });
      getInventoryStore().setState({
        inventory: { ...getInitialInventory() },
        echoes: GAME_CONFIG.STARTING_ECHOES,
      });
      set({
        ...getInitialStats(),
        echoes: GAME_CONFIG.STARTING_ECHOES,
        position: [0, 1.5, 0],
        health: getInitialStats().maxHealth,
        isAttacking: false, attackProgress: 0, lastAttackTime: 0,
        isInvincible: false, isLongToneActive: false, longToneCooldown: 0,
        isOvertoneActive: false, overtoneCooldown: 0,
        abilityUpgrades: { chosenPath: null, currentLevel: 0, unlocked: false },
        _cachedAbilityStats: null,
      });

      if (GAME_CONFIG.AUTO_BUILD) {
        setTimeout(applyAutoBuild, 100);
      }
    },

    triggerLongTone: () => {
      const now = Date.now();
      const state = get();
      if (state.isLongToneActive || now < state.longToneCooldown) return;

      let duration = state.longToneDuration;
      const accStore = getAccessoryStore().getState();
      if (accStore.equippedLigature) {
        const ligatureBonus = accStore.getLigatureBonus();
        duration += ligatureBonus.longToneDurationMs;
      }

      set({ isLongToneActive: true });

      setTimeout(() => {
        set({
          isLongToneActive: false,
          longToneCooldown: Date.now() + get().longToneTotalCooldown,
        });
      }, duration);
    },

    triggerOvertone: () => {
      const now = Date.now();
      const state = get();
      if (state.isOvertoneActive || now < state.overtoneCooldown) return;

      set({
        isOvertoneActive: true,
        lastOvertoneCastTime: now
      });

      setTimeout(() => {
        set({
          isOvertoneActive: false,
          overtoneCooldown: Date.now() + get().overtoneTotalCooldown,
        });
      }, state.overtoneDuration);
    },

    collectEchoes: (amount) =>
      set((state) => {
        const newEchoes = state.echoes + amount;
        // Sync to inventoryStore
        getInventoryStore().getState().syncEchoes(amount);
        return { echoes: newEchoes, version: state.version + 1 };
      }),

    respawn: () => {
      const currentPos = get().position;
      // The north corridor ends at Z=574. Everything past that is the Altar Room.
      const inAltarRoom = currentPos[2] > 574;

      setTimeout(() => {
        usePlayerStore.setState({ isInvincible: false });
      }, 3000);

      return set((state) => {
        const { calculateStats, getSlotMultiplier } = require('./accessoryStore');
        const accStore = getAccessoryStore().getState();
        const gameStore = useGameStore.getState();
        const caseBonuses = accStore.getCaseBonus ? { healthMultiplier: accStore.getCaseBonus().healthMultiplier, speedBonus: accStore.getCaseBonus().speedBonus } : { healthMultiplier: 1, speedBonus: 0 };
        const stats = calculateStats(state.level, accStore.equippedReed, state.embouchure, getSlotMultiplier(accStore.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedBonus);

        let spawnPos: [number, number, number] = [0, 1.5, 0];

        // Spawn on top of the altar if the player died in the Altar Room
        if (inAltarRoom) {
          gameStore.incrementAltarDeathCount();
          const newDeathCount = gameStore.altarDeathCount + 1;

          if (newDeathCount >= 10) {
            console.log("10 deaths in Altar Room reached. Resetting altar and returning to spawn.");
            gameStore.resetAltarDeathCount();
            gameStore.setAltarRoomWave(0);
            spawnPos = [0, 1.5, 0]; // Back to main spawn
            // Play a reset sound
            AudioManager.play('death', 'sfx', { volume: 0.8 });
          } else {
            console.log(`Death in Altar Room. Altar Death Count: ${newDeathCount}/10`);
            spawnPos = [0, 5, 636.5]; // Altar center Z is 636.5, top Y is 4.0
          }
        }

        return {
          health: stats.health,
          maxHealth: stats.health,
          position: spawnPos,
          isAttacking: false,
          attackProgress: 0,
          isInvincible: true,
          isLongToneActive: false,
          longToneCooldown: 0,
          isOvertoneActive: false,
          overtoneCooldown: 0,
          tempo: 0,
          rating: 'F',
        };
      });
    },


    // XP ADDITION

    registerKill: (enemyLevel, xpMultiplier = 1) =>
      set((state) => {
        const now = Date.now();
        const timeSinceLastKill = now - state.lastKillTime;
        const timeSinceLastMove = now - state.lastMoveTime;

        // Anti-camping: if player hasn't moved in 5s, zero combo
        if (timeSinceLastMove > 8000) {
          return { tempo: 0, rating: 'F', lastKillTime: now };
        }

        let newTempo = state.tempo;
        if (timeSinceLastKill < 6000) {
          newTempo += 1;
        } else if (timeSinceLastKill < 8000) {
          // No change
        } else {
          newTempo = 1;
        }

        let xpMultFromTempo = 1
        xpMultFromTempo = 1 + Math.floor(newTempo / 2) * 0.1;


        let rating = 'F';
        if (newTempo >= 10001) rating = 'Ω∞';
        else if (newTempo >= 5001) rating = 'Ω!';
        else if (newTempo >= 3001) rating = 'Ω?';
        else if (newTempo >= 2001) rating = '+Ω';
        else if (newTempo >= 1501) rating = 'Ω';
        else if (newTempo >= 1001) rating = 'Z++';
        else if (newTempo >= 501) rating = 'Z+';
        else if (newTempo >= 301) rating = 'Z';
        else if (newTempo >= 201) rating = 'Y';
        else if (newTempo >= 101) rating = 'X';
        else if (newTempo >= 71) rating = 'SSS';
        else if (newTempo >= 41) rating = 'SS';
        else if (newTempo >= 21) rating = 'S';
        else if (newTempo >= 11) rating = 'A';
        else if (newTempo >= 6) rating = 'B';
        else if (newTempo >= 3) rating = 'C';
        else if (newTempo >= 1) rating = 'D';

        /* 
          Enemy XP: 1x from trumpets, 1.5x from trombones, 2x from horns, 3x from euphoniums, 5x from tubas imported from enemy files.
          XP also multiplied by if the enemy is in an altar wave. If in a wave 1, x1.5, wave 2, x2, wave 3, x3, wave 4, x4, wave 5, x5. If elsewhere, it's just 1x. Stacks with tempo, enemy type, and base XP.

          Base XP scales with enemy level (0.25 per level + small exponential bonus for high levels)
          Level 1: 1 XP, Level 10: 3.25 XP, Level 50: ~14.3 XP, Level 100: ~33 XP
          ~1% bonus per 5 levels
          Extra 1.5% bonus per level above level 100

          xpMultiplier is the multiplier of enemy type * altar.

          Total multipliers: Tempo, Enemy Type, Altar, High Level Bonus, Base XP

        */

        let alina = 5

        let alinalevel = Math.min(enemyLevel, 1000)

        if (enemyLevel >= 500) {
          alina = 5 + Math.floor((alinalevel - 500) / 300);
        }

        let alinatwo = Math.floor(alinalevel / alina) * Math.max(Math.log(alinalevel / 200), 1)

        const linearXp = 1 + (enemyLevel - 1) * 0.25;
        let expBonus = 0;
        if (enemyLevel <= 1000) {
          expBonus = Math.pow(1.025, alinatwo) - 1;
        } else {
          let exp = Math.min((alinatwo + ((enemyLevel - 1000) / 25)), 1000)
          expBonus = Math.pow(1.025, exp) - 1;
        }
        let HighLevelMult = 1;
        if (enemyLevel >= 100) {
          HighLevelMult = 1 + (enemyLevel - 100) * 0.015;
        }
        const basexp = (linearXp + expBonus) * HighLevelMult;

        const totalXp = Math.floor(basexp * xpMultFromTempo * xpMultiplier);



        let { xp, maxXp, level, health, maxHealth, damage, basicAttackDamage, speed, critChance, superCritChance, defense } = state;
        xp += totalXp;

        if (xp >= maxXp) {
          xp -= maxXp;
          level += 1;
          const { calculateStats, getSlotMultiplier } = require('./accessoryStore');
          const accStore = getAccessoryStore().getState();
          const caseBonuses = accStore.getCaseBonus ? { healthMultiplier: accStore.getCaseBonus().healthMultiplier, speedBonus: accStore.getCaseBonus().speedBonus } : { healthMultiplier: 1, speedBonus: 0 };
          const newStats = calculateStats(level, accStore.equippedReed, state.embouchure, getSlotMultiplier(accStore.reedSlot), caseBonuses.healthMultiplier, caseBonuses.speedBonus);
          health = newStats.health;
          maxHealth = newStats.health;
          damage = newStats.damage;
          basicAttackDamage = newStats.basicAttackDamage;
          speed = newStats.speed;
          critChance = newStats.critChance;
          superCritChance = (newStats as any).superCritChance || 0;
          defense = newStats.defense;
          maxXp = getXpRequiredForLevel(level);
        }

        return {
          tempo: newTempo, rating, lastKillTime: now,
          xp, maxXp, level, health, maxHealth, damage, basicAttackDamage, speed, critChance, superCritChance, defense,
          version: state.version + 1,
        };
      }),

    updateMoveTime: () => set({ lastMoveTime: Date.now() }),
    setPlayerName: (name: string) => set({ playerName: name, version: get().version + 1 }),

    applyStun: (duration) => {
      set({ isStunned: true });
      setTimeout(() => set({ isStunned: false }), duration * 1000);
    },

    applySlow: (percent, duration) => {
      const modifier = 1.0 - (percent / 100.0);
      set({ speedModifier: Math.max(0.1, modifier) }); // Minimum 10% speed limit
      setTimeout(() => set({ speedModifier: 1.0 }), duration * 1000);
    },

    // ========== INPUT ==========

    setInputJoystick: (x, y) => set((state) => ({
      input: { ...state.input, joystick: { x, y } }
    })),

    setInputLook: (x, y) => set((state) => ({
      input: { ...state.input, look: { x: state.input.look.x + x, y: state.input.look.y + y } }
    })),

    resetInputLook: () => set((state) => ({
      input: { ...state.input, look: { x: 0, y: 0 } }
    })),

    // ========== CLASS ==========

    setPlayerClass: (playerClass) => set({ playerClass }),

    // ========== ABILITY UPGRADES ==========

    purchaseAbilityUpgrade: (path?) => {
      const state = get();
      const upgrades = state.abilityUpgrades;

      if (state.level < ABILITY_UPGRADES_UNLOCK_LEVEL) return false;
      if (upgrades.currentLevel >= 25) return false;
      if (upgrades.currentLevel >= 10 && state.level < ABILITY_UPGRADES_TIER_2_UNLOCK_LEVEL) return false;
      if (upgrades.currentLevel === 0 && !path) return false;

      const currentLevelIndex = upgrades.currentLevel;
      const isTier2 = currentLevelIndex >= 10;
      const tierIndex = isTier2 ? currentLevelIndex - 10 : currentLevelIndex;
      const upgradeDef = isTier2 ? ABILITY_UPGRADES_TIER_2[tierIndex] : ABILITY_UPGRADES_TIER_1[currentLevelIndex];

      let upgradeLevel: { cost: number; costMaterial: MaterialItemId } | null = null;

      if ('paths' in upgradeDef) {
        // It's a PathSpecificUpgrade
        upgradeLevel = upgradeDef;
      } else {
        // It's a standard AbilityUpgradeLevel
        upgradeLevel = upgradeDef as { cost: number; costMaterial: MaterialItemId };
      }

      if (!upgradeLevel || !upgradeLevel.costMaterial || typeof upgradeLevel.cost !== 'number') return false;

      const invStore = getInventoryStore().getState();
      if (!invStore.removeMaterial(upgradeLevel.costMaterial, upgradeLevel.cost)) return false;

      set({
        abilityUpgrades: {
          chosenPath: currentLevelIndex === 0 ? path! : upgrades.chosenPath,
          currentLevel: currentLevelIndex + 1,
          unlocked: true,
        },
        _cachedAbilityStats: null,
      });

      return true;
    },

    getAbilityUpgradeStats: () => {
      return calculateAbilityUpgradeStats(get().abilityUpgrades);
    },

    isAbilityUpgradesUnlocked: () => {
      return get().level >= ABILITY_UPGRADES_UNLOCK_LEVEL;
    },
  }))
);

export default usePlayerStore;
