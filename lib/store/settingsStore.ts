"use client";

import { create } from "zustand";
import { subscribeWithSelector, persist, createJSONStorage } from "zustand/middleware";

/**
 * Settings Store
 * Persistent settings for audio, graphics, and controls
 */

export interface AudioSettings {
  master: number; // 0-100
  music: number;  // 0-100
  sfx: number;    // 0-100
}

export interface GraphicsSettings {
  quality: 'low' | 'normal' | 'high';
  brightness: number; // 0-100 (50 = default)
}

export interface ControlsSettings {
  mouseSensitivity: number; // 0.1-3.0 (1.0 = default)
}

export interface SettingsState {
  audio: AudioSettings;
  graphics: GraphicsSettings;
  controls: ControlsSettings;

  // Actions
  setMasterVolume: (value: number) => void;
  setMusicVolume: (value: number) => void;
  setSfxVolume: (value: number) => void;
  setQuality: (value: 'low' | 'normal' | 'high') => void;
  setBrightness: (value: number) => void;
  setMouseSensitivity: (value: number) => void;
  resetToDefaults: () => void;
}

const DEFAULT_SETTINGS = {
  audio: {
    master: 100,
    music: 50,
    sfx: 100,
  },
  graphics: {
    quality: 'normal' as const,
    brightness: 50,
  },
  controls: {
    mouseSensitivity: 1.0,
  },
};

export const useSettingsStore = create<SettingsState>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        ...DEFAULT_SETTINGS,

        setMasterVolume: (value) => set((state) => ({
          audio: { ...state.audio, master: Math.max(0, Math.min(100, value)) }
        })),

        setMusicVolume: (value) => set((state) => ({
          audio: { ...state.audio, music: Math.max(0, Math.min(100, value)) }
        })),

        setSfxVolume: (value) => set((state) => ({
          audio: { ...state.audio, sfx: Math.max(0, Math.min(100, value)) }
        })),

        setQuality: (value) => set((state) => ({
          graphics: { ...state.graphics, quality: value }
        })),

        setBrightness: (value) => set((state) => ({
          graphics: { ...state.graphics, brightness: Math.max(0, Math.min(100, value)) }
        })),

        setMouseSensitivity: (value) => set((state) => ({
          controls: { ...state.controls, mouseSensitivity: Math.max(0.1, Math.min(3.0, value)) }
        })),

        resetToDefaults: () => set(DEFAULT_SETTINGS),
      }),
      {
        name: 'one-rpg-settings', // localStorage key
        storage: createJSONStorage(() => localStorage),
      }
    )
  )
);

export default useSettingsStore;
