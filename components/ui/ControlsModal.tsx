'use client';

import { useEffect, useState } from 'react';

interface ControlsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ControlsModal({ isOpen, onClose }: ControlsModalProps) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setVisible(true);
        } else {
            const timer = setTimeout(() => setVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isOpen && !visible) return null;

    return (
        <div className={`fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm cursor-pointer"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className={`relative w-full max-w-4xl bg-slate-900/90 border border-blue-900/30 shadow-[0_0_50px_rgba(30,58,138,0.2)] rounded-2xl p-8 md:p-12 overflow-y-auto max-h-[90vh] transition-all duration-300 transform ${isOpen ? 'translate-y-0 scale-100' : 'translate-y-8 scale-95'}`}>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                    <span className="text-2xl font-light">&times;</span>
                </button>

                <h2 className="text-3xl md:text-4xl font-light text-white tracking-widest uppercase mb-8 pb-4 border-b border-blue-900/40">
                    Controls
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 text-slate-300 font-light">
                    {/* Movement */}
                    <div className="space-y-4">
                        <h3 className="text-lg text-blue-400 tracking-wider uppercase mb-4 font-medium flex items-center gap-2">
                            <svg className="w-5 h-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                            Movement
                        </h3>
                        <div className="bg-slate-950/50 rounded-lg p-1 border border-slate-800/50">
                            <ControlRow keys={['W', 'A', 'S', 'D']} action="Move Character" />
                            <ControlRow keys={['Mouse']} action="Look Around" />
                            <ControlRow keys={['Space']} action="Jump" />
                            <ControlRow keys={['Q']} action="Sprint" noBorder />
                        </div>
                    </div>

                    {/* Combat & Interaction */}
                    <div className="space-y-4">
                        <h3 className="text-lg text-blue-400 tracking-wider uppercase mb-4 font-medium flex items-center gap-2">
                            <svg className="w-5 h-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            Combat
                        </h3>
                        <div className="bg-slate-950/50 rounded-lg p-1 border border-slate-800/50">
                            <ControlRow keys={['Left Click']} action="Basic Attack" />
                            <ControlRow keys={['1', '2']} action="Use Ability" />
                        </div>
                    </div>

                    {/* Menus */}
                    <div className="space-y-4 md:col-span-2">
                        <h3 className="text-lg text-blue-400 tracking-wider uppercase mb-4 font-medium flex items-center gap-2">
                            <svg className="w-5 h-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
                            Interface
                        </h3>
                        <div className="bg-slate-950/50 rounded-lg p-1 border border-slate-800/50 grid grid-cols-1 md:grid-cols-2 gap-x-8">
                            <div>
                                <ControlRow keys={['Z']} action="Open Inventory" />
                                <ControlRow keys={['E']} action="Player Stats" noBorder />
                            </div>
                            <div>
                                <ControlRow keys={['Esc']} action="Pause Game" />
                                <ControlRow keys={['R']} action="Kill Menus" noBorder />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-10 pt-6 border-t border-blue-900/40 text-center">
                    <p className="text-sm text-slate-500 tracking-wider">
                        Touch controls are automatically enabled on supported mobile devices.
                    </p>
                </div>
            </div>
        </div>
    );
}

function ControlRow({ keys, action, noBorder }: { keys: string[], action: string, noBorder?: boolean }) {
    return (
        <div className={`flex items-center justify-between px-3 py-2.5 ${!noBorder ? 'border-b border-slate-800/50' : ''}`}>
            <span className="text-slate-300 text-sm tracking-wide">{action}</span>
            <div className="flex gap-2">
                {keys.map((k, i) => (
                    <span key={i} className="min-w-6 text-center px-2 py-1 bg-slate-800 border-b-2 border-slate-950 rounded text-xs text-blue-200 font-mono tracking-widest uppercase shadow-sm">
                        {k}
                    </span>
                ))}
            </div>
        </div>
    );
}
