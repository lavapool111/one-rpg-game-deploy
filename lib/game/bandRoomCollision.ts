import { getAltarRadius, getAltarCenterZ, getAltarCorridorLength } from './altarGeometry';

/**
 * Band Room & Altar Room Collision Registry
 * 
 * Centralized logic for valid movement zones in the Band Room and Altar Room areas.
 * Handles circular rooms and rectangular corridors.
 */

export const isValidBandRoomPosition = (x: number, z: number, buffer = 0.5): boolean => {
    // --- Constants from FirstPersonController ---
    const arenaRadius = 375;
    const corridorWidth = 10;
    const corridorLength = 200;
    const halfWidth = corridorWidth / 2;
    const totalAltars = 100;

    // 1. Main Band Room (Circular)
    const distToCenterSq = x * x + z * z;
    if (distToCenterSq < (arenaRadius - buffer) * (arenaRadius - buffer)) return true;

    // 2. North Corridor (Leading to First Altar Room)
    // Z: 375 to 574 (Entrance to Altar Room 0)
    // First altar room radius 62.5, center 636.5. Start Z is 636.5 - 62.5 = 574.
    if (Math.abs(x) < (halfWidth - buffer) && z >= arenaRadius - 5 && z <= 574 + 5) return true;

    // 3. South Corridor (Dead end)
    if (Math.abs(x) < (halfWidth - buffer) && z <= -(arenaRadius - 5) && z >= -(arenaRadius + corridorLength + 5)) return true;

    // 4. East Corridor (Dead end)
    if (Math.abs(z) < (halfWidth - buffer) && x >= arenaRadius - 5 && x <= arenaRadius + corridorLength + 5) return true;

    // 5. West Corridor (Dead end)
    if (Math.abs(z) < (halfWidth - buffer) && x <= -(arenaRadius - 5) && x >= -(arenaRadius + corridorLength + 5)) return true;

    // --- Dynamic Altar Rooms (0 to 99) ---
    // Efficiently find nearby indices using the quadratic formula: z = 11.25n^2 + 220n + 636.5
    // solving for n: n = (-220 + sqrt(220^2 - 42 * (11.25) * (636.5 - z))) / (2 * 11.25)
    let approximateIndex = 0;
    if (z > 600) {
        const a = 11.25;
        const b = 220;
        const c = 636.5 - z;
        const discriminant = b * b - 4 * a * c;
        if (discriminant >= 0) {
            approximateIndex = Math.floor((-b + Math.sqrt(discriminant)) / (2 * a));
        }
    }

    const indicesToCheck = [approximateIndex - 1, approximateIndex, approximateIndex + 1];

    for (const i of indicesToCheck) {
        if (i < 0 || i >= totalAltars) continue;

        const cz = getAltarCenterZ(i);
        const roomRadius = getAltarRadius(i);

        // Check Altar Room (Circular)
        const dxAltar = x;
        const dzAltar = z - cz;
        const distToAltarSq = dxAltar * dxAltar + dzAltar * dzAltar;
        if (distToAltarSq < (roomRadius - buffer) * (roomRadius - buffer)) return true;

        // Check Post-Altar Corridor (The extension connecting to next)
        const corridorLen = getAltarCorridorLength(i);
        const postCorridorStart = cz + roomRadius;
        const postCorridorEnd = postCorridorStart + corridorLen;
        if (Math.abs(x) < (halfWidth - buffer) && z >= (postCorridorStart - 5) && z <= (postCorridorEnd + 5)) return true;
    }

    return false;
};
