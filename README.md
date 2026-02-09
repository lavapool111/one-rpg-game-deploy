# Music RPG Game

A music-driven RPG game built with Next.js, React Three Fiber, and TypeScript.

## 🎮 Project Structure

```
one-rpg-game-game/
├── app/                      # Next.js App Router
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Home page
│   └── globals.css          # Global styles
│
├── components/
│   ├── ui/                  # UI Components (HUD, menus)
│   │   ├── HUD.tsx         # In-game heads-up display
│   │   ├── MainMenu.tsx    # Main menu screen
│   │   └── index.ts        # Barrel exports
│   │
│   └── game/               # 3D Game Components
│       ├── Player.tsx      # Player character
│       ├── Enemy.tsx       # Enemy entities
│       ├── Environment.tsx # Game world environment
│       └── index.ts        # Barrel exports
│
├── lib/
│   ├── game/               # Game Logic
│   │   ├── combat.ts       # Combat system & damage calculation
│   │   ├── enemies.ts      # Enemy types & spawning
│   │   ├── scaling.ts      # Difficulty & phase progression
│   │   └── index.ts        # Barrel exports
│   │
│   └── store/              # State Management
│       ├── gameStore.ts    # Main Zustand game store
│       └── index.ts        # Barrel exports
│
├── types/                  # TypeScript Definitions
│   └── index.ts           # All game types & interfaces
│
├── hooks/                  # Custom React Hooks
│   └── index.ts           # Barrel exports
│
└── public/
    └── assets/            # Static Assets
        ├── models/        # 3D models (.glb, .gltf)
        ├── textures/      # Textures & images
        └── audio/         # Music & sound effects
```

## 🚀 Getting Started

```bash
# Install dependencies
npx pnpm install

# Start development server
npx pnpm dev

# Build for production
npx pnpm build
```

## � Deploy to Vercel

This project is optimized for deployment on [Vercel](https://vercel.com).

### Option 1: One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/priyak/one-rpg-game-game)

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to preview (development)
vercel

# Deploy to production
vercel --prod
```

### Option 3: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository
4. Vercel will auto-detect Next.js settings
5. Click **"Deploy"**

### Environment Variables

If your project uses environment variables, add them in the Vercel dashboard:
1. Go to your project settings
2. Navigate to **Environment Variables**
3. Add your variables for Production, Preview, and Development environments

## �🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 16** | React framework with App Router |
| **TypeScript** | Type-safe development |
| **Tailwind CSS** | Styling |
| **Three.js** | 3D graphics |
| **React Three Fiber** | React renderer for Three.js |
| **React Three Drei** | Useful helpers for R3F |
| **Zustand** | State management |
| **Dexie** | IndexedDB wrapper for save data |

## 📁 Folder Purposes

### `components/ui/`
UI overlay components that render on top of the 3D scene:
- **HUD**: Health bar, phase meter, score, combo counter
- **MainMenu**: Title screen, options, credits
- **PauseMenu**: In-game pause overlay
- **GameOver**: End screen with stats

### `components/game/`
3D components rendered in the React Three Fiber canvas:
- **Player**: Player character model and controls
- **Enemy**: Enemy entities with AI behavior
- **Environment**: Arena, lighting, and visual effects
- **Projectile**: Bullets and attacks

### `lib/game/`
Pure game logic modules (no React dependencies):
- **combat.ts**: Damage formulas, attack processing
- **enemies.ts**: Enemy configs, spawning logic
- **scaling.ts**: Phase progression, difficulty curves

### `lib/store/`
Zustand stores for state management:
- **gameStore.ts**: Core game state (score, health, phase)
- **audioStore.ts**: Audio playback state
- **settingsStore.ts**: User preferences

### `types/`
TypeScript interfaces and type definitions:
- Player, Enemy, Combat types
- Game state and session types
- Audio and settings types

### `public/assets/`
Static files served by Next.js:
- **models/**: 3D models in `.glb` or `.gltf` format
- **textures/**: Image textures for 3D models
- **audio/**: Background music and sound effects

## 🎯 Development Notes

1. **3D Components** must be wrapped in a React Three Fiber `<Canvas>`
2. **UI Components** use `'use client'` directive for client-side rendering
3. **Game Logic** should remain pure functions for testability
4. **State** flows through Zustand stores, subscribed to by components
