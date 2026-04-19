// ============= GAME CONFIGURATION =============
// Three presets: one for normal gameplay, one for the Backstage Halls demo, one for the Altar Room demo.
// Call setActiveConfig('backstage_halls') or setActiveConfig('altar_room') from the demo page to switch.

type GameConfig = {
    STARTING_LEVEL: number;
    BASE_DUNGEON_TIME: number;
    INVINCIBLE: boolean;
    STARTING_ECHOES: number;
    STARTING_EMBOUCHURE: number;
    STARTING_SPEED: number;
    STARTING_JUMP_FORCE: number;
    GRAVITY: number;
    SPRINT_FACTOR: number;
    DISABLE_ALTAR_GATES: boolean;
    DISABLE_ALTAR_LORE: boolean;
    AUTO_BUILD: boolean;
    STARTING_MATERIALS: {
        valves: number;
        heavy_valves: number;
        reinforced_valves: number;
        infused_valves: number;
        trombone_slides: number;
        brass_ingots: number;
        reinforced_brass_ingots: number;
        infused_brass_ingots: number;
        moonlight_azarite: number;
        valve_oil: number;
        cork_grease: number;
        sheet_music_fragments_common: number;
        sheet_music_fragments_rare: number;
        sheet_music_fragments_legendary: number;
        spit_valve_liquid: number;
        brass_essence: number;
    };
};

// --- Normal Game (main page) ---
export const NORMAL_CONFIG: GameConfig = {
    // Player Starting Stats
    STARTING_LEVEL: 1,

    // Dungeon Settings
    BASE_DUNGEON_TIME: 20, // seconds

    // Debug Flags
    INVINCIBLE: false,

    // Debug Starting Resources
    STARTING_ECHOES: 0,
    STARTING_EMBOUCHURE: 1,
    STARTING_SPEED: 7.5, // Default for now, can be changed easily
    STARTING_JUMP_FORCE: 18, // Optimized for snappier jumping.
    GRAVITY: 60, // Optimized for slightly faster jumping.
    SPRINT_FACTOR: 2,
    DISABLE_ALTAR_GATES: false,
    DISABLE_ALTAR_LORE: false,
    AUTO_BUILD: false,

    // Debug Starting Materials (set all to 0 for normal gameplay)
    STARTING_MATERIALS: {
        valves: 0,
        heavy_valves: 0,
        reinforced_valves: 0,
        infused_valves: 0,
        trombone_slides: 0,
        brass_ingots: 0,
        reinforced_brass_ingots: 0,
        infused_brass_ingots: 0,
        moonlight_azarite: 0,
        valve_oil: 0,
        cork_grease: 0,
        sheet_music_fragments_common: 0,
        sheet_music_fragments_rare: 0,
        sheet_music_fragments_legendary: 0,
        spit_valve_liquid: 0,
        brass_essence: 0,
    },
};

// --- Backstage Halls Demo ---
export const BACKSTAGE_HALLS_CONFIG: GameConfig = {
    // Start at a higher level for dungeon testing
    STARTING_LEVEL: 756,

    // Longer dungeon time for exploration
    BASE_DUNGEON_TIME: 3300,

    // Debug Flags
    INVINCIBLE: false,

    // Starting Resources
    STARTING_ECHOES: 0,
    STARTING_EMBOUCHURE: 10,
    STARTING_SPEED: 14.0, // Increased for faster testing explorations
    STARTING_JUMP_FORCE: 12,
    GRAVITY: 30,
    SPRINT_FACTOR: 2,
    DISABLE_ALTAR_GATES: false,
    DISABLE_ALTAR_LORE: false,
    AUTO_BUILD: false,

    // Starting Materials
    STARTING_MATERIALS: {
        valves: 0,
        heavy_valves: 0,
        reinforced_valves: 0,
        infused_valves: 0,
        trombone_slides: 0,
        brass_ingots: 0,
        reinforced_brass_ingots: 0,
        infused_brass_ingots: 0,
        moonlight_azarite: 0,
        valve_oil: 0,
        cork_grease: 0,
        sheet_music_fragments_common: 0,
        sheet_music_fragments_rare: 0,
        sheet_music_fragments_legendary: 0,
        spit_valve_liquid: 0,
        brass_essence: 0,
    },
};

// --- Altar Room Demo ---
export const ALTAR_ROOM_CONFIG: GameConfig = {
    // High level for Altar testing
    STARTING_LEVEL: 1000000,

    // Long time for testing
    BASE_DUNGEON_TIME: 1800,

    // Debug Flags
    INVINCIBLE: false,

    // Starting Resources
    STARTING_ECHOES: 1000000,
    STARTING_EMBOUCHURE: 540,
    STARTING_SPEED: 15,
    STARTING_JUMP_FORCE: 12,
    GRAVITY: 30,
    SPRINT_FACTOR: 4,
    DISABLE_ALTAR_GATES: true,
    DISABLE_ALTAR_LORE: true,
    AUTO_BUILD: true,

    // Starting Materials
    STARTING_MATERIALS: {
        valves: 1000000,
        heavy_valves: 1000000,
        reinforced_valves: 1000000,
        infused_valves: 1000000,
        trombone_slides: 1000000,
        brass_ingots: 1000000,
        reinforced_brass_ingots: 1000000,
        infused_brass_ingots: 1000000,
        moonlight_azarite: 1000000,
        valve_oil: 1000000,
        cork_grease: 1000000,
        sheet_music_fragments_common: 1000000,
        sheet_music_fragments_rare: 1000000,
        sheet_music_fragments_legendary: 1000000,
        spit_valve_liquid: 1000000,
        brass_essence: 1000000,
    },
};

// --- Active config (defaults to normal) ---
export let GAME_CONFIG: GameConfig = { ...NORMAL_CONFIG };

export function setActiveConfig(preset: 'normal' | 'backstage_halls' | 'altar_room') {
    if (preset === 'backstage_halls') {
        GAME_CONFIG = { ...BACKSTAGE_HALLS_CONFIG };
    } else if (preset === 'altar_room') {
        GAME_CONFIG = { ...ALTAR_ROOM_CONFIG };
    } else {
        GAME_CONFIG = { ...NORMAL_CONFIG };
    }
}
