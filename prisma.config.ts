import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load Next.js env files (env.local takes precedence)
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // CLI operations (db push / migrate) run DDL + advisory locks, which
    // Supavisor's transaction-mode pooler doesn't support reliably — use the
    // session-safe DIRECT_URL. DATABASE_URL (transaction mode) is reserved
    // for the app runtime's driver adapter (see lib/db.ts). Falls back to
    // DATABASE_URL only if DIRECT_URL isn't set (e.g. a plain direct Postgres
    // connection with no separate pooler tiers).
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});
