import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { usePlayerStore } from './playerStore';
import { useAccessoryStore } from './accessoryStore';
import { useInventoryStore } from './inventoryStore';
import { getTierFromGold, generateTierRewards, DungeonTier, DungeonRewards, TIER_DISPLAY_NAMES } from '../game/dungeonTiers';

/**
 * Game Store
 * Central state management for game state
 */

export type GameState = 'menu' | 'intro' | 'classSelect' | 'playing' | 'paused' | 'gameOver';
export type Location = 'band_room' | 'backstage_halls';

export interface DungeonState {
    startTime: number;
    timeLimit: number;
    goldCollected: number;
    keys: { melodic: number; resonance: number };
    trialRoomKills: number;
}

export interface DungeonResult {
    gold: number;
    tier: DungeonTier;
    tierName: string;
    rewards: DungeonRewards;
    success: boolean;
}

export interface GameStore {
    // Game state
    gameState: GameState;
    score: number;
    highScore: number;
    phase: number;
    phaseMeter: number;

    // Player state
    playerHealth: number;
    playerMaxHealth: number;
    combo: number;

    // Location state
    currentLocation: Location;
    dungeonState: DungeonState | null;
    lastDungeonResult: DungeonResult | null;

    // Enemy Buff State
    activeEuphoniumShields: number;

    // Actions
    setGameState: (state: GameState) => void;
    addScore: (points: number) => void;
    setPhase: (phase: number) => void;
    setPhaseMeter: (meter: number) => void;
    takeDamage: (amount: number) => void;
    heal: (amount: number) => void;
    incrementCombo: () => void;
    resetCombo: () => void;
    resetGame: () => void;

    // Enemy Buff Actions
    addEuphoniumShield: () => void;
    removeEuphoniumShield: () => void;

    // Dungeon actions
    enterDungeon: () => void;
    exitDungeon: () => void;
    escapeDungeon: () => void;  // Escape with gold
    failDungeonRun: () => void; // Time ran out, lose gold
    collectGold: (amount: number) => void;
    addKey: (type: 'melodic' | 'resonance') => void;
    useKey: (type: 'melodic' | 'resonance') => boolean; // Consume key, returns true if successful
    addDungeonTime: (seconds: number) => void; // Debug: add time
    clearDungeonResult: () => void; // Clear last dungeon result
    incrementTrialRoomKills: () => void;

    // --- Altar Room State ---
    altarRoomWave: number;
    isInAltarRoom: boolean;
    altarRoomWaveEnemiesRemaining: number;
    altarRoomWaveEnemiesTotal: number;
    altarDeathCount: number;
    currentAltarIndex: number;
    setAltarRoomWave: (wave: number) => void;
    setIsInAltarRoom: (isInRoom: boolean) => void;
    setAltarRoomWaveEnemies: (remaining: number, total: number) => void;
    incrementAltarDeathCount: () => void;
    resetAltarDeathCount: () => void;
    setAltarIndex: (index: number) => void;
}

const INITIAL_HEALTH = 100;

export const useGameStore = create<GameStore>()(
    subscribeWithSelector((set, get) => ({
        // Initial state
        gameState: 'menu',
        score: 0,
        highScore: 0,
        phase: 1,
        phaseMeter: 0,
        playerHealth: INITIAL_HEALTH,
        playerMaxHealth: INITIAL_HEALTH,
        combo: 0,

        // Location state
        currentLocation: 'band_room',
        dungeonState: null,
        lastDungeonResult: null,

        // Enemy Buff State
        activeEuphoniumShields: 0,

        // --- Altar Room ---
        altarRoomWave: 0,
        isInAltarRoom: false,
        altarRoomWaveEnemiesRemaining: 0,
        altarRoomWaveEnemiesTotal: 0,
        altarDeathCount: 0,
        currentAltarIndex: 0,
        setAltarRoomWave: (wave: number) => set({ altarRoomWave: wave }),
        setIsInAltarRoom: (isInRoom: boolean) => set({ isInAltarRoom: isInRoom }),
        setAltarRoomWaveEnemies: (remaining: number, total: number) => set({
            altarRoomWaveEnemiesRemaining: remaining,
            altarRoomWaveEnemiesTotal: total
        }),
        incrementAltarDeathCount: () => set((state: GameStore) => ({ altarDeathCount: state.altarDeathCount + 1 })),
        resetAltarDeathCount: () => set({ altarDeathCount: 0 }),
        setAltarIndex: (index: number) => set({ currentAltarIndex: index }),

        // Enemy Buff Actions
        addEuphoniumShield: () => set((state) => ({ activeEuphoniumShields: state.activeEuphoniumShields + 1 })),
        removeEuphoniumShield: () => set((state) => ({ activeEuphoniumShields: Math.max(0, state.activeEuphoniumShields - 1) })),

        // Actions
        setGameState: (gameState) => set({ gameState }),

        addScore: (points) => set((state) => ({
            score: state.score + points,
            highScore: Math.max(state.highScore, state.score + points),
        })),

        setPhase: (phase) => set({ phase }),

        setPhaseMeter: (phaseMeter) => set({ phaseMeter }),

        takeDamage: (amount) => set((state) => {
            const newHealth = Math.max(0, state.playerHealth - amount);
            return {
                playerHealth: newHealth,
                gameState: newHealth <= 0 ? 'gameOver' : state.gameState,
            };
        }),

        heal: (amount) => set((state) => ({
            playerHealth: Math.min(state.playerMaxHealth, state.playerHealth + amount),
        })),

        incrementCombo: () => set((state) => ({ combo: state.combo + 1 })),

        resetCombo: () => set({ combo: 0 }),

        resetGame: () => set({
            gameState: 'playing',
            score: 0,
            phase: 1,
            phaseMeter: 0,
            playerHealth: INITIAL_HEALTH,
            combo: 0,
            currentLocation: 'band_room',
            dungeonState: null,
            lastDungeonResult: null,
            activeEuphoniumShields: 0,
            altarRoomWave: 0,
            isInAltarRoom: false,
            altarRoomWaveEnemiesRemaining: 0,
            altarRoomWaveEnemiesTotal: 0,
            altarDeathCount: 0,
            currentAltarIndex: 0
        }),

        // Dungeon actions
        enterDungeon: () => {
            const timeLimit = useAccessoryStore.getState().getDungeonTimeLimit();
            set({
                currentLocation: 'backstage_halls',
                dungeonState: {
                    startTime: Date.now(),
                    timeLimit: timeLimit,
                    goldCollected: 0,
                    keys: { melodic: 0, resonance: 0 },
                    trialRoomKills: 0,
                },
            });
        },

        exitDungeon: () => {
            // Reset position to dungeon entrance to prevent being stranded in Band Room at dungeon coords
            usePlayerStore.getState().setPosition(0, 1.5, -560);
            set({
                currentLocation: 'band_room',
                dungeonState: null,
            });
        },

        // Escape dungeon through exit door - KEEP gold & grant rewards
        escapeDungeon: () => {
            const state = get();
            const goldCollected = state.dungeonState?.goldCollected || 0;

            // Calculate tier and generate rewards
            const tier = getTierFromGold(goldCollected, false);
            const tierName = TIER_DISPLAY_NAMES[tier];
            const rewards = generateTierRewards(tier);

            // Grant rewards to player
            const playerStore = usePlayerStore.getState();

            // Echoes
            if (rewards.echoes > 0) {
                playerStore.collectEchoes(rewards.echoes);
            }

            // Materials
            if (rewards.valves > 0) useInventoryStore.getState().addMaterial('valves', rewards.valves);
            if (rewards.heavyValves > 0) useInventoryStore.getState().addMaterial('heavy_valves', rewards.heavyValves);
            if (rewards.corkGrease > 0) useInventoryStore.getState().addMaterial('cork_grease', rewards.corkGrease);
            if (rewards.valveOil > 0) useInventoryStore.getState().addMaterial('valve_oil', rewards.valveOil);
            if (rewards.slides > 0) useInventoryStore.getState().addMaterial('trombone_slides', rewards.slides);
            if (rewards.brassIngots > 0) useInventoryStore.getState().addMaterial('brass_ingots', rewards.brassIngots);
            if (rewards.moonlightAzarite > 0) useInventoryStore.getState().addMaterial('moonlight_azarite', rewards.moonlightAzarite);
            if (rewards.reinforcedIngots > 0) useInventoryStore.getState().addMaterial('reinforced_brass_ingots', rewards.reinforcedIngots);
            if (rewards.infusedIngots > 0) useInventoryStore.getState().addMaterial('infused_brass_ingots', rewards.infusedIngots);
            if (rewards.sheetMusicCommon > 0) useInventoryStore.getState().addMaterial('sheet_music_fragments_common', rewards.sheetMusicCommon);
            if (rewards.sheetMusicRare > 0) useInventoryStore.getState().addMaterial('sheet_music_fragments_rare', rewards.sheetMusicRare);
            if (rewards.sheetMusicLegendary > 0) useInventoryStore.getState().addMaterial('sheet_music_fragments_legendary', rewards.sheetMusicLegendary);

            // Reeds - Note: Reeds are equipped items, not materials. Logging for now.
            if (rewards.reeds.length > 0) {
                console.log(`Tier rewards include ${rewards.reeds.length} reeds:`, rewards.reeds);
                // TODO: Add reeds to inventory as craftable/equippable items
            }

            // Set player position near dungeon door
            console.log('escapeDungeon: Setting position to (0, 1.5, -560)');
            playerStore.setPosition(0, 1.5, -560);
            console.log('escapeDungeon: Position set, now:', playerStore.position);

            // Store result for summary screen
            const dungeonResult = {
                gold: goldCollected,
                tier,
                tierName,
                rewards,
                success: true,
            };

            set((prevState) => ({
                currentLocation: 'band_room',
                dungeonState: null,
                lastDungeonResult: dungeonResult,
                score: prevState.score + goldCollected,
            }));

            console.log(`Dungeon escaped! Tier: ${tierName}, Gold: ${goldCollected}`);
        },

        // Fail dungeon run - lose all gold
        failDungeonRun: () => {
            // Set player position near dungeon door in south corridor
            usePlayerStore.getState().setPosition(0, 1.5, -560);
            set({
                currentLocation: 'band_room',
                dungeonState: null,
            });
        },

        collectGold: (amount) => set((state) => ({
            dungeonState: state.dungeonState
                ? { ...state.dungeonState, goldCollected: state.dungeonState.goldCollected + amount }
                : null,
        })),

        addKey: (type) => set((state) => ({
            dungeonState: state.dungeonState
                ? {
                    ...state.dungeonState,
                    keys: {
                        ...state.dungeonState.keys,
                        [type]: state.dungeonState.keys[type] + 1,
                    },
                }
                : null,
        })),

        // Use a key (for opening vaults)
        useKey: (type) => {
            const state = get();
            if (!state.dungeonState) return false;
            if (state.dungeonState.keys[type] <= 0) return false;

            set({
                dungeonState: {
                    ...state.dungeonState,
                    keys: {
                        ...state.dungeonState.keys,
                        [type]: state.dungeonState.keys[type] - 1,
                    },
                },
            });
            return true;
        },

        // Debug: Add time to dungeon timer
        addDungeonTime: (seconds) => set((state) => ({
            dungeonState: state.dungeonState
                ? { ...state.dungeonState, timeLimit: state.dungeonState.timeLimit + seconds }
                : null,
        })),

        // Clear last dungeon result
        clearDungeonResult: () => set({ lastDungeonResult: null }),

        incrementTrialRoomKills: () => set((state) => ({
            dungeonState: state.dungeonState
                ? { ...state.dungeonState, trialRoomKills: state.dungeonState.trialRoomKills + 1 }
                : null,
        })),
    }))
);

export default useGameStore;
