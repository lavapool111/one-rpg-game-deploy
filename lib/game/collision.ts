export const DUNGEON_HUB_WIDTH = 30;
export const DUNGEON_HUB_DEPTH = 50;
export const DUNGEON_CORRIDOR_WIDTH = 12;
export const DUNGEON_CORRIDOR_LENGTH = 100;

// Helper: is position (x,y,z) inside any valid area?
// Y parameter is optional - if not provided, Y-based checks are skipped
export const isValidDungeonPosition = (x: number, z: number, buffer = 1.5, y?: number): boolean => {
    // 1. Hub Room: 30x50
    // X: [-15, 15], Z: [-25, 25]
    const inHub = x >= -15 + buffer && x <= 15 - buffer && z >= -25 + buffer && z <= 25 - buffer;

    // 2. Center Corridor (North): 12x100
    // X: [-6, 6], Z: [25, 125]
    // Start extended into Hub (Z=15) to ensure overlap
    // End at 125 (no buffer) to meet Center Room exactly
    const inCenterCorr = x >= -6 + buffer && x <= 6 - buffer && z >= 15 && z <= 126;

    // 3. Left Corridor (West): 100x12
    // X: [-125, -25]
    // Start extended into Hub (X=-10) to ensure overlap
    // End extended into Room (X=-135) to ensure overlap with Left Room (starts at X=-160)
    const inLeftCorr = x >= -135 && x <= -10 && z >= -6 + buffer && z <= 6 - buffer;

    // 4. Right Corridor (East): 100x12
    // X: [25, 125]
    // Start extended into Hub (X=10) to ensure overlap
    const inRightCorr = x >= 10 && x <= 125 - buffer && z >= -6 + buffer && z <= 6 - buffer;

    // 5. Left Room: 25x35 (Width x Depth) - EXPANDED with 75ft ceiling
    // Room center at world X=-142.5, Z=0 (after rotation).
    // Room is 35ft in local Z (world X): X: -160 to -125
    // Room is 25ft in local X (world Z): Z: -12.5 to +12.5
    // South wall at world Z=+12.5, doorway opening at Z=-1 to +13
    // Z extended to +13 to overlap with extension corridor doorway (Z starts at 10)
    const inLeftRoom = x >= -160 + buffer && x <= -125 - buffer && z >= -13 + buffer && z <= 13 - buffer;

    // 6. Right Room: 15x25 (Width x Depth)
    // X: [125, 150]
    // Z: [-7.5, 7.5]
    // Start extended into Corridor (X=120) to ensure overlap
    const inRightRoom = x >= 120 && x <= 150 - buffer && z >= -7.5 + buffer && z <= 7.5 - buffer;

    // 7. Center Room: 25x60 (Width x Depth) - vault room before stairwell
    // Room at world Z=155 (center), spans Z=125-185
    // Starts exactly at Z=125 (end of corridor)
    // X: [-12.5, 12.5], Z ends at 183 (stairwell zone handles Z >= 183 with narrower X)
    const inCenterRoom = x >= -12.5 + buffer && x <= 12.5 - buffer && z >= 125.5 && z <= 183;

    // 8. Stairwell (behind vault room, with broken stairs parkour)
    // Stairs: world Z=185 to Z=225
    // Narrow section (Z 183-220): X: [-5, 5] (6ft wide stairs, matches stairwell-catch-floor)
    // Wide section (Z 220-226): X: [-15, 15] (underground room floor starts at Z=220, room is 30ft wide)
    const inStairwellNarrow = x >= -5 + buffer && x <= 5 - buffer && z >= 183 && z <= 220;
    const inStairwellWide = x >= -15 + buffer && x <= 15 - buffer && z >= 220 && z <= 226;
    const inStairwell = inStairwellNarrow || inStairwellWide;

    // 9. Underground Room (at bottom of stairs)
    // Room centered at world Z=240 (155+80+5), 30x30 room
    // Floor spans Z=220-255, X=-15 to X=15
    // Back wall at Z=255, so stop player with buffer before it
    // REQUIRES Y <= -15 to be valid (floor is at Y=-20)
    const inUndergroundRoomXZ = x >= -15 + buffer && x <= 15 - buffer && z >= 220 && z <= 255 - buffer;
    const inUndergroundRoom = inUndergroundRoomXZ && (y === undefined || y <= -15);

    // 10. Left Room South Extension Corridor (elevated at Y=15)
    // Corridor geometry: 14ft wide, centered at world X ≈ -148.5
    // World X bounds: -155.5 to -141.5 (with buffer: -154 to -143)
    // World Z bounds: starts at Z=13 (doorway), extends to Z=148
    // REQUIRES Y >= 13 to be valid (corridor floor is at Y=15)
    const inLeftRoomSouthExtXZ = x >= -156 + buffer && x <= -141 - buffer && z >= 10 && z <= 149 - buffer;
    const inLeftRoomSouthExt = inLeftRoomSouthExtXZ && (y === undefined || y >= 13);

    // 11. Prison Cells in Left Room South Extension Corridor
    // 4 cells (8x8 ft each) jutting out from the corridor walls at local X=35 and X=55
    // Corridor X range: -156 to -141 (14ft wide)
    // West cells (local Z=+11.5) extend from X=-156 outward to X=-164 (8ft)
    // East cells (local Z=-11.5) extend from X=-141 outward to X=-133 (8ft)
    // Cell Z positions: local X=35 -> world Z≈51 (range 47-55), local X=55 -> world Z≈71 (range 67-75)
    // REQUIRES Y >= 13 to be valid (floor is at Y=15)
    // Include overlap with corridor boundary for smooth transition
    const inPrisonCellWest1XZ = x >= -164 + buffer && x <= -154 && z >= 43 && z <= 51;
    const inPrisonCellWest2XZ = x >= -164 + buffer && x <= -154 && z >= 63 && z <= 71;
    const inPrisonCellEast1XZ = x >= -143 && x <= -133 - buffer && z >= 43 && z <= 51;
    const inPrisonCellEast2XZ = x >= -143 && x <= -133 - buffer && z >= 63 && z <= 71;
    const inPrisonCells = (inPrisonCellWest1XZ || inPrisonCellWest2XZ || inPrisonCellEast1XZ || inPrisonCellEast2XZ) && (y === undefined || y >= 13);

    return inHub || inCenterCorr || inLeftCorr || inRightCorr || inLeftRoom || inRightRoom || inCenterRoom || inStairwell || inUndergroundRoom || inLeftRoomSouthExt || inPrisonCells;
};
