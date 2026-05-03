import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

/**
 * Auth Callback Route
 *
 * Supabase redirects here after a successful Google OAuth login.
 * We exchange the auth code for a session, then upsert the user
 * into our Prisma users table (linked by Supabase auth.users UUID).
 */
export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/';

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            // Get the authenticated user
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                // Upsert user into our Prisma users table
                try {
                    await prisma.user.upsert({
                        where: { id: user.id },
                        update: {
                            email: user.email ?? '',
                            name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
                            avatarUrl: user.user_metadata?.avatar_url ?? null,
                        },
                        create: {
                            id: user.id,
                            email: user.email ?? '',
                            name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
                            avatarUrl: user.user_metadata?.avatar_url ?? null,
                        },
                    });
                    console.log('[Auth Callback] User upserted:', user.id);
                } catch (prismaError) {
                    console.error('[Auth Callback] Failed to upsert user:', prismaError);
                    // Don't block login if Prisma upsert fails
                }
            }

            const forwardedHost = request.headers.get('x-forwarded-host');
            const isLocalEnv = process.env.NODE_ENV === 'development';

            if (isLocalEnv) {
                return NextResponse.redirect(`${origin}${next}`);
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}${next}`);
            } else {
                return NextResponse.redirect(`${origin}${next}`);
            }
        }
    }

    // OAuth error — redirect to home with error indicator
    return NextResponse.redirect(`${origin}/?auth_error=true`);
}
