import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // DATABASE_URL must point at Supabase's Supavisor TRANSACTION MODE pooler
  // (port 6543), not session mode (5432) — session mode hands each pg.Pool
  // connection its own dedicated Postgres backend connection with a small
  // total budget, which a handful of concurrent serverless invocations
  // exhausts (EMAXCONNECTION). Transaction mode multiplexes many client
  // connections onto few backend ones and is what this app is built for.
  // `max: 3` is deliberately small per-warm-instance — every request already
  // reuses this single pool (see globalForPrisma below), and Supavisor's own
  // pooling is what actually absorbs concurrency across serverless
  // invocations, not a large local pool.
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

// Singleton: exactly one PrismaClient/pg.Pool per warm process, cached on
// globalThis so Next.js dev-mode HMR and repeated server-action imports
// never construct a second one. Every service/action in this codebase must
// import `db` from here rather than calling `new PrismaClient()` itself.
export const db = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = db;
