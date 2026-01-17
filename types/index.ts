/**
 * Game Types and Interfaces
 * Central type definitions for the Music RPG game
 */

// ============================================
// Player Types
// ============================================

export interface Player {
    id: string;
    position: Vector3;
    rotation: Vector3;
    health: number;
    maxHealth: number;
    speed: number;
}

export interface PlayerStats {
    attackPower: number;
    defense: number;
    critChance: number;
    speed: number;
}

// ============================================
// Enemy Types
// ============================================

export type EnemyType = 'basic' | 'ranged' | 'tank' | 'boss';

export interface Enemy {
    id: string;
    type: EnemyType;
    position: Vector3;
    rotation: Vector3;
    health: number;
    maxHealth: number;
    damage: number;
    speed: number;
    points: number;
    isActive: boolean;
}

export interface EnemySpawnConfig {
    type: EnemyType;
    count: number;
    delay: number;
}

// ============================================
// Combat Types
// ============================================

export interface AttackResult {
    damage: number;
    critical: boolean;
    combo: number;
    targetId: string;
}

export interface DamageEvent {
    sourceId: string;
    targetId: string;
    damage: number;
    timestamp: number;
}

// ============================================
// Game State Types
// ============================================

export type GameState = 'menu' | 'playing' | 'paused' | 'gameOver';

export interface PhaseConfig {
    phase: number;
    name: string;
    enemyMultiplier: number;
    spawnRate: number;
    requiredScore: number;
}

export interface GameSession {
    id: string;
    startTime: number;
    endTime?: number;
    score: number;
    maxCombo: number;
    enemiesDefeated: number;
    maxPhase: number;
}

// ============================================
// Utility Types
// ============================================

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

export interface Vector2 {
    x: number;
    y: number;
}

// ============================================
// Audio Types
// ============================================

export interface AudioTrack {
    id: string;
    name: string;
    bpm: number;
    duration: number;
    phases: AudioPhase[];
}

export interface AudioPhase {
    startTime: number;
    endTime: number;
    intensity: number;
}

// ============================================
// Save Data Types
// ============================================

export interface SaveData {
    version: number;
    highScore: number;
    totalPlayTime: number;
    sessions: GameSession[];
    settings: GameSettings;
}

export interface GameSettings {
    masterVolume: number;
    musicVolume: number;
    sfxVolume: number;
    showFPS: boolean;
    graphicsQuality: 'low' | 'medium' | 'high';
}
