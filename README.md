# CODA

A music-driven RPG game built with Next.js, React Three Fiber, and TypeScript


## 📦 Production Build Output (`/dist`)

When you run `npm run build`, the production build is output to the `/dist` directory (as configured in `next.config.ts`).

**Typical `/dist` structure:**

```
dist/
    dev/
        build/                # Build artifacts (chunks, postcss, etc)
        build-manifest.json    # Manifest of built files
        cache/                 # Build cache
        fallback-build-manifest.json
        lock                   # Build lock file
        logs/                  # Build logs
        package.json           # Internal build package info
        prerender-manifest.json # Prerendering info (usually empty for dynamic apps)
        routes-manifest.json   # Routing info for the app
        server/                # Server output (SSR entrypoints, manifests)
        static/                # Static assets (chunks, media, etc)
        trace                  # Build trace info
        types/                 # TypeScript build types (if generated)
```

> Note: The actual contents may vary depending on your app's features and Next.js version. The `dist/dev/server` folder contains server-side code for SSR, while `dist/dev/static` contains static JS, CSS, and media assets.

---

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


## 🌐 Deployment & Hosting

### Does this game use server-based routing or is it static?

This project uses **Next.js App Router** and is built as a dynamic (server-based) app by default. The output in `/dist` includes server code for SSR (server-side rendering). It is **not a fully static site** out of the box, so it requires a Node.js server or a platform that supports Next.js SSR (like Vercel, Netlify, or custom Node hosting).

If you want a fully static export (for static hosting like GitHub Pages), you would need to:

- Only use static routes and client-side features (no server components or SSR APIs)
- Use `next export` (not supported with App Router as of Next.js 13+)
- Or, convert the app to use the Pages Router and static generation only

#### Can I deploy to GitHub Pages?

**Direct deployment to GitHub Pages is not supported for dynamic Next.js App Router projects.**

However, you can:
- Deploy to Vercel for free (recommended, see below)
- Use a static export if you refactor the app to be fully static (Pages Router, no SSR)
- Use a tool like [Static HTML Export](https://github.com/vercel/next.js/discussions/35773) for limited cases

**Summary:**
- By default, this game is not a static site and cannot be published directly to GitHub Pages.
- For free hosting, use [Vercel](https://vercel.com) or [Netlify](https://www.netlify.com/).

---

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

## 🛠️ Tech Stack

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
