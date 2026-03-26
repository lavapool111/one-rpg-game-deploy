'use client';

import { useGameStore, usePlayerStore } from '@/lib/store';
import { useState, useEffect } from 'react';
import { PlayerClass, CLASS_INFO } from '@/lib/store/playerStore';

export function ClassSelectScreen() {
    const setGameState = useGameStore((state) => state.setGameState);
    const setPlayerClass = usePlayerStore((state) => state.setPlayerClass);
    const [isVisible, setIsVisible] = useState(false);
    const [selectedClass, setSelectedClass] = useState<PlayerClass | null>(null);

    useEffect(() => {
        // Fade in on mount
        setIsVisible(true);
    }, []);

    const handleSelectClass = (playerClass: PlayerClass) => {
        setSelectedClass(playerClass);
    };

    const handleConfirm = () => {
        if (!selectedClass) return;

        setPlayerClass(selectedClass);
        setIsVisible(false);
        setTimeout(() => {
            setGameState('playing');
        }, 300);
    };

    const classes: PlayerClass[] = ['bb_clarinet', 'viola'];

    return (
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-bold text-yellow-400 mb-2">Choose Your Instrument</h1>
            <p className="text-slate-400 mb-8 text-center max-w-md">Select the instrument you will wield against the brass uprising.</p>

            {/* Class cards */}
            <div className="flex flex-col md:flex-row gap-6 mb-8">
                {classes.map((cls) => {
                    const info = CLASS_INFO[cls];
                    const isSelected = selectedClass === cls;

                    return (
                        <button
                            key={cls}
                            onClick={() => handleSelectClass(cls)}
                            className={`relative w-72 p-6 rounded-xl border-2 transition-all duration-300 text-left ${isSelected
                                ? 'border-yellow-500 bg-yellow-900/30 shadow-[0_0_30px_rgba(234,179,8,0.3)] scale-105'
                                : 'border-slate-600 bg-slate-800/50 hover:border-slate-400 hover:bg-slate-800'
                                }`}
                        >
                            {/* Selection indicator */}
                            {isSelected && (
                                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center text-slate-950">
                                    ✓
                                </div>
                            )}

                            {/* Icon */}
                            <div className="text-5xl mb-4">{info.icon}</div>

                            {/* Name */}
                            <h2 className={`text-xl font-bold mb-2 ${isSelected ? 'text-yellow-400' : 'text-slate-200'}`}>
                                {info.name}
                            </h2>

                            {/* Description */}
                            <p className="text-sm text-slate-400 leading-relaxed">
                                {info.description}
                            </p>

                            {/* Ability preview */}
                            <div className="mt-4 pt-4 border-t border-slate-600/50">
                                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Special Ability</p>
                                <p className={`text-sm font-semibold ${isSelected ? 'text-yellow-400' : 'text-slate-300'}`}>
                                    {cls === 'bb_clarinet' ? 'Long Tone' : 'Sustained Bow'}
                                </p>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Confirm button */}
            <button
                onClick={handleConfirm}
                disabled={!selectedClass}
                className={`px-8 py-4 rounded font-bold uppercase tracking-wider text-lg transition-all duration-300 ${selectedClass
                    ? 'bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-500 hover:to-yellow-600 text-slate-950 shadow-[0_0_30px_rgba(234,179,8,0.3)]'
                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
            >
                {selectedClass ? `Begin as ${CLASS_INFO[selectedClass].name}` : 'Select an Instrument'}
            </button>

            {/* Decorative elements */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-900/10 via-transparent to-transparent pointer-events-none" />
        </div>
    );
}

export default ClassSelectScreen;
