import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Creates a Supabase client for use in Server Components, Server Actions,
 * and Route Handlers. Reads/writes cookies for session management.
 *
 * Usage (in a Server Component or Server Action):
 *   import { createClient } from '@/lib/supabase/server';
 *   const supabase = await createClient();
 */
export async function createClient() {
    const cookieStore = await cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // setAll can fail in Server Components where cookies
                        // are read-only. This is fine — the middleware will
                        // handle the refresh instead.
                    }
                },
            },
        }
    );
}

/**
 * Creates a Supabase client with the service role key for admin operations.
 * This bypasses Row Level Security — use with extreme caution.
 *
 * Usage:
 *   import { createServiceClient } from '@/lib/supabase/server';
 *   const supabaseAdmin = createServiceClient();
 */
export function createServiceClient() {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            cookies: {
                getAll() { return []; },
                setAll() { },
            },
        }
    );
}
