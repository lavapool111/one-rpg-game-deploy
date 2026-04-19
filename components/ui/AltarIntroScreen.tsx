'use client';

import { useGameStore, usePlayerStore } from '@/lib/store';
import { useState, useEffect } from 'react';
import { GAME_CONFIG } from '@/lib/game/config';

const ALTAR_LORE_TEXT = [
    "The Dark Altar is a hidden, seemingly endless chamber buried beneath the band room.",
    "It has long been overrun by the Ancient Brass, which have since evolved into the enemies players face today.",
    "No one knows whether this place ignited the rogue brass uprising or merely sheltered it.",
    "Players enter to survive waves of brass foes flooding from the altar and the Archduke statues, and uncover the true origin of the uprising once and for all."
];

interface TypewriterTextProps {
    text: string;
    speed?: number;
    delay?: number;
    onComplete?: () => void;
    className?: string;
}

function TypewriterText({ text, speed = 15, delay = 0, onComplete, className }: TypewriterTextProps) {
    const [displayText, setDisplayText] = useState('');
    const [isStarted, setIsStarted] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsStarted(true), delay);
        return () => clearTimeout(timer);
    }, [delay]);

    useEffect(() => {
        if (!isStarted) return;

        let currentIdx = 0;
        const interval = setInterval(() => {
            if (currentIdx < text.length) {
                setDisplayText(text.substring(0, currentIdx + 1));
                currentIdx++;
            } else {
                clearInterval(interval);
                if (onComplete) onComplete();
            }
        }, speed);

        return () => clearInterval(interval);
    }, [isStarted, text, speed, onComplete]);

    return <p className={className}>{displayText}</p>;
}

export function AltarIntroScreen() {
    const { hasSeenAltarIntro, setHasSeenAltarIntro, isInAltarRoom, setGameState, gameState } = useGameStore();
    const [isVisible, setIsVisible] = useState(false);
    const [visibleParagraphs, setVisibleParagraphs] = useState<number>(0);
    const [isTyping, setIsTyping] = useState(true);

    // Watch for entering the Altar Room
    useEffect(() => {
        if (isInAltarRoom && !hasSeenAltarIntro && gameState === 'playing' && !GAME_CONFIG.DISABLE_ALTAR_LORE) {
            setIsVisible(true);
            setGameState('altarIntro'); // Pause gameplay while reading without showing pause menu
        }
    }, [isInAltarRoom, hasSeenAltarIntro, gameState, setGameState]);

    const handleParagraphComplete = () => {
        if (visibleParagraphs < ALTAR_LORE_TEXT.length - 1) {
            // Wait a bit before starting the next paragraph
            setTimeout(() => {
                setVisibleParagraphs(prev => prev + 1);
            }, 800);
        } else {
            setIsTyping(false);
        }
    };

    function handleContinue(index: number) {
        setIsVisible(false);
        setHasSeenAltarIntro(true);
        setTimeout(() => {
            setGameState('playing');
        }, index);
    };

    if (!isVisible) return null;

    return (
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
            {/* Skip button */}
            <button
                onClick={() => handleContinue(300)}
                className="absolute top-6 right-6 text-slate-500 hover:text-slate-300 text-sm uppercase tracking-wider transition-colors z-10"
            >
                Skip →
            </button>

            {/* Lore content */}
            <div className="max-w-3xl px-8 space-y-6 text-center">
                {ALTAR_LORE_TEXT.map((paragraph, index) => {
                    if (index > visibleParagraphs) return null;

                    const isLastVisible = index === visibleParagraphs;

                    if (isLastVisible && isTyping) {
                        return (
                            <TypewriterText
                                key={index}
                                text={paragraph}
                                speed={35}
                                onComplete={handleParagraphComplete}
                                className="text-lg md:text-xl leading-relaxed text-slate-300"
                            />
                        );
                    }

                    return (
                        <p
                            key={index}
                            className="text-lg md:text-xl leading-relaxed transition-opacity duration-500 text-slate-300 opacity-80"
                        >
                            {paragraph}
                        </p>
                    );
                })}
            </div>

            {/* Continue button */}
            {!isTyping && (
                <button
                    onClick={() => handleContinue(500)}
                    className="mt-12 px-8 py-4 border-2 border-slate-600 hover:border-slate-400 text-slate-300 font-bold uppercase tracking-wider text-lg transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] animate-fade-in rounded-sm"
                >
                    Begin the Ritual
                </button>
            )}

            {/* Decorative elements */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900/40 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none" />
        </div>
    );
}

export default AltarIntroScreen;
