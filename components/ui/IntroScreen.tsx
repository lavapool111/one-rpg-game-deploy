'use client';

import { useGameStore, usePlayerStore } from '@/lib/store';
import { useState, useEffect } from 'react';

const LORE_TEXT = [
    "Hello, band kid.",
    "Two long weeks have passed since the band room was sealed. Two brutal weeks since the brass section rose in rebellion. Two merciless weeks since they claimed the Stage—and every shadowed corridor behind it. The air has grown cold, the lights dim, and the echoes of their conquest still rattle the walls.",
    "Trumpets, trombones, horns, tubas, euphoniums… each section has carved out its domain, guarding the path forward with relentless sound. Yet deeper forces stir—ancient powers buried beneath centuries of collapse and reconstruction, locked away behind vaults and keys once forged by god-like mages, now scattered across the halls like forgotten notes.",
    "You have not escaped. You remain trapped within the band room's endless expanse. But the choice is yours: endure the silence, or rise against the brass and reclaim the Stage. The music of freedom waits to be played—if you can survive the symphony of war."
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

export function IntroScreen() {
    const { setGameState } = useGameStore();
    const [isVisible, setIsVisible] = useState(false);
    const [visibleParagraphs, setVisibleParagraphs] = useState<number>(0);
    const [isTyping, setIsTyping] = useState(true);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    const handleParagraphComplete = () => {
        if (visibleParagraphs < LORE_TEXT.length - 1) {
            // Wait a bit before starting the next paragraph
            setTimeout(() => {
                setVisibleParagraphs(prev => prev + 1);
            }, 800);
        } else {
            setIsTyping(false);
        }
    };

    const handleContinue = () => {
        setIsVisible(false);
        setTimeout(() => {
            setGameState('classSelect'); // Go to class selection after intro
        }, 500);
    };

    const handleSkip = () => {
        setIsVisible(false);
        setTimeout(() => {
            setGameState('playing');
        }, 300);
    };

    return (
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
            {/* Skip button */}
            <button
                onClick={handleSkip}
                className="absolute top-6 right-6 text-slate-500 hover:text-slate-300 text-sm uppercase tracking-wider transition-colors z-10"
            >
                Skip →
            </button>

            {/* Lore content */}
            <div className="max-w-3xl px-8 space-y-6 text-left">
                {LORE_TEXT.map((paragraph, index) => {
                    if (index > visibleParagraphs) return null;

                    const isLastVisible = index === visibleParagraphs;

                    if (isLastVisible && isTyping) {
                        return (
                            <TypewriterText
                                key={index}
                                text={paragraph}
                                speed={index === 0 ? 60 : 35} // Slower for better readability
                                onComplete={handleParagraphComplete}
                                className={`text-lg md:text-xl leading-relaxed ${index === 0
                                    ? 'text-yellow-400 font-semibold text-2xl md:text-3xl mb-4'
                                    : 'text-slate-300'
                                    }`}
                            />
                        );
                    }

                    return (
                        <p
                            key={index}
                            className={`text-lg md:text-xl leading-relaxed transition-opacity duration-500 ${index === 0
                                ? 'text-yellow-400 font-semibold text-2xl md:text-3xl mb-4'
                                : 'text-slate-300 opacity-80'
                                }`}
                        >
                            {paragraph}
                        </p>
                    );
                })}
            </div>

            {/* Continue button */}
            {!isTyping && (
                <button
                    onClick={handleContinue}
                    className="mt-12 px-8 py-4 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-500 hover:to-yellow-600 text-slate-950 font-bold uppercase tracking-wider text-lg transition-all duration-300 shadow-[0_0_30px_rgba(234,179,8,0.3)] hover:shadow-[0_0_40px_rgba(234,179,8,0.5)] animate-fade-in"
                >
                    Enter the Band Room
                </button>
            )}

            {/* Decorative elements */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-900/10 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none" />
        </div>
    );
}

export default IntroScreen;
