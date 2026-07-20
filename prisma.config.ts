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
    url: process.env.DATABASE_URL!,
  },
});
