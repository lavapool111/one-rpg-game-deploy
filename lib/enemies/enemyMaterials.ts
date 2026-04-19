import * as THREE from 'three';

/**
 * Shared enemy materials.
 * These are singletons shared across all enemy types to reduce GPU memory.
 */

/** Invisible hitbox material — used for click targets on all enemy types */
export const hitboxMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0
});

/** Silver valve/mouthpiece material — used by Euphonium and Tuba */
export const silverMat = new THREE.MeshStandardMaterial({
    color: '#C0C0C0',
    metalness: 0.8,
    roughness: 0.2,
    emissive: '#C0C0C0',
    emissiveIntensity: 0.05
});
