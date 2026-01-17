import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

/**
 * Game Store
 * Central state management for game state
 */

export type GameState = 'menu' | 'playing' | 'paused' | 'gameOver';

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
        }),
    }))
);

export default useGameStore;
