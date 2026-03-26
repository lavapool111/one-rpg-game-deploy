'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { PointerLockControls as DreiPointerLockControls } from '@react-three/drei';
import { Vector3, Euler, MathUtils } from 'three';
import { useGameStore, usePlayerStore } from '@/lib/store';
import { useAccessoryStore } from '@/lib/store/accessoryStore';
import { GAME_CONFIG } from '@/lib/game/config';
import { Pillar } from '@/lib/game/pillars';
import { isValidDungeonPosition } from '@/lib/game/collision';
import { isValidBandRoomPosition } from '@/lib/game/bandRoomCollision';
import { ALTAR_ROOM_CENTER_Z } from './AltarRoom';
import { getFloorHeightAt, isCollidingWithObstacle } from '@/lib/game/stairCollision';

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
interface _MovementState {
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
    const GRAVITY = GAME_CONFIG.GRAVITY;
    const JUMP_FORCE = GAME_CONFIG.STARTING_JUMP_FORCE;

    // Detect mobile device
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Handle pointer lock events and errors
    useEffect(() => {
        const handlePointerLockChange = () => {
            const locked = document.pointerLockElement === gl.domElement;
            setIsLocked(locked);
            onLockChange?.(locked);
        };

        const handlePointerLockError = (event: Event) => {
            console.warn('Pointer lock failed:', event);
            setIsLocked(false);
            onLockChange?.(false);
        };

        document.addEventListener('pointerlockchange', handlePointerLockChange);
        document.addEventListener('pointerlockerror', handlePointerLockError);

        return () => {
            document.removeEventListener('pointerlockchange', handlePointerLockChange);
            document.removeEventListener('pointerlockerror', handlePointerLockError);
        };
    }, [gl.domElement, onLockChange]);

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
            const savedPos = usePlayerStore.getState().position;
            const savedY = savedPos && savedPos[1] !== 0 ? savedPos[1] : eyeLevel;
            camera.position.set(savedPos ? savedPos[0] : 0, savedY, savedPos ? savedPos[2] : 0);
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
                const savedY = savedPosition[1] !== 0 ? savedPosition[1] : eyeLevel;
                camera.position.set(savedPosition[0], savedY, savedPosition[2]);
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

    // Listen for external teleports from the store (e.g. debug shortcuts or boss transitions)
    useEffect(() => {
        return usePlayerStore.subscribe(
            state => state.position,
            (newPos) => {
                // If the camera is far from the new store position, it was an external teleport
                const dx = camera.position.x - newPos[0];
                const dy = camera.position.y - newPos[1];
                const dz = camera.position.z - newPos[2];
                const distSq = dx * dx + dy * dy + dz * dz;

                // If jumping more than 1ft, sync camera to store and temporarily disable frame-sync
                if (distSq > 1.0) {
                    console.log('External teleport detected, syncing camera to:', newPos);
                    camera.position.set(newPos[0], newPos[1], newPos[2]);
                    skipPositionSync.current = true;
                    setTimeout(() => {
                        skipPositionSync.current = false;
                    }, 50);
                }
            }
        );
    }, [camera]);

    // On mount: hydrate position and disable sync temporarily
    useEffect(() => {
        // Skip sync on mount to prevent frame from overwriting store position
        skipPositionSync.current = true;

        const savedPosition = usePlayerStore.getState().position;
        console.log('Component mounted: hydrating to', savedPosition);
        const savedY = savedPosition[1] !== 0 ? savedPosition[1] : eyeLevel;
        camera.position.set(savedPosition[0], savedY, savedPosition[2]);

        // Re-enable sync after mount settles
        setTimeout(() => {
            skipPositionSync.current = false;
        }, 300);
    }, []); // Empty deps = run once on mount



    // Keyboard event handlers
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (!enabled) return;
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        keys.current.add(event.code);
    }, [enabled]);

    const handleKeyUp = useCallback((event: KeyboardEvent) => {
        keys.current.delete(event.code);
    }, []);

    // Set up event listeners for keyboard
    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
        };
    }, [handleKeyDown, handleKeyUp]);

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
            camera.position.set(targetPosition[0], targetPosition[1], targetPosition[2]);

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

    useFrame((_state, delta) => {
        if (!enabled) return;

        // Cap delta to prevent extreme movement during lag spikes or tab switching
        const safeDelta = Math.min(delta, 0.1);

        // Check for location desync (Store updated but component hasn't re-rendered yet)
        // This prevents overwriting the store position with stale coordinates during transition
        if (useGameStore.getState().currentLocation !== currentLocation) return;

        // Tick reed durability
        if (gameState === 'playing') {
            useAccessoryStore.getState().tickReedDurability(delta);

            // Anti-camping: Reset tempo if idle for 30s
            const playerState = usePlayerStore.getState();
            const idleTime = Date.now() - playerState.lastMoveTime;
            if (idleTime > 30000 && playerState.tempo > 0) {
                usePlayerStore.setState({ tempo: 0, rating: 'F' });
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

            // Apply speed modifier to base speed (using dynamic player stat instead of hardcode)
            const playerSpeedStat = playerState.speed;
            const currentSpeed = (isSprinting ? playerSpeedStat * GAME_CONFIG.SPRINT_FACTOR : playerSpeedStat) * speedModifier;
            velocity.current.copy(direction.current).multiplyScalar(currentSpeed * safeDelta);

            // Apply horizontal movement
            newPosition.add(velocity.current);

            // ========== BAND ROOM & ALTAR ROOM COLLISION ==========
            if (currentLocation === 'band_room') {
                const buffer = 0.5;
                if (!isValidBandRoomPosition(newPosition.x, newPosition.z, buffer)) {
                    // Try sliding - check if X movement alone is valid
                    const xOnlyValid = isValidBandRoomPosition(newPosition.x, camera.position.z, buffer);
                    // Check if Z movement alone is valid
                    const zOnlyValid = isValidBandRoomPosition(camera.position.x, newPosition.z, buffer);

                    if (xOnlyValid) {
                        // Slide along X
                        newPosition.z = camera.position.z;
                    } else if (zOnlyValid) {
                        // Slide along Z
                        newPosition.x = camera.position.x;
                    } else {
                        // Both axes blocked, full stop
                        newPosition.x = camera.position.x;
                        newPosition.z = camera.position.z;
                    }
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

            // Obstacle collision detection (e.g. Vaults)
            const playerRadius = 0.5; // Player collision radius
            const playerHeight = 5.0; // Player collision height
            const playerFeetY = camera.position.y - eyeLevel;

            // Check if New Position collides with obstacles
            if (isCollidingWithObstacle(newPosition.x, playerFeetY, newPosition.z, playerRadius, playerHeight)) {
                // Try X axis only
                if (!isCollidingWithObstacle(newPosition.x, playerFeetY, camera.position.z, playerRadius, playerHeight)) {
                    newPosition.z = camera.position.z;
                }
                // Try Z axis only
                else if (!isCollidingWithObstacle(camera.position.x, playerFeetY, newPosition.z, playerRadius, playerHeight)) {
                    newPosition.x = camera.position.x;
                }
                // Block both
                else {
                    newPosition.x = camera.position.x;
                    newPosition.z = camera.position.z;
                }
            }

            // Pillar collision detection - prevent movement into pillars
            if (pillars.length > 0) {
                const playerRadius = 0.5; // Player collision radius

                // Optimized check: only check pillars if within arena radius + buffer
                const distFromCenterSq = newPosition.x * newPosition.x + newPosition.z * newPosition.z;
                const bufferRadiusSq = (400) * (400); // Arena is 375m radius

                if (distFromCenterSq < bufferRadiusSq) {
                    for (const pillar of pillars) {
                        const baseRadius = pillar.radius * 1.5;
                        const minDist = baseRadius + playerRadius + pillarCollisionPadding;
                        const minDistSq = minDist * minDist;

                        // Calculate squared distance from new position to pillar center
                        const dx = newPosition.x - pillar.x;
                        const dz = newPosition.z - pillar.z;
                        const distToPillarSq = dx * dx + dz * dz;

                        if (distToPillarSq < minDistSq) {
                            // Only calculate sqrt if we actually collide
                            const distToPillar = Math.sqrt(distToPillarSq);
                            const pushDir = distToPillar > 0.001
                                ? { x: dx / distToPillar, z: dz / distToPillar }
                                : { x: 1, z: 0 };

                            newPosition.x = pillar.x + pushDir.x * minDist;
                            newPosition.z = pillar.z + pushDir.z * minDist;
                        }
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
        // Higher step tolerance in the Altar Room area to allow walking up the steps
        const stepTolerance = currentLocation === 'band_room' ? 1.2 : 0.3;
        const dynamicFloorY = getFloorHeightAt(newPosition.x, newPosition.z, camera.position.y, stepTolerance, currentLocation);
        const currentFloorLevel = eyeLevel + dynamicFloorY; // Eye level above the floor

        // Apply gravity
        if (!isGrounded.current) {
            verticalVelocity.current -= GRAVITY * safeDelta;
            newPosition.y = camera.position.y + verticalVelocity.current * safeDelta;

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
    if (!isMobile && enabled && gameState === 'playing') {
        return (
            <DreiPointerLockControls
                ref={controlsRef as React.Ref<any>}
                enabled={true}
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
        const updateLock = () => setIsLocked(!!document.pointerLockElement);
        document.addEventListener('pointerlockchange', updateLock);
        updateLock(); // Initial check
        return () => document.removeEventListener('pointerlockchange', updateLock);
    }, []);

    return { isLocked };
}

export default FirstPersonController;
