'use client';

import { useState, useEffect } from 'react';
import { usePlayerStore, useInventoryStore, useAccessoryStore, useGameStore } from '@/lib/store';
import { saveGame } from '@/lib/db';
import { getSaveData } from '@/lib/db/saveUtils';

/**
 * SaveDebugger
 * Pressing '0' (zero) toggles this menu.
 * Allows developers to export, edit, and import IndexedDB save data.
 */
export function SaveDebugger() {
    const [isVisible, setIsVisible] = useState(false);
    const [jsonText, setJsonText] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '0') {
                setIsVisible(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleExport = () => {
        const data = getSaveData();
        setJsonText(JSON.stringify(data, null, 2));
        setError(null);

        // Also copy to clipboard for convenience
        navigator.clipboard.writeText(JSON.stringify(data)).then(() => {
            console.log('[SaveDebugger] State exported and copied to clipboard');
        });
    };

    const handleImport = async () => {
        try {
            const data = JSON.parse(jsonText);

            // Validate basic structure - must at least have level and inventory
            if (!data.level || !data.inventory) {
                // Check if it's the old partitioned format
                if (!data.player || !data.inventory) {
                    throw new Error('Invalid save data structure. Missing core fields (level/inventory)');
                }
            }

            // Backup first (emergency)
            const backup = getSaveData();
            localStorage.setItem('manual_debug_backup', JSON.stringify(backup));

            // Load into stores
            // The stores' loadState methods are already designed to handle either the full object 
            // or their specific slice, but we'll normalize to the full object for consistency.
            usePlayerStore.getState().loadState(data.player || data);
            useInventoryStore.getState().loadState(data.inventory ? (data.inventory.inventory ? data.inventory : { inventory: data.inventory }) : data);
            useAccessoryStore.getState().loadState(data.accessory || data);
            useGameStore.getState().loadState(data.game || data);

            // Force persistence to IndexedDB
            await saveGame(data.player ? { ...data.player, inventory: data.inventory, accessory: data.accessory, ...data.game } : data);

            console.log('[SaveDebugger] Import successful');
            setError(null);
            alert('Import successful! Game state updated and saved.');
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleForceSave = async () => {
        const data = getSaveData();
        await saveGame(data);
        console.log('[SaveDebugger] Manual force save triggered');
        alert('Game saved to IndexedDB.');
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 font-mono text-xs">
            <div className="bg-slate-900 border-2 border-red-500 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-[0_0_20px_rgba(239,68,68,0.5)]">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-red-500 font-bold text-lg uppercase tracking-widest">⚠️ Save Debugger</h2>
                    <button onClick={() => setIsVisible(false)} className="text-slate-400 hover:text-white text-xl">×</button>
                </div>

                <div className="flex gap-4 mb-4 overflow-x-auto pb-2">
                    <button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold whitespace-nowrap">
                        EXPORT CURRENT STATE
                    </button>
                    <button onClick={handleImport} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-bold whitespace-nowrap">
                        IMPORT & APPLY
                    </button>
                    <button onClick={handleForceSave} className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded font-bold whitespace-nowrap">
                        FORCE SAVE (IDB)
                    </button>
                    <button
                        onClick={() => {
                            if (confirm('Delete current save?')) {
                                indexedDB.deleteDatabase('ClarinetRPG');
                                window.location.reload();
                            }
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-bold whitespace-nowrap"
                    >
                        NUKE DATABASE
                    </button>
                </div>

                <div className="flex-1 min-h-0">
                    <p className="text-slate-500 mb-1">Paste JSON here to import, or click Export to see current state:</p>
                    <textarea
                        className="w-full h-full bg-slate-950 border border-slate-700 text-green-400 p-4 rounded resize-none focus:outline-none focus:border-red-500/50"
                        value={jsonText}
                        onChange={(e) => setJsonText(e.target.value)}
                        placeholder='{"player": {...}, ...}'
                    />
                </div>

                {error && (
                    <div className="mt-4 p-3 bg-red-900/50 border border-red-700 text-red-200 rounded">
                        <strong>Error:</strong> {error}
                    </div>
                )}

                <div className="mt-4 text-slate-500 flex justify-between">
                    <span>Press '0' to hide this menu</span>
                    <span>A backup is saved to localStorage on import</span>
                </div>
            </div>
        </div>
    );
}
