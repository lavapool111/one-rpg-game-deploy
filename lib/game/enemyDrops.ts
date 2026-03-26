function roll(chance: number): boolean {
    return Math.random() < chance;
}

function rand(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function add(drops: Record<string, number>, item: string, amount: number = 1) {
    if (amount <= 0) return;
    drops[item] = (drops[item] || 0) + amount;
}

function addTieredFragments(drops: Record<string, number>, prefix: string, level: number, thresholds?: { t: number, min: number, max: number, chance: number }[]) {
    const defaultThresholds = [
        { t: 1, min: 1, max: 1000000, chance: 0.10 },
        { t: 2, min: 30, max: 1000000, chance: 0.075 },
        { t: 3, min: 120, max: 1000000, chance: 0.035 },
        { t: 4, min: 250, max: 1000000, chance: 0.015 },
        { t: 5, min: 750, max: 1000000, chance: 0.003 },
    ];

    const items = thresholds || defaultThresholds;
    for (const item of items) {
        if (level >= item.min && level <= item.max && roll(item.chance)) {
            add(drops, `${prefix}_fragment_t${item.t}`);
        }
    }
}

export function getTrumpetDrops(level: number, currentLocation: string): Record<string, number> {
    const drops: Record<string, number> = {};

    if (currentLocation !== 'backstage_halls') {
        add(drops, 'echoes', rand(1, 2));
        add(drops, 'valves', rand(1, 2));

        const rollVal = Math.random();
        if (rollVal < 0.25) add(drops, 'sheet_music_fragments_common');
        else if (rollVal < 0.30) add(drops, 'sheet_music_fragments_rare');
        else if (rollVal < 0.31) add(drops, 'sheet_music_fragments_legendary');

        if (roll(0.05)) add(drops, 'valve_oil');
        if (roll(0.15)) add(drops, 'brass_ingots');
        if (roll(0.04)) add(drops, 'brass_essence');
    }

    addTieredFragments(drops, 'plated', level);

    return drops;
}

export function getTromboneDrops(level: number, currentLocation: string): Record<string, number> {
    const drops: Record<string, number> = {};

    if (currentLocation !== 'backstage_halls') {
        add(drops, 'echoes', rand(2, 3));
        if (roll(0.50)) add(drops, 'trombone_slides', Math.round(Math.random() * (2 + (level / 50))));

        const rollVal = Math.random();
        if (rollVal < 0.35) add(drops, 'sheet_music_fragments_common');
        else if (rollVal < 0.43) add(drops, 'sheet_music_fragments_rare');
        else if (rollVal < 0.45) add(drops, 'sheet_music_fragments_legendary');

        if (roll(0.30)) add(drops, 'brass_ingots');
        if (roll(0.06)) add(drops, 'brass_essence');
    }

    addTieredFragments(drops, 'sundered', level);

    return drops;
}

export function getTubaDrops(level: number, currentLocation: string): Record<string, number> {
    const drops: Record<string, number> = {};

    if (currentLocation !== 'backstage_halls') {
        add(drops, 'echoes', Math.floor(4 + (level / 15)));
        add(drops, 'valves', rand(2, 4));
        add(drops, 'heavy_valves', rand(1, 2));
        if (roll(0.20)) add(drops, 'valve_oil');

        const rollVal = Math.random();
        if (rollVal < 0.50) add(drops, 'sheet_music_fragments_common');
        else if (rollVal < 0.60) add(drops, 'sheet_music_fragments_rare');
        else if (rollVal < 0.62) add(drops, 'sheet_music_fragments_legendary');

        add(drops, 'brass_ingots', 2);
        if (roll(0.12)) add(drops, 'brass_essence');
    }

    addTieredFragments(drops, 'metallic', level);

    return drops;
}

export function getFrenchHornDrops(level: number, currentLocation: string): Record<string, number> {
    const drops: Record<string, number> = {};

    if (currentLocation !== 'backstage_halls') {
        add(drops, 'echoes', rand(2, 3));
        if (roll(0.50)) add(drops, 'valves');

        const rollVal = Math.random();
        if (rollVal < 0.60) add(drops, 'sheet_music_fragments_common');
        else if (rollVal < 0.65) add(drops, 'sheet_music_fragments_rare');
        else if (rollVal < 0.66) add(drops, 'sheet_music_fragments_legendary');

        if (roll(0.20)) {
            const extraRoll = Math.random();
            if (extraRoll < 0.33) {
                const fragmentRoll = Math.random();
                if (fragmentRoll < 0.60) add(drops, 'sheet_music_fragments_common');
                else if (fragmentRoll < 0.72) add(drops, 'sheet_music_fragments_rare');
                else add(drops, 'sheet_music_fragments_legendary');
            }
            else if (extraRoll < 0.66) add(drops, 'trombone_slides');
            else add(drops, 'valve_oil');
        }

        if (roll(0.10)) add(drops, 'brass_essence');
    }

    addTieredFragments(drops, 'corrupted', level, [
        { t: 1, min: 1, max: 100, chance: 0.10 },
        { t: 2, min: 30, max: 500, chance: 0.075 },
        { t: 3, min: 120, max: 1000, chance: 0.035 },
        { t: 4, min: 250, max: 1000, chance: 0.015 },
        { t: 5, min: 750, max: 1000, chance: 0.003 },
    ]);

    return drops;
}

export function getEuphoniumDrops(level: number, currentLocation: string): Record<string, number> {
    const drops: Record<string, number> = {};

    if (currentLocation !== 'backstage_halls') {
        add(drops, 'echoes', rand(3, 4));
        if (roll(0.60)) add(drops, 'valves');

        const rollVal = Math.random();
        if (rollVal < 0.70) add(drops, 'sheet_music_fragments_common');
        else if (rollVal < 0.77) add(drops, 'sheet_music_fragments_rare');
        else if (rollVal < 0.79) add(drops, 'sheet_music_fragments_legendary');

        if (roll(0.10)) add(drops, 'valve_oil', rand(1, 2));

        if (roll(0.25)) {
            const extraRoll = Math.random();
            if (extraRoll < 0.25) {
                const fragmentRoll = Math.random();
                if (fragmentRoll < 0.70) add(drops, 'sheet_music_fragments_common');
                else if (fragmentRoll < 0.85) add(drops, 'sheet_music_fragments_rare');
                else add(drops, 'sheet_music_fragments_legendary');
            }
            else if (extraRoll < 0.50) add(drops, 'reinforced_brass_ingots');
            else if (extraRoll < 0.66) add(drops, 'trombone_slides');
            else add(drops, 'valve_oil');
        }

        if (roll(0.15)) add(drops, 'brass_essence');
    }

    addTieredFragments(drops, 'weaved', level);

    return drops;
}

function ChooseAltarFragment(tier: number): string {
    const types = ['weaved', 'corrupted', 'sundered', 'plated', 'metallic'];
    const type = types[rand(0, 4)] || 'metallic';
    return `${type}_fragment_t${tier}`;
}

export function getAltarCompletionDrops(altarIndex: number): Record<string, number> {
    const drops: Record<string, number> = {};
    const altar = altarIndex + 1;

    add(drops, 'echoes', rand(24, 54) * altar);
    add(drops, 'brass_ingots', rand(6, 20) * altar);
    add(drops, 'trombone_slides', rand(2, 6) * altar);
    add(drops, 'valve_oil', rand(2, 6) * altar);
    add(drops, 'valves', rand(12, 20) * altar);
    if (roll(0.5)) add(drops, 'moonlight_azarite');

    if (altar >= 1 && altar <= 5) {
        for (let t = 1; t <= altar; t++) {
            const iterations = rand(1, (altar - t + 1) * 5);
            for (let i = 0; i < iterations; i++) {
                add(drops, ChooseAltarFragment(t));
            }
        }
    } else {
        for (let t = 1; t <= altar; t++) {
            const iterations = rand(1, (altar - t + 1) * 5);
            for (let i = 0; i < iterations; i++) {
                add(drops, ChooseAltarFragment(t));
            }
        }
    }

    return drops;
}
