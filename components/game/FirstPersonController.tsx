'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls as DreiPointerLockControls } from '@react-three/drei';
import { Vector3, Euler, MathUtils } from 'three';
import { useGameStore, usePlayerStore } from '@/lib/store';
import { Pillar } from '@/lib/game/pillars';

/**
 * FirstPersonController
 * 
 * A complete first-person camera controller supporting:
 * - Pointer lock mouse look (desktop)
 * - Touch drag look (mobile)
 * - WASD / Arrow key movement
 * - Collision detection with arena boundaries
 * 
 * Default eye level: 1.5 feet (clarinet player height)
 * Default movement speed: 4.5 ft/s
 */

interface FirstPersonControllerProps {
    /** Movement speed in feet per second */
    speed?: number;
    /** Camera eye level height in feet */
    eyeLevel?: number;
    /** Arena radius for collision detection */
    arenaRadius?: number;
    /** Collision margin from wall */
    collisionMargin?: number;
    /** Enable/disable the controller */
    enabled?: boolean;
    /** Callback when pointer lock changes */
    onLockChange?: (locked: boolean) => void;
    /** Pillar data for collision detection */
    pillars?: Pillar[];
    /** Collision padding for pillars */
    pillarCollisionPadding?: number;
    /** Mouse sensitivity multiplier (0.1-3.0, default 1.0) */
    sensitivity?: number;
}

// Movement state tracking
interface MovementState {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    sprint: boolean;
}

// Touch state for mobile
interface TouchState {
    active: boolean;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
}

// Constants
const DEFAULT_SPEED = 6; // feet per second
const DEFAULT_EYE_LEVEL = 1.5; // feet
const DEFAULT_ARENA_RADIUS = 250; // meters (matching BandRoom)
const DEFAULT_COLLISION_MARGIN = 3; // meters from wall
const MOUSE_SENSITIVITY = 0.002;
const TOUCH_SENSITIVITY = 0.003;

export function FirstPersonController({
    speed = DEFAULT_SPEED,
    eyeLevel = DEFAULT_EYE_LEVEL,
    arenaRadius = DEFAULT_ARENA_RADIUS,
    collisionMargin = DEFAULT_COLLISION_MARGIN,
    enabled = true,
    onLockChange,
    pillars = [],
    pillarCollisionPadding = 0.5,
    sensitivity = 1.0,
}: FirstPersonControllerProps) {
    const { camera, gl } = useThree();
    const controlsRef = useRef<typeof DreiPointerLockControls>(null);

    // Movement state
    // Key state
    const keys = useRef<Set<string>>(new Set());

    // Touch state for mobile
    const touchState = useRef<TouchState>({
        active: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
    });

    // Pointer lock state
    const [isLocked, setIsLocked] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Velocity vectors (reused to avoid garbage collection)
    const velocity = useRef(new Vector3());
    const direction = useRef(new Vector3());

    // Detect mobile device
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Game State for respawn handling
    const gameState = useGameStore((state) => state.gameState);
    const prevGameState = useRef(gameState);

    // Handle position reset on game start/respawn
    useEffect(() => {
        // If transitioning to 'playing' from 'gameOver' or 'menu', reset position to center
        if ((prevGameState.current === 'gameOver' || prevGameState.current === 'menu') && gameState === 'playing') {
            camera.position.set(0, eyeLevel, 0);
            camera.rotation.set(0, 0, 0); // Reset rotation to look forward (North?)
        }
        prevGameState.current = gameState;
    }, [gameState, camera, eyeLevel]);

    // Initial setup
    useEffect(() => {
        // Hydrate position from store on mount if playing
        if (gameState === 'playing') {
            const savedPosition = usePlayerStore.getState().position;
            if (savedPosition && (savedPosition[0] !== 0 || savedPosition[2] !== 0)) {
                camera.position.set(savedPosition[0], eyeLevel, savedPosition[2]);
            } else {
                // If 0,0,0 (default), maybe force eye level just in case
                camera.position.set(0, eyeLevel, 0);
            }
        }
    }, [gameState]); // Run when gameState changes (e.g. menu -> playing)

    // Keyboard event handlers
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (!enabled) return;
        keys.current.add(event.code);
    }, [enabled]);

    const handleKeyUp = useCallback((event: KeyboardEvent) => {
        keys.current.delete(event.code);
    }, []);



    // Touch event handlers for mobile
    const handleTouchStart = useCallback((event: TouchEvent) => {
        if (!enabled || !isMobile) return;

        const touch = event.touches[0];
        touchState.current = {
            active: true,
            startX: touch.clientX,
            startY: touch.clientY,
            currentX: touch.clientX,
            currentY: touch.clientY,
        };
    }, [enabled, isMobile]);

    const handleTouchMove = useCallback((event: TouchEvent) => {
        if (!touchState.current.active || !enabled) return;

        const touch = event.touches[0];
        touchState.current.currentX = touch.clientX;
        touchState.current.currentY = touch.clientY;
    }, [enabled]);

    const handleTouchEnd = useCallback(() => {
        touchState.current.active = false;
    }, []);

    // Pointer lock change handler
    const handleLockChange = useCallback(() => {
        const locked = document.pointerLockElement === gl.domElement;
        setIsLocked(locked);
        onLockChange?.(locked);
    }, [gl.domElement, onLockChange]);

    // Set up event listeners
    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        document.addEventListener('pointerlockchange', handleLockChange);

        if (isMobile) {
            gl.domElement.addEventListener('touchstart', handleTouchStart);
            gl.domElement.addEventListener('touchmove', handleTouchMove);
            gl.domElement.addEventListener('touchend', handleTouchEnd);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
            document.removeEventListener('pointerlockchange', handleLockChange);

            if (isMobile) {
                gl.domElement.removeEventListener('touchstart', handleTouchStart);
                gl.domElement.removeEventListener('touchmove', handleTouchMove);
                gl.domElement.removeEventListener('touchend', handleTouchEnd);
            }
        };
    }, [
        handleKeyDown,
        handleKeyUp,
        handleLockChange,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
        gl.domElement,
        isMobile,
    ]);

    useFrame((state, delta) => {
        if (!enabled) return;

        // Tick reed durability
        if (gameState === 'playing') {
            usePlayerStore.getState().tickReedDurability(delta);

            // Anti-camping: Reset tempo if idle for 30s
            const playerState = usePlayerStore.getState();
            const idleTime = Date.now() - playerState.lastMoveTime;
            if (idleTime > 30000 && playerState.tempo > 0) {
                usePlayerStore.setState({ tempo: 0, tempoRating: 'F' });
            }
        }

        // Derive movement state from keys
        const k = keys.current;
        const moveForward = k.has('KeyW') || k.has('ArrowUp');
        const moveBackward = k.has('KeyS') || k.has('ArrowDown');
        const moveLeft = k.has('KeyA') || k.has('ArrowLeft');
        const moveRight = k.has('KeyD') || k.has('ArrowRight');
        const moveSprint = k.has('KeyQ');

        // Q acts as Forward + Sprint
        const finalForward = moveForward || moveSprint;
        const isSprinting = moveSprint;

        const touch = touchState.current;

        // Handle touch look (mobile)
        if (isMobile && touch.active) {
            const deltaX = touch.currentX - touch.startX;
            const deltaY = touch.currentY - touch.startY;

            // Apply rotation
            camera.rotation.y -= deltaX * TOUCH_SENSITIVITY;
            camera.rotation.x -= deltaY * TOUCH_SENSITIVITY;

            // Clamp vertical rotation
            camera.rotation.x = MathUtils.clamp(
                camera.rotation.x,
                -Math.PI / 2 + 0.1,
                Math.PI / 2 - 0.1
            );

            // Reset touch start for continuous drag
            touch.startX = touch.currentX;
            touch.startY = touch.currentY;
        }

        // Calculate movement direction
        direction.current.set(0, 0, 0);

        if (finalForward) direction.current.z -= 1;
        if (moveBackward) direction.current.z += 1;
        if (moveLeft) direction.current.x -= 1;
        if (moveRight) direction.current.x += 1;

        // Skip if no movement
        if (direction.current.length() === 0) return;

        // Normalize for consistent speed in diagonal movement
        direction.current.normalize();

        // Update last move time for anti-camping detection
        usePlayerStore.getState().updateMoveTime();

        // Get camera's actual forward direction (works with PointerLockControls)
        const cameraDirection = new Vector3();
        camera.getWorldDirection(cameraDirection);

        // Calculate yaw angle from camera's forward direction (ignore pitch)
        const yaw = Math.atan2(-cameraDirection.x, -cameraDirection.z);

        // Apply yaw rotation to movement direction
        const euler = new Euler(0, yaw, 0, 'YXZ');
        direction.current.applyEuler(euler);

        // Calculate velocity (speed in feet/s converted to units/frame)
        // Apply sprint multiplier (2x) if Q is held (isSprinting)
        const speedModifier = usePlayerStore.getState().speedModifier;
        const currentSpeed = speed * (isSprinting ? 2 : 1) * speedModifier;
        velocity.current.copy(direction.current).multiplyScalar(currentSpeed * delta);

        // Calculate new position
        const newPosition = camera.position.clone().add(velocity.current);

        // Collision detection - keep player within arena bounds
        const distanceFromCenter = Math.sqrt(
            newPosition.x * newPosition.x + newPosition.z * newPosition.z
        );
        const maxDistance = arenaRadius - collisionMargin;

        // Corridor exception zones - allow walking into the 4 corridors
        const corridorWidth = 10;
        const corridorLength = 200;
        const halfWidth = corridorWidth / 2; // Corridor half-width (5m)
        const wallBuffer = 0.5; // Player can't get within 0.5m of wall

        // Check if player is in a corridor zone (within the corridor entrance width)
        // Allow full length + small buffer to ensure we don't snap out before hitting the wall
        const isInNorthCorridor = newPosition.z > arenaRadius - 15 && Math.abs(newPosition.x) < halfWidth && newPosition.z < arenaRadius + corridorLength + 5;
        const isInSouthCorridor = newPosition.z < -(arenaRadius - 15) && Math.abs(newPosition.x) < halfWidth && newPosition.z > -(arenaRadius + corridorLength + 5);
        const isInEastCorridor = newPosition.x > arenaRadius - 15 && Math.abs(newPosition.z) < halfWidth && newPosition.x < arenaRadius + corridorLength + 5;
        const isInWestCorridor = newPosition.x < -(arenaRadius - 15) && Math.abs(newPosition.z) < halfWidth && newPosition.x > -(arenaRadius + corridorLength + 5);

        const isInCorridor = isInNorthCorridor || isInSouthCorridor || isInEastCorridor || isInWestCorridor;

        if (distanceFromCenter > maxDistance && !isInCorridor) {
            // Slide along the wall instead of stopping completely
            const angle = Math.atan2(newPosition.z, newPosition.x);
            newPosition.x = Math.cos(angle) * maxDistance;
            newPosition.z = Math.sin(angle) * maxDistance;
        }

        // Corridor wall collision - keep player within corridor bounds (tighter collision)
        const corridorBound = halfWidth - wallBuffer;
        // Stop before end wall (corridor extends 200m, but we only block slight visual clipping)
        // Overlap is 1m. Length is 200m. End is at Radius + 199.
        // Let's allow walking to Radius + 197 (2m buffer)
        const endWallBound = arenaRadius + corridorLength - 3;

        if (isInNorthCorridor) {
            newPosition.x = Math.max(-corridorBound, Math.min(corridorBound, newPosition.x));
            // Prevent going past end wall
            newPosition.z = Math.min(endWallBound, newPosition.z);
        }
        if (isInSouthCorridor) {
            newPosition.x = Math.max(-corridorBound, Math.min(corridorBound, newPosition.x));
            newPosition.z = Math.max(-endWallBound, newPosition.z);
        }
        if (isInEastCorridor) {
            newPosition.z = Math.max(-corridorBound, Math.min(corridorBound, newPosition.z));
            newPosition.x = Math.min(endWallBound, newPosition.x);
        }
        if (isInWestCorridor) {
            newPosition.z = Math.max(-corridorBound, Math.min(corridorBound, newPosition.z));
            newPosition.x = Math.max(-endWallBound, newPosition.x);
        }

        // Pillar collision detection - prevent movement into pillars
        if (pillars.length > 0) {
            const playerRadius = 0.5; // Player collision radius
            // Check each pillar for collision
            // Check each pillar for collision
            for (const pillar of pillars) {
                // Use base radius (1.5x shaft radius) since base is larger than the shaft
                const baseRadius = pillar.radius * 1.5;
                const minDist = baseRadius + playerRadius + pillarCollisionPadding;

                // Calculate distance from new position to pillar center
                const dx = newPosition.x - pillar.x;
                const dz = newPosition.z - pillar.z;
                const distToPillar = Math.sqrt(dx * dx + dz * dz);

                if (distToPillar < minDist) {
                    // Would collide - push new position out to the boundary
                    // Calculate direction from pillar center to player
                    const pushDir = distToPillar > 0.001
                        ? { x: dx / distToPillar, z: dz / distToPillar }
                        : { x: 1, z: 0 }; // Fallback if at center

                    // Place player at minimum distance along this direction
                    newPosition.x = pillar.x + pushDir.x * minDist;
                    newPosition.z = pillar.z + pushDir.z * minDist;
                }
            }
        }

        // Keep y position at eye level
        newPosition.y = eyeLevel;

        // Apply new position
        camera.position.copy(newPosition);
    });

    // Render pointer lock controls for desktop
    if (!isMobile && enabled) {
        return (
            <DreiPointerLockControls
                ref={controlsRef as React.Ref<any>}
            />
        );
    }

    // Mobile doesn't use pointer lock
    return null;
}

/**
 * Hook to get first-person controller state
 */
export function useFirstPersonController() {
    const [isLocked, setIsLocked] = useState(false);

    useEffect(() => {
        const handleChange = () => {
            setIsLocked(!!document.pointerLockElement);
        };
        document.addEventListener('pointerlockchange', handleChange);
        return () => document.removeEventListener('pointerlockchange', handleChange);
    }, []);

    return { isLocked };
}

export default FirstPersonController;
