'use client';

/**
 * Altar Geometry Utility
 * 
 * Provides centralized math for the 100-altar sequence.
 * Handles dynamic room radius and corridor length scaling.
 */

// Base constants
export const BASE_CENTER_Z = 636.5;
export const BASE_ROOM_RADIUS = 62.5;
export const RADIUS_INCREMENT = 6.25;
export const BASE_CORRIDOR_LENGTH = 100;
export const CORRIDOR_INCREMENT = 10;
export const BASE_WALL_HEIGHT = 40;
export const HEIGHT_INCREMENT = 4;

/**
 * Gets the radius of a specific Altar Room.
 * Grows by 6.25ft per room.
 */
export const getAltarRadius = (index: number): number => {
    return BASE_ROOM_RADIUS + (RADIUS_INCREMENT * index);
};

/**
 * Gets the length of the corridor following a specific Altar Room.
 * Grows by 10ft per room.
 */
export const getAltarCorridorLength = (index: number): number => {
    return BASE_CORRIDOR_LENGTH + (CORRIDOR_INCREMENT * index);
};

/**
 * Gets the absolute world Z-coordinate for the center of an Altar Room.
 * Uses a quadratic formula derived from cumulative growth: 
 * Center_n = BASE_CENTER_Z + 231.25n + 11.25(n^2 - n)
 */
export const getAltarCenterZ = (index: number): number => {
    if (index <= 0) return BASE_CENTER_Z;
    // Closed form formula for the sum of non-linear gaps
    return BASE_CENTER_Z + (231.25 * index) + (11.25 * (index * (index - 1)));
};

/**
 * Gets the trigger point Z for entering an Altar Room's wave logic.
 * This is the start of the room: center - radius.
 */
export const getAltarTriggerZ = (index: number): number => {
    return getAltarCenterZ(index) - getAltarRadius(index);
};

/**
 * Gets the Z coordinate where the exit gate of a room is located.
 * This is the end of the room: center + radius.
 */
export const getAltarExitZ = (index: number): number => {
    return getAltarCenterZ(index) + getAltarRadius(index);
};

/**
 * Gets the height of a specific Altar Room.
 * Grows by 4ft per room (10% of base).
 */
export const getAltarHeight = (index: number): number => {
    return BASE_WALL_HEIGHT + (HEIGHT_INCREMENT * index);
};

/**
 * Gets the overall scale factor for decorative elements (statues, portals) in a specific Altar Room.
 * Grows by 0.1 per room (10% of base scale).
 */
export const getAltarScaleFactor = (index: number): number => {
    return 1.0 + (0.1 * index);
};
