'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { createClient } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

/**
 * Auth Store
 *
 * Manages Supabase authentication state on the client.
 * Provides login (Google OAuth), logout, and session monitoring.
 */

export interface AuthState {
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    isAuthenticated: boolean;

    // Actions
    initialize: () => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
    subscribeWithSelector((set, get) => ({
        user: null,
        session: null,
        isLoading: true,
        isAuthenticated: false,

        /**
         * Initialize: fetch the current session and subscribe to auth changes.
         * Call this once on app mount.
         */
        initialize: async () => {
            const supabase = createClient();

            // Get current session
            const { data: { session } } = await supabase.auth.getSession();
            set({
                user: session?.user ?? null,
                session: session ?? null,
                isAuthenticated: !!session?.user,
                isLoading: false,
            });

            // Listen for auth state changes (login, logout, token refresh)
            const { data: { subscription } } = supabase.auth.onAuthStateChange(
                (_event, session) => {
                    set({
                        user: session?.user ?? null,
                        session: session ?? null,
                        isAuthenticated: !!session?.user,
                        isLoading: false,
                    });
                }
            );

            // Store the unsubscribe function for cleanup if needed
            // In practice, this lives for the lifetime of the app
            if (typeof window !== 'undefined') {
                (window as any).__authSubscription = subscription;
            }
        },

        /**
         * Sign in with Google via Supabase OAuth.
         * Redirects the user to Google's login page.
         */
        signInWithGoogle: async () => {
            const supabase = createClient();
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                },
            });

            if (error) {
                console.error('[Auth] Google sign-in error:', error.message);
            }
        },

        /**
         * Sign out the current user.
         */
        signOut: async () => {
            const supabase = createClient();
            const { error } = await supabase.auth.signOut();

            if (error) {
                console.error('[Auth] Sign-out error:', error.message);
            }

            set({
                user: null,
                session: null,
                isAuthenticated: false,
            });
        },
    }))
);

export default useAuthStore;
