'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/lib/store';
import AudioManager from '@/lib/audio/AudioManager';

/**
 * Hook to sync Settings Store audio values with the AudioManager.
 * Should be called once at the app root level.
 */
export function useAudioSettings() {
    const { master, music, sfx } = useSettingsStore((state) => state.audio);

    useEffect(() => {
        // Convert 0-100 scale to 0-1
        AudioManager.setGlobalVolume(master / 100);
    }, [master]);

    useEffect(() => {
        AudioManager.setCategoryVolume('music', music / 100);
    }, [music]);

    useEffect(() => {
        AudioManager.setCategoryVolume('sfx', sfx / 100);
    }, [sfx]);
}

export default useAudioSettings;
