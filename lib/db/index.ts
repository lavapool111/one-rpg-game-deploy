import Dexie, { Table } from 'dexie';
import { Inventory, ReedStrength } from '../game/inventory';

export interface PlayerSave {
    id?: number; // Auto-incremented ID (we usually only keep one save, or the latest)
    timestamp: number;
    level: number;
    health: number;
    xp: number;
    echoes: number;
    position: { x: number; y: number; z: number };
    inventory?: Inventory; // Inventory state
    equippedReed?: ReedStrength | null;
    reedDurability?: number;
    embouchure?: number;
    embouchureXp?: number;
}

class GameDatabase extends Dexie {
    saves!: Table<PlayerSave>;

    constructor() {
        super('OneRpgGameDB');
        this.version(2).stores({
            saves: '++id, timestamp'
        });
    }
}

export const db = new GameDatabase();

/**
 * Save the game state to IndexedDB.
 * Overwrites the previous save or creates a new one.
 */
export async function saveGame(save: Omit<PlayerSave, 'id' | 'timestamp'>) {
    try {
        // We only persist one save slot for now (ID: 1). 
        // Upserting with a specific key or just clearing and adding.
        // Let's use put() with a fixed ID to effectively have a single slot.
        const id = 1;
        await db.saves.put({
            id,
            timestamp: Date.now(),
            ...save
        });
        console.log('Game saved successfully');
    } catch (error) {
        console.error('Failed to save game:', error);
    }
}

/**
 * Load the latest game save.
 */
export async function loadGame(): Promise<PlayerSave | undefined> {
    try {
        const id = 1;
        return await db.saves.get(id);
    } catch (error) {
        console.error('Failed to load game:', error);
        return undefined;
    }
}

/**
 * Check if a save exists.
 */
export async function hasSave(): Promise<boolean> {
    try {
        const count = await db.saves.count();
        return count > 0;
    } catch {
        return false;
    }
}
