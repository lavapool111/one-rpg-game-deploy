'use client';

/**
 * HUD Component
 * Displays player health, phase meter, score, and combo counter
 */

export function HUD() {
    return (
        <div className="fixed inset-0 pointer-events-none z-50">
            {/* Health Bar */}
            <div className="absolute top-4 left-4">
                <div className="text-white text-sm mb-1">Health</div>
                <div className="w-48 h-3 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 w-full transition-all" />
                </div>
            </div>

            {/* Phase Meter */}
            <div className="absolute top-4 right-4">
                <div className="text-white text-sm mb-1">Phase</div>
                <div className="w-48 h-3 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 w-1/3 transition-all" />
                </div>
            </div>

            {/* Score */}
            <div className="absolute top-16 left-4 text-white">
                <div className="text-2xl font-bold">0</div>
                <div className="text-sm opacity-70">Score</div>
            </div>

            {/* Combo Counter */}
            <div className="absolute top-1/2 right-4 -translate-y-1/2 text-right">
                <div className="text-4xl font-bold text-yellow-400">0x</div>
                <div className="text-sm text-white opacity-70">Combo</div>
            </div>
        </div>
    );
}

export default HUD;
