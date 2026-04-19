import Dexie, { Table } from 'dexie';
import { Inventory, ReedStrength, LigatureInstance, MouthpieceInstance, CaseInstance, EnchantmentInstance, EnchantmentTier } from '../game/inventory';
import { PlayerClass } from '../store/playerStore';
import { AbilityUpgrades } from '../game/abilityUpgrades';

export interface PlayerSave {
    id?: number; // Auto-incremented ID (we usually only keep one save, or the latest)
    timestamp: number;
    level: number;
    health: number;
    xp: number;
    echoes: number;
    position: { x: number; y: number; z: number };
    inventory?: Inventory; // Inventory state (includes ligatures, mouthpieces, cases, enchantments)
    equippedReed?: ReedStrength | null;
    reedDurability?: number;
    embouchure?: number;
    embouchureXp?: number;
    dungeonTimeBonus?: number;
    equippedLigature?: LigatureInstance | null;
    equippedMouthpiece?: MouthpieceInstance | null;
    equippedCase?: CaseInstance | null;
    equippedEnchantments?: Record<EnchantmentTier, EnchantmentInstance | null>;
    enchantmentSlots?: Record<EnchantmentTier, number>;
    attackCounter?: number;
    hasEmpoweringSpeedBonus?: boolean;
    playerClass?: PlayerClass;
    playerName?: string;
    abilityUpgrades?: AbilityUpgrades;
    sessionId?: string; // Unique ID for the current browser session/tab
}

class GameDatabase extends Dexie {
    saves!: Table<PlayerSave>;

    constructor() {
        super('OneRpgGameDB');
        this.version(3).stores({
            saves: '++id, timestamp'
        });
    }
}

export const db = new GameDatabase();

/**
 * Save the game state to IndexedDB.
 * Creates a new record every time to prevent corruption/locking of a single row.
 */
export async function saveGame(save: Omit<PlayerSave, 'id' | 'timestamp'>) {
    try {
        const now = Date.now();

        // 1. Save the new record
        await db.saves.add({
            timestamp: now,
            ...save
        });

        console.log('[DB] New save created:', {
            level: save.level,
            xp: save.xp,
            sessionId: save.sessionId,
            timestamp: new Date(now).toISOString()
        });

        // 2. Cull old records (Non-blocking background task)
        const count = await getThrottledCount();
        if (count > 200) {
            // Offload culling to prevent blocking the save completion
            const performCull = async () => {
                try {
                    const oldestRecords = await db.saves
                        .orderBy('timestamp')
                        .limit(count - 50)
                        .toArray();

                    const idsToDelete = oldestRecords.map(r => r.id).filter((id): id is number => id !== undefined);
                    if (idsToDelete.length > 0) {
                        await db.saves.bulkDelete(idsToDelete);
                        console.log(`[DB] Culled ${idsToDelete.length} old save records in background`);
                    }
                } catch (e) {
                    console.error('[DB] Background cull failed:', e);
                }
            };

            if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
                (window as any).requestIdleCallback(() => performCull());
            } else {
                setTimeout(performCull, 100);
            }
        }
    } catch (error) {
        console.error('[DB] Failed to save game:', error);
    }
}

let lastCount = -1;
let lastCountTime = 0;
let savesSinceLastCount = 0;

async function getThrottledCount(): Promise<number> {
    const now = Date.now();
    // Re-check count only if it's been 5 minutes OR 40 saves have passed
    if (lastCount === -1 || savesSinceLastCount >= 40 || (now - lastCountTime > 300000)) {
        lastCount = await db.saves.count();
        lastCountTime = now;
        savesSinceLastCount = 0;
    } else {
        lastCount++; // Speculative increment
        savesSinceLastCount++;
    }
    return lastCount;
}


/**
 * Load the latest game save based on timestamp.
 */
export async function loadGame(): Promise<PlayerSave | undefined> {
    try {
        // Query the latest save by timestamp descending
        const latestSaves = await db.saves
            .orderBy('timestamp')
            .reverse()
            .limit(1)
            .toArray();

        let dbSave = latestSaves.length > 0 ? latestSaves[0] : null;

        // Check emergency backup from localStorage
        try {
            const backupStr = localStorage.getItem('emergency_backup_save');
            if (backupStr) {
                const backup = JSON.parse(backupStr);
                // If we have no DB save, or backup is newer than DB save, use the backup
                if (!dbSave || backup.timestamp > dbSave.timestamp) {
                    console.log('[DB] Restoring from emergency localStorage backup (newer or DB missing)');
                    dbSave = {
                        id: 0, // Fake ID for typing
                        ...backup
                    } as PlayerSave;
                }
            }
        } catch (e) {
            console.error('[DB] Failed to parse emergency backup', e);
        }

        if (!dbSave) return undefined;

        console.log('[DB] Loaded latest save:', {
            level: dbSave.level,
            xp: dbSave.xp,
            id: dbSave.id,
            timestamp: new Date(dbSave.timestamp).toISOString(),
            sessionId: dbSave.sessionId
        });
        return dbSave;
    } catch (error) {
        console.error('[DB] Failed to load game:', error);
        return undefined;
    }
}

/**
 * Delete the latest save record.
 */
export async function deleteLatestSave() {
    try {
        const latest = await db.saves.orderBy('timestamp').reverse().limit(1).toArray();
        if (latest.length > 0 && latest[0].id !== undefined) {
            await db.saves.delete(latest[0].id);
            console.log('[DB] Latest save deleted:', latest[0].id);
            return true;
        }
    } catch (error) {
        console.error('[DB] Failed to delete latest save:', error);
    }
    return false;
}

/**
 * Check if a save exists.
 */
export async function hasSave(): Promise<boolean> {
    try {
        const count = await db.saves.count();
        if (count > 0) return true;

        return !!localStorage.getItem('emergency_backup_save');
    } catch (error) {
        console.error('[DB] Failed to check for save:', error);
        return false;
    }
}
