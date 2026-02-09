export const GAME_CONFIG = {
    // Player Starting Stats
    STARTING_LEVEL: 750, // Change this to start at a higher level (e.g. 50)

    // Dungeon Settings
    BASE_DUNGEON_TIME: 20, // Base time limit in seconds (e.g. 300 for 5 mins)

    // Debug Flags
    INVINCIBLE: false, // Set to true to never take damage

    // Debug Starting Resources (set to 0 for normal gameplay)
    STARTING_ECHOES: 10000,
    STARTING_EMBOUCHURE: 10, // Embouchure level (1-10)

    // Debug Starting Materials (set all to 0 for normal gameplay)
    STARTING_MATERIALS: {
        valves: 10000,
        heavy_valves: 1000,
        reinforced_valves: 1000,
        infused_valves: 1000,
        trombone_slides: 10000,
        brass_ingots: 10000,
        reinforced_brass_ingots: 1000,
        infused_brass_ingots: 1000,
        moonlight_azarite: 1000,
        valve_oil: 1000,
        cork_grease: 1000,
        sheet_music_fragments: 1000,
        spit_valve_liquid: 100000,
    },
};
