'use client';

import { useRef, useState, useCallback } from 'react';
import { usePlayerStore } from '@/lib/store';

// Constants — viewport-relative sizing
const JOYSTICK_RADIUS = 50; // px — the drag radius

export function TouchControls() {
    const setInputJoystick = usePlayerStore((state) => state.setInputJoystick);
    const setInputLook = usePlayerStore((state) => state.setInputLook);
    const setInputJump = usePlayerStore((state) => state.setInputJump);
    const setInputSprint = usePlayerStore((state) => state.setInputSprint);

    return (
        <div className="absolute inset-0 z-40 pointer-events-none select-none touch-none overflow-hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            {/* Left Side — Virtual Joystick + Jump */}
            <div className="absolute bottom-0 left-0 w-1/2 h-full pointer-events-auto">
                <VirtualJoystick
                    onMove={setInputJoystick}
                    onSprintChange={setInputSprint}
                    radius={JOYSTICK_RADIUS}
                />

                {/* Jump Button — above the joystick zone */}
                <JumpButton onJump={setInputJump} />
            </div>

            {/* Right Side — Look Area */}
            <div className="absolute bottom-0 right-0 w-1/2 h-full pointer-events-auto">
                <LookArea onMove={setInputLook} />
            </div>
        </div>
    );
}

// === Jump Button ===
interface JumpButtonProps {
    onJump: (jumping: boolean) => void;
}

function JumpButton({ onJump }: JumpButtonProps) {
    return (
        <button
            className="absolute left-[6vw] bottom-[38vh] w-14 h-14 bg-white/10 border-2 border-white/30 rounded-full active:bg-white/30 active:scale-90 transition-transform flex items-center justify-center backdrop-blur-sm"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            onTouchStart={(e) => {
                e.preventDefault();
                onJump(true);
            }}
            onTouchEnd={(e) => {
                e.preventDefault();
                onJump(false);
            }}
            onTouchCancel={() => onJump(false)}
        >
            <span className="text-white/80 text-lg font-bold">↑</span>
        </button>
    );
}

// === Virtual Joystick ===

interface VirtualJoystickProps {
    onMove: (x: number, y: number) => void;
    onSprintChange: (sprinting: boolean) => void;
    radius: number;
}

const SPRINT_THRESHOLD = 0.85; // Auto-sprint when joystick pushed past 85%

function VirtualJoystick({ onMove, onSprintChange, radius }: VirtualJoystickProps) {
    const [active, setActive] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [origin, setOrigin] = useState({ x: 0, y: 0 });
    const touchId = useRef<number | null>(null);
    const [hintHidden, setHintHidden] = useState(false);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.changedTouches[0];
        if (touchId.current !== null) return;

        touchId.current = touch.identifier;
        setActive(true);
        setHintHidden(true);

        const rect = e.currentTarget.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        setOrigin({ x, y });
        setPosition({ x: 0, y: 0 });
        onMove(0, 0);
    }, [onMove]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (touchId.current === null) return;

        const touch = Array.from(e.changedTouches).find(t => t.identifier === touchId.current);
        if (!touch) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;

        let dx = touchX - origin.x;
        let dy = touchY - origin.y;

        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > radius) {
            const angle = Math.atan2(dy, dx);
            dx = Math.cos(angle) * radius;
            dy = Math.sin(angle) * radius;
        }

        setPosition({ x: dx, y: dy });

        const normX = dx / radius;
        const normY = dy / radius;
        onMove(normX, normY);

        // Auto-sprint when pushed past threshold
        const magnitude = Math.sqrt(normX * normX + normY * normY);
        onSprintChange(magnitude >= SPRINT_THRESHOLD);
    }, [origin, radius, onMove, onSprintChange]);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        const touch = Array.from(e.changedTouches).find(t => t.identifier === touchId.current);
        if (!touch) return;

        touchId.current = null;
        setActive(false);
        setPosition({ x: 0, y: 0 });
        onMove(0, 0);
        onSprintChange(false);
    }, [onMove, onSprintChange]);

    return (
        <div
            className="w-full h-full relative"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
        >
            {active && (
                <div
                    className="absolute rounded-full bg-white/10 border-2 border-white/30 pointer-events-none backdrop-blur-sm"
                    style={{
                        left: origin.x - radius,
                        top: origin.y - radius,
                        width: radius * 2,
                        height: radius * 2,
                    }}
                >
                    <div
                        className="absolute bg-white/80 rounded-full shadow-lg"
                        style={{
                            left: radius + position.x - 20,
                            top: radius + position.y - 20,
                            width: 40,
                            height: 40,
                        }}
                    />
                </div>
            )}

            {/* Hint text — hidden after first use */}
            {!active && !hintHidden && (
                <div className="absolute bottom-[18vh] left-[6vw] text-white/30 text-sm font-medium animate-pulse pointer-events-none">
                    Drag to Move
                </div>
            )}
        </div>
    );
}

// === Look Area ===

interface LookAreaProps {
    onMove: (x: number, y: number) => void;
}

function LookArea({ onMove }: LookAreaProps) {
    const touchId = useRef<number | null>(null);
    const lastPos = useRef({ x: 0, y: 0 });
    const [hintHidden, setHintHidden] = useState(false);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.changedTouches[0];
        if (touchId.current !== null) return;

        touchId.current = touch.identifier;
        lastPos.current = { x: touch.clientX, y: touch.clientY };
        setHintHidden(true);
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (touchId.current === null) return;
        const touch = Array.from(e.changedTouches).find(t => t.identifier === touchId.current);
        if (!touch) return;

        const dx = touch.clientX - lastPos.current.x;
        const dy = touch.clientY - lastPos.current.y;
        lastPos.current = { x: touch.clientX, y: touch.clientY };

        onMove(dx, dy);
    }, [onMove]);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        const touch = Array.from(e.changedTouches).find(t => t.identifier === touchId.current);
        if (!touch) return;
        touchId.current = null;
    }, []);

    return (
        <div
            className="w-full h-full"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
        >
            {/* Hint text — hidden after first use */}
            {!hintHidden && (
                <div className="absolute top-1/2 right-[6vw] text-white/30 text-sm font-medium pointer-events-none -translate-y-1/2">
                    Drag to Look
                </div>
            )}
        </div>
    );
}
