
You are a Senior Software Engineer specializing in Next.js, Three.js, Supabase, and Prisma. Your task is to enhance an existing Next.js game project that currently stores player scores and settings locally using browser storage APIs. The goal is to migrate to an online persistence model using Supabase for user authentication (Google only) and data storage, with Prisma managing the database schema. You also need to implement a robust environment variable management strategy.

**Project Context:**
The existing game is built with Next.js and Three.js. It currently saves player scores and game settings (e.g., difficulty, sound preferences) in the user's local browser storage.

**Goal:**
Implement user authentication via Google OAuth using Supabase, migrate existing local player data to a Supabase PostgreSQL database, persist new game data online, and manage the database schema with Prisma, all while adhering to best practices for environment variable management.

**Instructions:**

**Phase 1: Environment and Project Setup**

1.  **Environment Variables:**
    *   Set up a `.env.local` file for local development and guide on how to configure `.env.production` for deployment.
    *   Include placeholders for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (if backend interactions require it), `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`.
    *   Ensure these variables are correctly loaded and accessible in the Next.js application (client-side `NEXT_PUBLIC_` prefix for public keys, server-side for secrets).

2.  **Supabase Project Configuration:**
    *   Provide steps to create a new Supabase project.
    *   Configure Google as an authentication provider in Supabase, including setting up the redirect URLs.
    *   Explain how to retrieve the Supabase URL, Anon Key, and potentially the Service Role Key.

3.  **Prisma Integration:**
    *   Initialize Prisma in the Next.js project.
    *   Configure Prisma to connect to the Supabase PostgreSQL database using the `DATABASE_URL` environment variable (which will be derived from Supabase credentials).
    *   Generate the initial Prisma client.

**Phase 2: Database Schema Definition with Prisma**

1.  **Define Prisma Schema:**
    *   Create a `User` model that integrates with Supabase's `auth.users` table, ensuring it can be linked to other game data. This model should at least include `id` (matching `auth.users.id`) and `email`.
    *   Define a `Score` model:
        *   `id`: String, unique identifier.
        *   `userId`: String, foreign key linking to the `User` model.
        *   `value`: Integer, the player's score.
        *   `timestamp`: DateTime, recording when the score was achieved (default to `now()`).
    *   Define a `Setting` model:
        *   `id`: String, unique identifier.
        *   `userId`: String, foreign key linking to the `User` model.
        *   `name`: String, e.g., "difficulty", "sound_volume".
        *   `value`: String, the setting's value (e.g., "hard", "75").
        *   `updatedAt`: DateTime, recording when the setting was last changed (default to `now()`, update `onUpdate`).
    *   Ensure proper relationships (one-to-many from User to Score/Setting) are established in the Prisma schema.

2.  **Database Migration:**
    *   Provide instructions and commands to run Prisma migrations to apply the schema to the Supabase database.

**Phase 3: User Authentication with Supabase and Google OAuth**

1.  **Supabase Client Setup:**
    *   Initialize the Supabase client in the Next.js application, using the public environment variables.
    *   Create a reusable client instance (e.g., in a utility file or context provider).

2.  **Google OAuth Login:**
    *   Implement a function for users to sign in with Google using `supabase.auth.signInWithOAuth()`.
    *   Handle redirects and session management after successful login.
    *   Integrate a "Login with Google" button into the game's UI.

3.  **User Session Management:**
    *   Implement logic to retrieve the current user session.
    *   Protect routes or game features that require authentication.
    *   Implement a logout functionality.

**Phase 4: Data Migration and Online Persistence**

1.  **Scan and Identify Local Storage Data:**
    *   Provide a strategy to identify and read existing score and setting data from `localStorage` within the Next.js application. Assume common keys like `game_score` and `game_settings`.

2.  **Data Migration Logic:**
    *   On a user's *first successful login* (i.e., when a new user account is created or linked to an existing Supabase user for the first time):
        *   Check if relevant score/setting data exists in local storage.
        *   If present, retrieve the data.
        *   Use Prisma to create new `Score` and `Setting` records in the Supabase database, associating them with the logged-in `userId`.
        *   After successful migration, clear the corresponding data from local storage to prevent re-migration.

3.  **Online Data Persistence:**
    *   Modify existing game functions (e.g., `saveScore`, `saveSettings`) to interact with the Supabase database via Prisma.
    *   When a user is logged in, ensure new scores and settings are saved to Supabase instead of local storage.
    *   Implement retrieval of user-specific scores and settings from Supabase when the user logs in, to load their progress and preferences.
    *   Handle cases where the user is not logged in (e.g., continue using local storage or disable saving).

**Phase 5: Security and Best Practices**

1.  **Row Level Security (RLS) in Supabase:**
    *   Suggest enabling RLS on the `scores` and `settings` tables in Supabase.
    *   Provide example RLS policies to ensure users can only read/write their own data.

2.  **Error Handling:**
    *   Implement robust error handling for all Supabase and Prisma interactions.

3.  **Code Structure:**
    *   Ensure the implementation is modular, with clear separation of concerns (e.g., dedicated Supabase client utility, Prisma client instance, data fetching/saving functions).

**Expected Output:**
Provide a detailed, step-by-step implementation plan, including relevant code snippets for each phase (e.g., `.env` file structure, Prisma schema, Supabase client initialization, login function, data migration logic, data saving/retrieval examples, RLS policies). Explain the rationale behind design choices and best practices for each step.
