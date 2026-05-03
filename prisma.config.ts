// Prisma configuration — loads .env and .env.local for DATABASE_URL
import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Also load .env.local (higher priority, matches Next.js behavior)
dotenvConfig({ path: ".env.local", override: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // For Prisma CLI (migrate, introspect, studio), we use the Direct URL (port 5432)
    // because connection poolers (port 6543) often don't support DDL operations.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
