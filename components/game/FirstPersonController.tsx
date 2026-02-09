'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls as DreiPointerLockControls } from '@react-three/drei';
import { Vector3, Euler, MathUtils } from 'three';
import { useGameStore, usePlayerStore } from '@/lib/store';
import { Pillar } from '@/lib/game/pillars';
import {
    DUNGEON_HUB_WIDTH,
    DUNGEON_HUB_DEPTH,
    DUNGEON_CORRIDOR_WIDTH,
    DUNGEON_CORRIDOR_LENGTH,
    isValidDungeonPosition
} from '@/lib/game/collision';
import { getFloorHeightAt } from '@/lib/game/stairCollision';

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

// Touch state removed (managed via store)


// Constants
const DEFAULT_SPEED = 6; // feet per second
const DEFAULT_EYE_LEVEL = 1.5; // feet
const DEFAULT_ARENA_RADIUS = 375; // meters (matching BandRoom)
const DEFAULT_COLLISION_MARGIN = 3; // meters from wall
const MOUSE_SENSITIVITY = 0.002;
const TOUCH_SENSITIVITY = 0.003;
const WALK_SPEED = 4.5;
const SPRINT_SPEED = 9.0;

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



    // Pointer lock state
    const skipPositionSync = useRef(false); // Skip position sync during location transitions
    const [isLocked, setIsLocked] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Velocity vectors (reused to avoid garbage collection)
    const velocity = useRef(new Vector3());
    const direction = useRef(new Vector3());

    // Jump physics state
    const verticalVelocity = useRef(0);
    const isGrounded = useRef(true);
    const GRAVITY = 30; // ft/s^2
    const JUMP_FORCE = 12; // ft/s initial velocity

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
    const speedModifier = usePlayerStore((state) => state.speedModifier);
    const applySlow = usePlayerStore((state) => state.applySlow);
    const isStunned = usePlayerStore((state) => state.isStunned);
    const prevGameState = useRef(gameState);

    // Handle position reset on game start/respawn
    useEffect(() => {
        // If transitioning to 'playing' from 'gameOver' or 'menu', reset position to center
        if ((prevGameState.current === 'gameOver' || prevGameState.current === 'menu') && gameState === 'playing') {
            camera.position.set(0, eyeLevel, 0);
            camera.rotation.set(0, Math.PI, 0); // Reset rotation to look opposite way (South/Audience?)
        }
        prevGameState.current = gameState;
    }, [gameState, camera, eyeLevel]);

    // Initial setup
    useEffect(() => {
        // Hydrate position from store on mount if playing
        if (gameState === 'playing') {
            // Disable sync temporarily during hydration
            skipPositionSync.current = true;

            const savedPosition = usePlayerStore.getState().position;
            console.log('Initial mount: hydrating position to', savedPosition);

            if (savedPosition && (savedPosition[0] !== 0 || savedPosition[2] !== 0)) {
                camera.position.set(savedPosition[0], eyeLevel, savedPosition[2]);
            } else {
                // If 0,0,0 (default), maybe force eye level just in case
                camera.position.set(0, eyeLevel, 0);
                camera.rotation.set(0, Math.PI, 0);
            }

            // Re-enable sync after hydration settles
            setTimeout(() => {
                skipPositionSync.current = false;
            }, 200);
        }
    }, [gameState]); // Run when gameState changes (e.g. menu -> playing)

    // On mount: hydrate position and disable sync temporarily
    useEffect(() => {
        // Skip sync on mount to prevent frame from overwriting store position
        skipPositionSync.current = true;

        const savedPosition = usePlayerStore.getState().position;
        console.log('Component mounted: hydrating to', savedPosition);
        camera.position.set(savedPosition[0], eyeLevel, savedPosition[2]);

        // Re-enable sync after mount settles
        setTimeout(() => {
            skipPositionSync.current = false;
        }, 300);
    }, []); // Empty deps = run once on mount



    // Keyboard event handlers
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (!enabled) return;
        keys.current.add(event.code);
    }, [enabled]);

    const handleKeyUp = useCallback((event: KeyboardEvent) => {
        keys.current.delete(event.code);
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

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
            document.removeEventListener('pointerlockchange', handleLockChange);
        };
    }, [
        handleKeyDown,
        handleKeyUp,
        handleLockChange,
    ]);

    // Current location for collision mode
    const currentLocation = useGameStore((state) => state.currentLocation);
    const prevLocation = useRef(currentLocation);

    // Immediate sync skip to prevent race condition with useFrame
    if (currentLocation !== prevLocation.current) {
        skipPositionSync.current = true;
    }

    // Sync camera position when location changes (e.g. exiting dungeon)
    useEffect(() => {
        if (gameState === 'playing' && currentLocation !== prevLocation.current) {
            // Skip sync immediately to prevent frame loop from overwriting
            skipPositionSync.current = true;

            // Read the position that was set by escapeDungeon/failDungeonRun
            // This should be done synchronously in the effect
            const targetPosition = usePlayerStore.getState().position;
            console.log('Location changed to', currentLocation, '- teleporting to', targetPosition);

            // Teleport camera immediately
            camera.position.set(targetPosition[0], eyeLevel, targetPosition[2]);

            // Update tracking
            prevLocation.current = currentLocation;

            // Re-enable sync after a short delay to let the camera settle
            setTimeout(() => {
                skipPositionSync.current = false;
            }, 200);
        } else if (currentLocation === prevLocation.current) {
            // Same location, ensure sync is enabled
        } else {
            prevLocation.current = currentLocation;
        }
    }, [currentLocation, camera, eyeLevel, gameState]);

    useFrame((state, delta) => {
        if (!enabled) return;

        // Check for location desync (Store updated but component hasn't re-rendered yet)
        // This prevents overwriting the store position with stale coordinates during transition
        if (useGameStore.getState().currentLocation !== currentLocation) return;

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
        // Q acts as Forward + Sprint
        const finalForward = moveForward || moveSprint;
        const isSprinting = moveSprint;

        // --- New Mobile Input Integration ---
        const playerState = usePlayerStore.getState();
        const joystick = playerState.input.joystick;
        const look = playerState.input.look;

        // Apply touch look (mobile)
        if (look.x !== 0 || look.y !== 0) {
            // Apply rotation
            camera.rotation.y -= look.x * TOUCH_SENSITIVITY;
            camera.rotation.x -= look.y * TOUCH_SENSITIVITY;

            // Clamp vertical rotation
            camera.rotation.x = MathUtils.clamp(
                camera.rotation.x,
                -Math.PI / 2 + 0.1,
                Math.PI / 2 - 0.1
            );

            // Consume look input
            playerState.resetInputLook();
        }

        // Calculate movement direction
        direction.current.set(0, 0, 0);

        if (finalForward) direction.current.z -= 1;
        if (moveBackward) direction.current.z += 1;
        if (moveLeft) direction.current.x -= 1;
        if (moveRight) direction.current.x += 1;

        // Apply Joystick Input
        if (joystick.x !== 0 || joystick.y !== 0) {
            // Joystick up (neg Y) -> Forward (neg Z)
            direction.current.x += joystick.x;
            direction.current.z += joystick.y;
            // Note: Since we normalized joystick to circle in Controls, this should be fine.
        }

        // Check if there's horizontal movement
        const hasHorizontalMovement = direction.current.length() > 0;

        // Check if player wants to jump or is in the air
        const wantsJump = keys.current.has('Space') && !isStunned; // Disable jump if stunned
        const needsGravity = !isGrounded.current || wantsJump;

        // Skip frame only if no movement AND no jump activity needed
        if (!hasHorizontalMovement && !needsGravity) return;

        // Start with current position
        const newPosition = camera.position.clone();

        // Only process horizontal movement if there is any
        if (hasHorizontalMovement) {
            // Normalize for consistent speed in diagonal movement (or mixed input)
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

            // MOVEMENT LOGIC
            // If stunned, skip all movement processing
            if (isStunned) return;

            // Apply speed modifier to base speed
            const currentSpeed = (isSprinting ? SPRINT_SPEED : WALK_SPEED) * speedModifier;
            velocity.current.copy(direction.current).multiplyScalar(currentSpeed * delta);

            // Apply horizontal movement
            newPosition.add(velocity.current);

            // ========== BAND ROOM ARENA COLLISION (skip in dungeon) ==========
            if (currentLocation !== 'backstage_halls') {
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
                    // Door is at the END of the corridor: -(arenaRadius + corridorLength - 5)
                    // Stop player about 3 feet before the door face
                    const doorBound = arenaRadius + corridorLength - 8;
                    newPosition.z = Math.max(-doorBound, newPosition.z);
                }
                if (isInEastCorridor) {
                    newPosition.z = Math.max(-corridorBound, Math.min(corridorBound, newPosition.z));
                    newPosition.x = Math.min(endWallBound, newPosition.x);
                }
                if (isInWestCorridor) {
                    newPosition.z = Math.max(-corridorBound, Math.min(corridorBound, newPosition.z));
                    newPosition.x = Math.max(-endWallBound, newPosition.x);
                }
            }

            // ========== DUNGEON COLLISION - With wall sliding ==========
            if (currentLocation === 'backstage_halls') {
                const buffer = 1.5;
                const oldX = camera.position.x;
                const oldZ = camera.position.z;
                const playerY = camera.position.y;

                // Check if old position is valid (might be invalid if just spawned)
                const oldPosValid = isValidDungeonPosition(oldX, oldZ, buffer, playerY);

                if (oldPosValid) {
                    // Normal wall sliding - try each axis independently
                    const xOnlyValid = isValidDungeonPosition(newPosition.x, oldZ, buffer, playerY);
                    if (!xOnlyValid) {
                        newPosition.x = oldX;
                    }

                    const zOnlyValid = isValidDungeonPosition(newPosition.x, newPosition.z, buffer, playerY);
                    if (!zOnlyValid) {
                        newPosition.z = oldZ;
                    }
                } else {
                    // Just spawned - clamp to center of hub (Simple fallback)
                    newPosition.x = Math.max(-10, Math.min(10, newPosition.x));
                    newPosition.z = Math.max(-10, Math.min(10, newPosition.z));
                }
            }

            // Pillar collision detection - prevent movement into pillars
            if (pillars.length > 0) {
                const playerRadius = 0.5; // Player collision radius
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
        } // End of horizontal movement block

        // ========== JUMP PHYSICS (runs every frame) ==========
        // Initiate jump if grounded and Space pressed
        if (wantsJump && isGrounded.current) {
            verticalVelocity.current = JUMP_FORCE;
            isGrounded.current = false;
        }

        // Query dynamic floor height from stair/platform registry
        const dynamicFloorY = getFloorHeightAt(newPosition.x, newPosition.z, camera.position.y, 0.3, currentLocation);
        const currentFloorLevel = eyeLevel + dynamicFloorY; // Eye level above the floor

        // Apply gravity
        if (!isGrounded.current) {
            verticalVelocity.current -= GRAVITY * delta;
            newPosition.y = camera.position.y + verticalVelocity.current * delta;

            // Check for landing on floor or stairs
            if (newPosition.y <= currentFloorLevel) {
                newPosition.y = currentFloorLevel;
                verticalVelocity.current = 0;
                isGrounded.current = true;
            }
        } else {
            // When grounded, check if we walked off a ledge
            // If floor is more than 0.5ft below current position, start falling
            if (currentFloorLevel < camera.position.y - 0.5) {
                isGrounded.current = false;
                verticalVelocity.current = 0; // Start with no velocity, gravity will pull down
            } else {
                // Follow the floor height (allows walking up/down stairs)
                newPosition.y = currentFloorLevel;
            }
        }

        // ========== PARKOUR FALL RESPAWN ==========
        // If player falls too far in the stairwell area (no catch floor), reset to hub
        // Stairwell spans Z=184 to Z=220, falling below Y=-25 triggers respawn
        if (currentLocation === 'backstage_halls' &&
            newPosition.z >= 184 && newPosition.z <= 220 &&
            newPosition.y < -25) {
            console.log('Fell off parkour stairs! Respawning to hub...');
            newPosition.set(0, eyeLevel, 0);
            verticalVelocity.current = 0;
            isGrounded.current = true;
        }

        // Apply new position
        camera.position.copy(newPosition);

        // Sync position to player store for HUD display (skip during location transitions)
        if (!skipPositionSync.current) {
            usePlayerStore.getState().setPosition(newPosition.x, newPosition.y, newPosition.z);
        }
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
