import { defineConfig } from "drizzle-kit";

// drizzle-kit does not read .env files; load the local one when present.
try {
  process.loadEnvFile(".env.local");
} catch {
  // CI / Vercel provide DATABASE_URL directly.
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Migrations prefer Neon's direct connection (set by the Vercel–Neon integration).
  dbCredentials: { url: (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL)! },
  strict: true,
  verbose: true,
});
