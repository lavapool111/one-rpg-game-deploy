import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

/**
 * Cloud Save API
 *
 * GET  /api/saves       — Load the latest cloud save for the authenticated user
 * POST /api/saves       — Save game data to the cloud
 *
 * Requires authentication via Supabase session cookie.
 */

// GET: Load latest cloud save
export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const latestSave = await prisma.gameSave.findFirst({
            where: { userId: user.id },
            orderBy: { timestamp: 'desc' },
        });

        if (!latestSave) {
            return NextResponse.json({ save: null }, { status: 200 });
        }

        return NextResponse.json({
            save: {
                id: latestSave.id,
                timestamp: latestSave.timestamp.getTime(),
                data: latestSave.data,
            },
        });
    } catch (error) {
        console.error('[API /saves GET] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST: Save game data to cloud
export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { saveData, timestamp } = body;

        if (!saveData) {
            return NextResponse.json({ error: 'Missing saveData' }, { status: 400 });
        }

        // Create a new save record
        const newSave = await prisma.gameSave.create({
            data: {
                userId: user.id,
                timestamp: new Date(timestamp ?? Date.now()),
                data: saveData,
            },
        });

        // Cull old saves — keep only the latest 10
        const allSaves = await prisma.gameSave.findMany({
            where: { userId: user.id },
            orderBy: { timestamp: 'desc' },
            select: { id: true },
        });

        if (allSaves.length > 10) {
            const idsToDelete = allSaves.slice(10).map(s => s.id);
            await prisma.gameSave.deleteMany({
                where: { id: { in: idsToDelete } },
            });
        }

        return NextResponse.json({
            save: {
                id: newSave.id,
                timestamp: newSave.timestamp.getTime(),
            },
        });
    } catch (error) {
        console.error('[API /saves POST] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
