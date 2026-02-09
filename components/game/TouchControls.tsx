'use client';

import { useRef, useState } from 'react';
import { usePlayerStore } from '@/lib/store';

// Constants
const JOYSTICK_RADIUS = 50; // px
const JOYSTICK_CENTER_X = 100; // px from left
const JOYSTICK_CENTER_Y = 100; // px from bottom

export function TouchControls() {
    // Note: Visibility is now controlled by parent using settingsStore.isMobile

    // Store actions
    const setInputJoystick = usePlayerStore((state) => state.setInputJoystick);
    const setInputLook = usePlayerStore((state) => state.setInputLook);
    const attack = usePlayerStore((state) => state.attack);

    // Initial check for debugging (can remove later if strict check needed)
    // For now, let's allow it to render if we detect touch capability
    // if (!isTouchDevice) return null;

    return (
        <div className="absolute inset-0 z-50 pointer-events-none select-none touch-none overflow-hidden">
            {/* Left Side - Virtual Joystick Area */}
            <div className="absolute bottom-0 left-0 w-1/2 h-full pointer-events-auto">
                <VirtualJoystick
                    onMove={setInputJoystick}
                    radius={JOYSTICK_RADIUS}
                    centerX={JOYSTICK_CENTER_X}
                    centerY={JOYSTICK_CENTER_Y}
                />
            </div>

            {/* Right Side - Look Area & Attack Button */}
            <div className="absolute bottom-0 right-0 w-1/2 h-full pointer-events-auto">
                <LookArea onMove={setInputLook} />

                {/* Attack Button - Bottom Right */}
                <button
                    className="absolute bottom-8 right-8 w-24 h-24 bg-red-600/60 border-4 border-red-400 rounded-full active:bg-red-700/80 active:scale-95 transition-transform flex items-center justify-center backdrop-blur-sm"
                    onTouchStart={(e) => {
                        e.preventDefault();
                        attack();
                    }}
                    onMouseDown={(e) => {
                        // Testing support for mouse
                        e.preventDefault();
                        attack();
                    }}
                    onClick={(e) => {
                        // Prevent click from firing if touchstart handled it?
                        // Usually safe to leave for hybrid devices
                        attack();
                    }}
                >
                    <span className="text-white font-bold text-sm uppercase tracking-wider">Attack</span>
                </button>
            </div>
        </div>
    );
}

// === Subcomponents ===

interface VirtualJoystickProps {
    onMove: (x: number, y: number) => void;
    radius: number;
    centerX: number;
    centerY: number;
}

function VirtualJoystick({ onMove, radius, centerX, centerY }: VirtualJoystickProps) {
    const [active, setActive] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 }); // Relative to center
    const [origin, setOrigin] = useState({ x: centerX, y: centerY }); // Where the joystick effectively is

    // We used fixed positioning logic for simplicity of "floating" joystick
    // But basic requirement requested "Virtual Joystick (left side)".
    // A standard implementation is: user touches anywhere on left side -> that becomes center.

    const touchId = useRef<number | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        // Prevent default to stop scrolling/zooming
        // e.preventDefault(); // Note: might block click events if not careful, but this is a dedicated zone.

        const touch = e.changedTouches[0];
        if (touchId.current !== null) return; // Already active

        touchId.current = touch.identifier;
        setActive(true);

        // Set origin to where they touched, but clamp to screen bounds if needed?
        // Actually, "Floating Joystick" style is best for mobile action games.
        // The touch point becomes the center.
        const rect = e.currentTarget.getBoundingClientRect();
        // Calculate position relative to container
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        setOrigin({ x, y });
        setPosition({ x: 0, y: 0 });
        onMove(0, 0);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchId.current === null) return;

        // Find our touch
        const touch = Array.from(e.changedTouches).find(t => t.identifier === touchId.current);
        if (!touch) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;

        // Calculate delta
        let dx = touchX - origin.x;
        let dy = touchY - origin.y;

        // Clamp to radius
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > radius) {
            const angle = Math.atan2(dy, dx);
            dx = Math.cos(angle) * radius;
            dy = Math.sin(angle) * radius;
        }

        setPosition({ x: dx, y: dy });

        // Normalize output -1 to 1
        // In screen coords: y is down. But usually "up" on joystick is -1 y.
        // Let's standardise: Right = +1 X, Up = -1 Y.
        // Wait, standard 3D controls usually expect Forward (Up) to be -1 or +1 depending on engine.
        // In FirstPersonController:
        // moveForward = direction.current.z -= 1;
        // z- is forward in Three.js.
        // So joystick "Up" (negative screen Y) should map to Forward (negative world Z?), so -1.
        // joystick "Right" (positive screen X) -> +x.

        const normX = dx / radius;
        const normY = dy / radius; // Down is positive screen Y

        onMove(normX, normY);
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        const touch = Array.from(e.changedTouches).find(t => t.identifier === touchId.current);
        if (!touch) return;

        touchId.current = null;
        setActive(false);
        setPosition({ x: 0, y: 0 });
        onMove(0, 0);
    };

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
                            left: radius + position.x - 20, // 20 is half knob size
                            top: radius + position.y - 20,
                            width: 40,
                            height: 40,
                        }}
                    />
                </div>
            )}

            {/* Hint text if not active */}
            {!active && (
                <div className="absolute bottom-20 left-10 text-white/30 text-sm font-medium animate-pulse pointer-events-none">
                    Drag to Move
                </div>
            )}
        </div>
    );
}

interface LookAreaProps {
    onMove: (x: number, y: number) => void;
}

function LookArea({ onMove }: LookAreaProps) {
    const touchId = useRef<number | null>(null);
    const lastPos = useRef({ x: 0, y: 0 });

    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.changedTouches[0];
        if (touchId.current !== null) return;

        // Check if we touched the attack button? 
        // Bubbling might handle this, but since Attack Button is a sibling with higher z-index (or nested?), 
        // we relied on the parent division.
        // The attack button is a sibling in default export. This `LookArea` is a sibling to it.
        // But they are in the same generic "Right Side" container. 
        // Actually, in the main component: LookArea is rendered first, then Button.
        // But LookArea takes up w-full h-full of the container. 
        // If Button is absolutely positioned on top, it should capture events first.

        touchId.current = touch.identifier;
        lastPos.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchId.current === null) return;
        const touch = Array.from(e.changedTouches).find(t => t.identifier === touchId.current);
        if (!touch) return;

        const dx = touch.clientX - lastPos.current.x;
        const dy = touch.clientY - lastPos.current.y;

        lastPos.current = { x: touch.clientX, y: touch.clientY };

        onMove(dx, dy);
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        const touch = Array.from(e.changedTouches).find(t => t.identifier === touchId.current);
        if (!touch) return;
        touchId.current = null;
    };

    return (
        <div
            className="w-full h-full"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
        >
            {/* Hint text */}
            <div className="absolute top-1/2 right-10 text-white/30 text-sm font-medium pointer-events-none -translate-y-1/2">
                Drag to Look
            </div>
        </div>
    );
}
