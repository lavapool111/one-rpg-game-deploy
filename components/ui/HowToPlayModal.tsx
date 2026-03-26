'use client';

import { useEffect, useState } from 'react';

interface HowToPlayModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function HowToPlayModal({ isOpen, onClose }: HowToPlayModalProps) {
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
            <div className={`relative w-full max-w-3xl bg-slate-900/90 border border-blue-900/30 shadow-[0_0_50px_rgba(30,58,138,0.2)] rounded-2xl p-8 md:p-12 overflow-y-auto max-h-[90vh] transition-all duration-300 transform ${isOpen ? 'translate-y-0 scale-100' : 'translate-y-8 scale-95'}`}>

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                >
                    <span className="text-2xl font-light">&times;</span>
                </button>

                <h2 className="text-3xl md:text-4xl font-light text-white tracking-widest uppercase mb-8 pb-4 border-b border-blue-900/40">
                    How to Play
                </h2>

                <div className="space-y-8 text-slate-300 font-light leading-relaxed">
                    <section>
                        <h3 className="text-xl text-blue-400 tracking-wider uppercase mb-3 font-medium">The Setting</h3>
                        <p>
                            You are a musician trapped within the endless architecture of the Band Room.
                            Armed only with your instrument and its magical properties, you must navigate the perilous environments,
                            battle rogues of brass, and uncover the mysteries of the grand concert hall above.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-xl text-blue-400 tracking-wider uppercase mb-3 font-medium">Combat & Spells</h3>
                        <p className="mb-3">
                            Your instrument serves as your weapon. Different instruments offer unique playstyles, ranges, and attack speeds.
                        </p>
                        <ul className="list-disc pl-5 space-y-2 opacity-80">
                            <li><span className="text-white font-medium">Basic Attack:</span> Deal direct damage to enemies within range. Keep your tempo up!</li>
                            <li><span className="text-white font-medium">Abilities:</span> Use your abilities to fight harder enemies.</li>
                            <li><span className="text-white font-medium">Gear & Enhancements:</span> Manage your instrument's condition. Equip customized attachments and enhancements to maintain peak performance.</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-xl text-blue-400 tracking-wider uppercase mb-3 font-medium">Progression</h3>
                        <p>
                            Defeat enemies to gain experience and level up. Collect music sheets, raw materials, and components
                            to upgrade your gear in the Inventory (Press Z) or explore the environment to find secrets in the expanse beyond.
                        </p>
                    </section>
                </div>

                <div className="mt-12 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-blue-900/30 hover:bg-blue-800/50 text-blue-100 border border-blue-700/50 rounded transition-all duration-200 uppercase tracking-widest text-sm"
                    >
                        Understood
                    </button>
                </div>
            </div>
        </div>
    );
}
