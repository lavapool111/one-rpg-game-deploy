'use client';

import { usePlayerStore, useSettingsStore } from '@/lib/store';
import { useEffect, useState } from 'react';
import { getAbilityName, CLASS_INFO, type PlayerClass } from '@/lib/store/playerStore';

/**
 * CombatHUD Component
 * Displays combat controls with both Long Tone (ability 1) and Overtone/Overdrive (ability 2) buttons.
 * Positioned in the bottom-right corner.
 */

// Helper to get ability 2 name based on class
function getAbility2Name(playerClass: PlayerClass): string {
  switch (playerClass) {
    case 'viola':
      return 'Overdrive';
    case 'bb_clarinet':
    default:
      return 'Overtone';
  }
}

// Helper to get ability 2 icon based on class
function getAbility2Icon(playerClass: PlayerClass): string {
  switch (playerClass) {
    case 'viola':
      return '⚡';
    case 'bb_clarinet':
    default:
      return '🎺';
  }
}
export function CombatHUD() {
  // Long Tone (Ability 1) state
  const isLongToneActive = usePlayerStore((state) => state.isLongToneActive);
  const longToneCooldown = usePlayerStore((state) => state.longToneCooldown);
  const longToneTotalCooldown = usePlayerStore((state) => state.longToneTotalCooldown);
  const triggerLongTone = usePlayerStore((state) => state.triggerLongTone);
  const playerClass = usePlayerStore((state) => state.playerClass);

  // Overtone/Overdrive (Ability 2) state
  const isOvertoneActive = usePlayerStore((state) => state.isOvertoneActive);
  const overtoneCooldown = usePlayerStore((state) => state.overtoneCooldown);
  const overtoneTotalCooldown = usePlayerStore((state) => state.overtoneTotalCooldown);
  const triggerOvertone = usePlayerStore((state) => state.triggerOvertone);

  // Get mobile state for positioning
  const isMobile = useSettingsStore((state) => state.isMobile);

  // Ability 1 timer state
  const [timeLeft1, setTimeLeft1] = useState(0);
  const [progress1, setProgress1] = useState(1);

  // Ability 2 timer state
  const [timeLeft2, setTimeLeft2] = useState(0);
  const [progress2, setProgress2] = useState(1);

  // Key binding for ability 1
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (e.key === '1') {
        const state = usePlayerStore.getState();
        const now = Date.now();
        if (now >= state.longToneCooldown) {
          state.triggerLongTone();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Key binding for ability 2
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (e.key === '2') {
        const state = usePlayerStore.getState();
        const now = Date.now();
        if (now >= state.overtoneCooldown) {
          state.triggerOvertone();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Update ability 1 timer
  useEffect(() => {
    let animationFrame: number;

    const updateState = () => {
      const now = Date.now();
      if (now < longToneCooldown) {
        const remaining = longToneCooldown - now;
        setTimeLeft1(remaining / 1000);
        setProgress1(1 - (remaining / longToneTotalCooldown));
        animationFrame = requestAnimationFrame(updateState);
      } else {
        setTimeLeft1(0);
        setProgress1(1);
      }
    };

    if (longToneCooldown > Date.now()) {
      updateState();
    } else {
      setTimeLeft1(0);
      setProgress1(1);
    }

    return () => cancelAnimationFrame(animationFrame);
  }, [longToneCooldown, longToneTotalCooldown]);

  // Update ability 2 timer
  useEffect(() => {
    let animationFrame: number;

    const updateState = () => {
      const now = Date.now();
      if (now < overtoneCooldown) {
        const remaining = overtoneCooldown - now;
        setTimeLeft2(remaining / 1000);
        setProgress2(1 - (remaining / overtoneTotalCooldown));
        animationFrame = requestAnimationFrame(updateState);
      } else {
        setTimeLeft2(0);
        setProgress2(1);
      }
    };

    if (overtoneCooldown > Date.now()) {
      updateState();
    } else {
      setTimeLeft2(0);
      setProgress2(1);
    }

    return () => cancelAnimationFrame(animationFrame);
  }, [overtoneCooldown, overtoneTotalCooldown]);

  const handleAttack1 = () => {
    if (timeLeft1 <= 0) {
      triggerLongTone();
    }
  };

  const handleAttack2 = () => {
    if (timeLeft2 <= 0) {
      triggerOvertone();
    }
  };

  return (
    <div className={`absolute bottom-8 pointer-events-auto z-50 transition-all duration-300 ${isMobile ? 'right-4' : 'right-8'} flex gap-3 items-end`}>
      {/* Ability 1 Button - Long Tone/Sustained Bow */}
      <div className="flex flex-col items-center">
        <button
          onClick={handleAttack1}
          onTouchStart={(e) => { e.preventDefault(); handleAttack1(); }}
          disabled={timeLeft1 > 0 || isLongToneActive}
          className={`
            relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center
            border-4 transition-all duration-200
            ${isLongToneActive
              ? 'bg-red-500/50 border-red-400 scale-110 shadow-[0_0_20px_rgba(239,68,68,0.6)]'
              : timeLeft1 > 0
                ? 'bg-gray-900/80 border-gray-700 opacity-80 cursor-not-allowed'
                : 'bg-indigo-600/90 border-indigo-400 hover:bg-indigo-500 hover:scale-105 active:scale-95 shadow-lg'
            }
          `}
        >
          {/* Cooldown Overlay */}
          {timeLeft1 > 0 && (
            <div
              className="absolute inset-0 bg-black/60 rounded-full"
              style={{ clipPath: `conic-gradient(transparent ${progress1 * 360}deg, black 0deg)` }}
            />
          )}

          {/* Icon/Text */}
          <div className="flex flex-col items-center z-10">
            <span className="text-xl mb-0.5">{CLASS_INFO[playerClass].icon}</span>
            <span className="text-[9px] font-bold text-white uppercase tracking-wider">
              {isLongToneActive ? 'ACTIVE' : timeLeft1 > 0 ? timeLeft1.toFixed(1) : getAbilityName(playerClass)}
            </span>
          </div>

          {/* Ring Timer (Visual Flair) */}
          {timeLeft1 > 0 && (
            <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
              <circle
                cx="50%"
                cy="50%"
                r="36"
                fill="none"
                stroke="white"
                strokeOpacity="0.3"
                strokeWidth="2"
                strokeDasharray="226"
                strokeDashoffset={226 * (1 - progress1)}
              />
            </svg>
          )}
        </button>

        {/* Keyboard Hint */}
        <div className="mt-1 text-white/50 text-xs font-mono whitespace-nowrap">
          {isMobile ? 'TAP' : '[1]'}
        </div>
      </div>

      {/* Ability 2 Button - Overtone/Overdrive */}
      <div className="flex flex-col items-center">
        <button
          onClick={handleAttack2}
          onTouchStart={(e) => { e.preventDefault(); handleAttack2(); }}
          disabled={timeLeft2 > 0 || isOvertoneActive}
          className={`
            relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center
            border-4 transition-all duration-200
            ${isOvertoneActive
              ? 'bg-amber-500/50 border-amber-400 scale-110 shadow-[0_0_20px_rgba(245,158,11,0.6)]'
              : timeLeft2 > 0
                ? 'bg-gray-900/80 border-gray-700 opacity-80 cursor-not-allowed'
                : 'bg-amber-600/90 border-amber-400 hover:bg-amber-500 hover:scale-105 active:scale-95 shadow-lg'
            }
          `}
        >
          {/* Cooldown Overlay */}
          {timeLeft2 > 0 && (
            <div
              className="absolute inset-0 bg-black/60 rounded-full"
              style={{ clipPath: `conic-gradient(transparent ${progress2 * 360}deg, black 0deg)` }}
            />
          )}

          {/* Icon/Text */}
          <div className="flex flex-col items-center z-10">
            <span className="text-xl mb-0.5">{getAbility2Icon(playerClass)}</span>
            <span className="text-[9px] font-bold text-white uppercase tracking-wider">
              {isOvertoneActive ? 'ACTIVE' : timeLeft2 > 0 ? timeLeft2.toFixed(1) : getAbility2Name(playerClass)}
            </span>
          </div>

          {/* Ring Timer (Visual Flair) */}
          {timeLeft2 > 0 && (
            <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
              <circle
                cx="50%"
                cy="50%"
                r="36"
                fill="none"
                stroke="white"
                strokeOpacity="0.3"
                strokeWidth="2"
                strokeDasharray="226"
                strokeDashoffset={226 * (1 - progress2)}
              />
            </svg>
          )}
        </button>

        {/* Keyboard Hint */}
        <div className="mt-1 text-white/50 text-xs font-mono whitespace-nowrap">
          {isMobile ? 'TAP' : '[2]'}
        </div>
      </div>

      {/* Mobile Basic Attack Button */}
      {isMobile && (
        <div className="flex flex-col items-center">
          <MobileAttackButton />
          <div className="mt-1 text-white/50 text-xs font-mono whitespace-nowrap">
            ATK
          </div>
        </div>
      )}
    </div>
  );
}

export default CombatHUD;

function MobileAttackButton() {
  const attack = usePlayerStore((state) => state.attack);

  return (
    <button
      className="relative w-20 h-20 rounded-full flex items-center justify-center border-4 transition-all duration-200 bg-red-600/80 border-red-400 active:bg-red-700 active:scale-90 shadow-[0_0_15px_rgba(239,68,68,0.4)]"
      onTouchStart={(e) => {
        e.preventDefault();
        attack();
      }}
    >
      <div className="flex flex-col items-center z-10">
        <span className="text-2xl mb-0.5">⚔️</span>
        <span className="text-[9px] font-bold text-white uppercase tracking-wider">Attack</span>
      </div>
    </button>
  );
}
