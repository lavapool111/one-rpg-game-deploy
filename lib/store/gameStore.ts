import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { usePlayerStore } from './playerStore';
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
        }),

        // Dungeon actions
        // Dungeon actions
        enterDungeon: () => {
            const timeLimit = usePlayerStore.getState().getDungeonTimeLimit();
            set({
                currentLocation: 'backstage_halls',
                dungeonState: {
                    startTime: Date.now(),
                    timeLimit: timeLimit,
                    goldCollected: 0,
                    keys: { melodic: 0, resonance: 0 },
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
            if (rewards.valves > 0) playerStore.addMaterial('valves', rewards.valves);
            if (rewards.heavyValves > 0) playerStore.addMaterial('heavy_valves', rewards.heavyValves);
            if (rewards.corkGrease > 0) playerStore.addMaterial('cork_grease', rewards.corkGrease);
            if (rewards.valveOil > 0) playerStore.addMaterial('valve_oil', rewards.valveOil);
            if (rewards.slides > 0) playerStore.addMaterial('trombone_slides', rewards.slides);
            if (rewards.brassIngots > 0) playerStore.addMaterial('brass_ingots', rewards.brassIngots);

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
    }))
);

export default useGameStore;
