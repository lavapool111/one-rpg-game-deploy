import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * Prisma Client singleton for server-side database access (Prisma 7 compatible).
 *
 * In Prisma 7, we must provide a driver adapter (like @prisma/adapter-pg)
 * since built-in drivers were removed from the engine.
 */

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
    pool: Pool | undefined;
};

// Create a singleton Pool for the adapter
const pool = globalForPrisma.pool ?? new Pool({ 
    connectionString: process.env.DATABASE_URL,
    // Add pool management options if needed
});

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.pool = pool;
}

const adapter = new PrismaPg(pool);

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}
