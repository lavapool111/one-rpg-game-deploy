import { useGameStore } from '@/lib/store/gameStore';

// Helper: is position (x,y,z) inside any valid area?
// Y parameter is optional - if not provided, Y-based checks are skipped
// PERF: Uses early-exit pattern — returns true on first zone match instead of evaluating all zones.
export const isValidDungeonPosition = (x: number, z: number, buffer = 1.5, y?: number): boolean => {
    const isInAltarRoom = useGameStore.getState().isInAltarRoom;

    // --- ALTAR ROOM FREEDOM ---
    // If we are in the Altar Room sequence, allow anything beyond the trigger point (574 - logic margin)
    // Fine-grained collision is handled by registerSurfaces/registerObstacles in AltarRoom.tsx
    if (isInAltarRoom && z >= 561) return true;

    // --- HUB (most common case — check first) ---

    // 1. Hub Room: 30x50
    if (x >= -15 + buffer && x <= 15 - buffer && z >= -25 + buffer && z <= 25 - buffer) return true;

    // --- CORRIDORS (second most common) ---

    // 2. Center Corridor (North): 12x100
    if (x >= -6 + buffer && x <= 6 - buffer && z >= 15 && z <= 126) return true;

    // 3. Left Corridor (West): 100x12
    if (x >= -135 && x <= -10 && z >= -6 + buffer && z <= 6 - buffer) return true;

    // 4. Right Corridor (East): 100x12
    if (x >= 10 && x <= 125 - buffer && z >= -6 + buffer && z <= 6 - buffer) return true;

    // --- ROOMS ---

    // 5. Left Room: 25x35
    if (x >= -160 + buffer && x <= -125 - buffer && z >= -12.5 + buffer && z <= 12) return true;

    // 6. Right Room: 15x25
    if (x >= 120 && x <= 150 - buffer && z >= -7.5 + buffer && z <= 7.5 - buffer) return true;

    // 7. Center Room: 25x60
    if (x >= -12.5 + buffer && x <= 12.5 - buffer && z >= 125.5 && z <= 183) return true;

    // --- STAIRWELLS & UNDERGROUND ---

    // 8. Stairwell (behind vault room)
    if ((x >= -5 + buffer && x <= 5 - buffer && z >= 183 && z <= 220) ||
        (x >= -15 + buffer && x <= 15 - buffer && z >= 220 && z <= 226)) return true;

    // 9. Underground Room (REQUIRES Y <= -15)
    if (x >= -15 + buffer && x <= 15 - buffer && z >= 225 && z <= 257 && (y === undefined || y <= -15)) return true;

    // 6.5 Right Room Stairwell
    if (x >= 148 && x <= 191 && z >= -3 + buffer && z <= 3 - buffer) return true;

    // Right Underground Room (REQUIRES Y <= -10)
    if (x >= 190 && x <= 211 - buffer && z >= -10 + buffer && z <= 10 - buffer && (y === undefined || y <= -10)) return true;

    // --- EXTENSIONS & DEEP AREAS ---

    // 10. Left Room South Extension Corridor (Y >= 13)
    if (x >= -156 + buffer && x <= -141 - buffer && z >= 10 && z <= 250 - buffer && (y === undefined || y >= 13)) return true;

    // 11. Prison Cells (Y >= 13)
    if ((y === undefined || y >= 13) && (
        (x >= -164 + buffer && x <= -154 && z >= 44.5 && z <= 51) ||
        (x >= -164 + buffer && x <= -154 && z >= 64.5 && z <= 71) ||
        (x >= -143 && x <= -133 - buffer && z >= 44.5 && z <= 51) ||
        (x >= -143 && x <= -133 - buffer && z >= 64.5 && z <= 71)
    )) return true;

    // 12. Hallway Extension (Y <= -15)
    // Previously truncated at 574, now restored to 675 for the dungeon path
    if (!isInAltarRoom && x >= -6 + buffer && x <= 6 - buffer && z >= 252 && z <= 675 && (y === undefined || y <= -15)) return true;

    // 13. Left Branch Corridor (Y >= 13)
    if (x >= -150 && x <= -15 + 2 && z >= 240 && z <= 251 - buffer && (y === undefined || y >= 13)) return true;

    // 13b. Shaft (no Y requirement)
    if (x >= -15 && x <= 7 - buffer && z >= 237 && z <= 251 - buffer) return true;

    // 14. Left Room Upper Areas (Y >= 12/40)
    // a) Third floor platform
    if (x >= -150 && x <= -139 + buffer && z >= -12 && z <= -2 + buffer && (y === undefined || y >= 12)) return true;
    // b) Fourth platform
    if (x >= -153.5 + buffer && x <= -140.5 - buffer && z >= -8 + buffer && z <= 8 - buffer && (y === undefined || y >= 40)) return true;
    // c) Upper corridor
    if (x >= -198.5 - buffer && x <= -150.5 - buffer && z >= -6 + buffer && z <= 6 - buffer && (y === undefined || y >= 40)) return true;
    // d) Upper vault room
    if (x >= -251.5 + buffer && x <= -199 + buffer && z >= -26.75 + buffer && z <= 26.75 - buffer && (y === undefined || y >= 40)) return true;

    // 15. Circular Vault Room (Y <= -15)
    const distToCircRoomSq = x * x + (z - 360) * (z - 360);
    const circRoomRadius = 25 - buffer;
    if (distToCircRoomSq <= circRoomRadius * circRoomRadius && (y === undefined || y <= -15)) return true;

    // 16. West Tuba Corridor (Y <= -15)
    if (x >= -98 && x <= -23 && z >= 355 && z <= 365 && (y === undefined || y <= -15)) return true;

    // 17. West Vault Room (Y <= -15)
    if (x >= -122 && x <= -96 && z >= 349 && z <= 371 && (y === undefined || y <= -15)) return true;

    // 18. Metal Door Vault (Y <= -15)
    if (((x >= -6 && x <= 6 && z >= 370 && z <= 406) || (x >= -14 && x <= 14 && z >= 406 && z <= 429)) && (y === undefined || y <= -15)) return true;

    // 9.5 Deep Vault Prison (Y <= -15)
    // Previously truncated at 574, now restored to 675 for the dungeon path
    // Contains 8 cells at Z=470, 520, 580, 630 on both Left and Right sides
    if (!isInAltarRoom && (y === undefined || y <= -15) && (
        (x >= -8 && x <= 8 && z >= 429 && z <= 675) ||
        (x >= -18 + buffer && x <= 18 - buffer && (
            (z >= 467 && z <= 474) || (z >= 517 && z <= 524) ||
            (z >= 577 && z <= 584) || (z >= 627 && z <= 634)
        ))
    )) return true;

    // 9.6 Trial Room Area (Y <= -15)
    if (!isInAltarRoom && (y === undefined || y <= -15) && x >= -30 + buffer && x <= 30 - buffer && z >= 675 && z <= 785) return true;


    // 1b. Hub Descent — gated behind 5 trial room kills
    const passageBuf = 0.5;
    const inHubDescentGeometry =
        (x >= -14.5 + passageBuf && x <= -9.5 - passageBuf && z >= -41 && z <= -23) ||
        (x >= 9.5 + passageBuf && x <= 14.5 - passageBuf && z >= -41 && z <= -23) ||
        (x >= -14.5 + buffer && x <= 14.5 - buffer && z >= -56 + buffer && z <= -39) ||
        (x >= -6 + passageBuf && x <= 6 - passageBuf && z >= -86 && z <= -54);
    if (inHubDescentGeometry) {
        const trialKills = useGameStore.getState().dungeonState?.trialRoomKills ?? 0;
        if (trialKills >= 5) return true;
    }

    return false;
};