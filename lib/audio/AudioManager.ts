import { Howl, Howler } from 'howler';

export type AudioCategory = 'sfx' | 'music' | 'ui' | 'voice';

export interface PlayOptions {
    volume?: number;
    loop?: boolean;
    rate?: number;
    // Spatial options
    pos?: [number, number, number]; // x, y, z
    pannerAttr?: {
        panningModel?: 'HRTF' | 'equalpower';
        refDistance?: number;
        maxDistance?: number;
        rolloffFactor?: number;
        distanceModel?: 'linear' | 'inverse';
    };
}

class AudioManager {
    private static instance: AudioManager;

    private sounds: Map<string, Howl> = new Map();
    private volumes: Record<AudioCategory, number> = {
        sfx: 1.0,
        music: 0.5, // Default lower for music
        ui: 1.0,
        voice: 1.0
    };
    private globalVolume: number = 1.0;
    private isMuted: boolean = false;

    private constructor() {
        // Initialize global Howler listener position (default 0,0,0)
        Howler.pos(0, 0, 0);
    }

    public static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    /**
     * Load a sound into the manager
     */
    public load(key: string, src: string | string[], options: Partial<PlayOptions> = {}) {
        if (this.sounds.has(key)) return;

        const sound = new Howl({
            src: Array.isArray(src) ? src : [src],
            ...options,
            preload: true,
        });

        this.sounds.set(key, sound);
    }

    /**
     * Play a sound by key
     */
    public play(key: string, category: AudioCategory = 'sfx', options: PlayOptions = {}): number | null {
        const sound = this.sounds.get(key);
        if (!sound) {
            console.warn(`Sound not found: ${key}`);
            return null;
        }

        const id = sound.play();

        // Apply Category Volume * Global Volume * Instance Volume
        const catVol = this.volumes[category];
        const instVol = options.volume ?? 1.0;
        sound.volume(catVol * this.globalVolume * instVol, id);

        // Apply other options
        if (options.loop !== undefined) sound.loop(options.loop, id);
        if (options.rate !== undefined) sound.rate(options.rate, id);

        // Spatial Audio
        if (options.pos) {
            sound.pos(options.pos[0], options.pos[1], options.pos[2], id);

            if (options.pannerAttr) {
                sound.pannerAttr(options.pannerAttr, id);
            } else {
                // Default decent spatial settings
                sound.pannerAttr({
                    panningModel: 'HRTF',
                    refDistance: 5,
                    maxDistance: 50,
                    rolloffFactor: 1,
                    distanceModel: 'linear'
                } as any, id); // cast as any to avoid strict type checks if howler types vary version to version
            }
        }

        return id;
    }

    /**
     * Stop a sound
     */
    public stop(key: string, id?: number) {
        const sound = this.sounds.get(key);
        if (sound) {
            sound.stop(id);
        }
    }

    /**
     * Set global volume (master)
     */
    public setGlobalVolume(vol: number) {
        this.globalVolume = Math.max(0, Math.min(1, vol));
        Howler.volume(this.isMuted ? 0 : this.globalVolume);
    }

    /**
     * Set category volume
     */
    public setCategoryVolume(category: AudioCategory, vol: number) {
        this.volumes[category] = Math.max(0, Math.min(1, vol));
        // Note: This won't update currently playing sounds dynamically unless we track them.
        // For a simple implementation, it mainly affects next plays.
        // To do it dynamically, we'd need to track active IDs per category.
    }

    /**
     * Mute/Unmute
     */
    public setMute(muted: boolean) {
        this.isMuted = muted;
        Howler.mute(muted);
    }

    /**
     * Update listener position (Player position)
     */
    public setListenerPosition(x: number, y: number, z: number) {
        Howler.pos(x, y, z);
    }

    /**
     * Update orientation (Front/Up vectors)
     * Howler/WebAudio expects forward x,y,z and up x,y,z
     */
    public setListenerOrientation(fx: number, fy: number, fz: number, ux: number, uy: number, uz: number) {
        Howler.orientation(fx, fy, fz, ux, uy, uz);
    }
}

export default AudioManager.getInstance();
