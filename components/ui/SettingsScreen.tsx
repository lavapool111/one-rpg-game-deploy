'use client';

import { useSettingsStore } from '@/lib/store';
import { useState } from 'react';

/**
 * SettingsScreen Component
 * UI for adjusting audio, graphics, and control settings
 */

interface SettingsScreenProps {
    onClose: () => void;
}

export function SettingsScreen({ onClose }: SettingsScreenProps) {
    const {
        audio,
        graphics,
        controls,
        setMasterVolume,
        setMusicVolume,
        setSfxVolume,
        setQuality,
        setBrightness,
        setMouseSensitivity,
        resetToDefaults
    } = useSettingsStore();

    const [activeTab, setActiveTab] = useState<'audio' | 'graphics' | 'controls'>('audio');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900/95 border border-yellow-600/30 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-yellow-600/20">
                    <h2 className="text-2xl font-bold text-yellow-500 uppercase tracking-wider">Settings</h2>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors text-xl"
                    >
                        ✕
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-yellow-600/20">
                    {(['audio', 'graphics', 'controls'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-3 text-sm font-medium uppercase tracking-wider transition-colors ${
                                activeTab === tab
                                    ? 'text-yellow-400 border-b-2 border-yellow-500 bg-yellow-900/10'
                                    : 'text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                    {activeTab === 'audio' && (
                        <div className="space-y-5">
                            <SettingSlider
                                label="Master Volume"
                                value={audio.master}
                                onChange={setMasterVolume}
                                min={0}
                                max={100}
                            />
                            <SettingSlider
                                label="Music Volume"
                                value={audio.music}
                                onChange={setMusicVolume}
                                min={0}
                                max={100}
                            />
                            <SettingSlider
                                label="SFX Volume"
                                value={audio.sfx}
                                onChange={setSfxVolume}
                                min={0}
                                max={100}
                            />
                        </div>
                    )}

                    {activeTab === 'graphics' && (
                        <div className="space-y-5">
                            {/* Quality Dropdown */}
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">Quality Preset</label>
                                <select
                                    value={graphics.quality}
                                    onChange={(e) => setQuality(e.target.value as 'low' | 'normal' | 'high')}
                                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-yellow-500 focus:outline-none"
                                >
                                    <option value="low">Low</option>
                                    <option value="normal">Normal</option>
                                    <option value="high">High</option>
                                </select>
                            </div>

                            <SettingSlider
                                label="Brightness"
                                value={graphics.brightness}
                                onChange={setBrightness}
                                min={0}
                                max={100}
                            />
                        </div>
                    )}

                    {activeTab === 'controls' && (
                        <div className="space-y-5">
                            <SettingSlider
                                label="Mouse Sensitivity"
                                value={controls.mouseSensitivity}
                                onChange={setMouseSensitivity}
                                min={0.1}
                                max={3.0}
                                step={0.1}
                                displayMultiplier={1}
                                suffix="x"
                            />
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center px-6 py-4 border-t border-yellow-600/20 bg-slate-900/50">
                    <button
                        onClick={resetToDefaults}
                        className="text-slate-400 hover:text-red-400 text-sm transition-colors"
                    >
                        Reset to Defaults
                    </button>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-black font-bold rounded-lg transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}

// Reusable Slider Component
interface SettingSliderProps {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step?: number;
    displayMultiplier?: number;
    suffix?: string;
}

function SettingSlider({
    label,
    value,
    onChange,
    min,
    max,
    step = 1,
    displayMultiplier = 1,
    suffix = ''
}: SettingSliderProps) {
    const displayValue = (value * displayMultiplier).toFixed(step < 1 ? 1 : 0);

    return (
        <div>
            <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-300">{label}</span>
                <span className="text-yellow-400 font-mono">{displayValue}{suffix}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
            />
        </div>
    );
}

export default SettingsScreen;
