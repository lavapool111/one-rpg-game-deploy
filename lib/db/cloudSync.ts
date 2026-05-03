'use client';

/**
 * Cloud Sync Service
 *
 * Complements the existing IndexedDB (Dexie) save system with cloud persistence.
 * Strategy: IndexedDB is the primary (offline-first), Supabase is the cloud backup.
 *
 * - On save: write to IndexedDB immediately, then async-push to cloud if online + authed.
 * - On load: compare IndexedDB and cloud timestamps, use the most recent.
 * - On first login: migrate local IndexedDB data to cloud.
 */

import { useAuthStore } from '@/lib/store/authStore';
import type { PlayerSave } from '@/lib/db';

// ─── Cloud Save ──────────────────────────────────────────────
/**
 * Push a save to the cloud. Non-blocking — failures are logged but don't break gameplay.
 */
export async function cloudSave(saveData: Omit<PlayerSave, 'id' | 'timestamp'>): Promise<boolean> {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated || !navigator.onLine) return false;

    try {
        const response = await fetch('/api/saves', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                saveData,
                timestamp: Date.now(),
            }),
        });

        if (!response.ok) {
            console.warn('[CloudSync] Cloud save failed:', response.status);
            return false;
        }

        console.log('[CloudSync] Cloud save successful');
        return true;
    } catch (error) {
        console.warn('[CloudSync] Cloud save error (offline?):', error);
        return false;
    }
}

// ─── Cloud Load ──────────────────────────────────────────────
/**
 * Fetch the latest cloud save. Returns null if not authenticated or no save exists.
 */
export async function cloudLoad(): Promise<{ data: Omit<PlayerSave, 'id'>; timestamp: number } | null> {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated || !navigator.onLine) return null;

    try {
        const response = await fetch('/api/saves');
        if (!response.ok) return null;

        const { save } = await response.json();
        if (!save) return null;

        return {
            data: save.data as Omit<PlayerSave, 'id'>,
            timestamp: save.timestamp,
        };
    } catch (error) {
        console.warn('[CloudSync] Cloud load error:', error);
        return null;
    }
}

// ─── Resolve Best Save ──────────────────────────────────────
/**
 * Compare local (IndexedDB) and cloud saves, return the most recent one.
 * Used on game load to ensure the player always continues from their latest progress.
 */
export async function resolveLatestSave(
    localSave: PlayerSave | undefined
): Promise<{ save: PlayerSave | undefined; source: 'local' | 'cloud' | 'none' }> {
    const cloudResult = await cloudLoad();

    if (!localSave && !cloudResult) {
        return { save: undefined, source: 'none' };
    }

    if (!localSave && cloudResult) {
        return {
            save: { id: 0, ...cloudResult.data, timestamp: cloudResult.timestamp } as PlayerSave,
            source: 'cloud',
        };
    }

    if (localSave && !cloudResult) {
        return { save: localSave, source: 'local' };
    }

    // Both exist — use whichever is newer
    if (localSave && cloudResult) {
        if (cloudResult.timestamp > localSave.timestamp) {
            return {
                save: { id: 0, ...cloudResult.data, timestamp: cloudResult.timestamp } as PlayerSave,
                source: 'cloud',
            };
        }
        return { save: localSave, source: 'local' };
    }

    return { save: localSave, source: 'local' };
}

// ─── Migrate Local to Cloud ─────────────────────────────────
/**
 * On first login: push the latest IndexedDB save to the cloud.
 * Called once after the first successful authentication.
 */
export async function migrateLocalToCloud(localSave: PlayerSave): Promise<boolean> {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) return false;

    try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, timestamp, ...saveData } = localSave;

        const success = await cloudSave(saveData);
        if (success) {
            // Mark migration as complete
            try {
                localStorage.setItem('cloud_migration_done', 'true');
            } catch { /* ignore */ }
            console.log('[CloudSync] Local → Cloud migration complete');
        }
        return success;
    } catch (error) {
        console.error('[CloudSync] Migration failed:', error);
        return false;
    }
}

// ─── Migration Status ────────────────────────────────────────
export function hasCompletedCloudMigration(): boolean {
    try {
        return localStorage.getItem('cloud_migration_done') === 'true';
    } catch {
        return false;
    }
}

// ─── Cloud Settings Sync ────────────────────────────────────
/**
 * Push a setting to the cloud.
 */
export async function cloudSaveSetting(name: string, value: string): Promise<boolean> {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated || !navigator.onLine) return false;

    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, value }),
        });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Load all settings from the cloud.
 */
export async function cloudLoadSettings(): Promise<Record<string, string> | null> {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated || !navigator.onLine) return null;

    try {
        const response = await fetch('/api/settings');
        if (!response.ok) return null;
        const { settings } = await response.json();
        return settings;
    } catch {
        return null;
    }
}
