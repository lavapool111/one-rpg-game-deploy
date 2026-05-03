import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

/**
 * Settings API
 *
 * GET  /api/settings   — Load all settings for the authenticated user
 * POST /api/settings   — Upsert a setting (name/value pair)
 */

// GET: Load all settings
export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const settings = await prisma.setting.findMany({
            where: { userId: user.id },
        });

        // Transform to a simple { name: value } map for the client
        const settingsMap: Record<string, string> = {};
        for (const s of settings) {
            settingsMap[s.name] = s.value;
        }

        return NextResponse.json({ settings: settingsMap });
    } catch (error) {
        console.error('[API /settings GET] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST: Upsert a setting
export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, value } = body;

        if (!name || value === undefined) {
            return NextResponse.json({ error: 'Missing name or value' }, { status: 400 });
        }

        const setting = await prisma.setting.upsert({
            where: {
                userId_name: {
                    userId: user.id,
                    name: String(name),
                },
            },
            update: {
                value: String(value),
            },
            create: {
                userId: user.id,
                name: String(name),
                value: String(value),
            },
        });

        return NextResponse.json({ setting: { name: setting.name, value: setting.value } });
    } catch (error) {
        console.error('[API /settings POST] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
