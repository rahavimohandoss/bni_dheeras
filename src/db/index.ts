import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/*
 * One `pg` pool for both environments:
 * - production: Neon (pooled connection string, TLS via sslmode=require)
 * - local dev:  PGlite served over the Postgres protocol (`npm run db:local`)
 *
 * The local PGlite server multiplexes a single connection, so the dev pool is
 * limited to one client. Never call `db` inside a `db.transaction()` callback;
 * use the `tx` argument, or the dev server will wait forever.
 */

const globalForDb = globalThis as unknown as { __bniPool?: Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn("[db] DATABASE_URL is not set; database calls will fail.");
  }
  const isLocal = !connectionString || /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
  const pool = new Pool({
    connectionString,
    max: Number(process.env.DB_POOL_MAX ?? (isLocal ? 1 : 5)),
    idleTimeoutMillis: 10_000,
    ssl: isLocal ? false : undefined,
  });
  pool.on("error", (err) => console.error("[db] idle client error", err));
  if (process.env.VERCEL) attachDatabasePool(pool);
  return pool;
}

export const pool = globalForDb.__bniPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.__bniPool = pool;

export const db = drizzle(pool, { schema });
export type DB = typeof db;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type DBOrTx = DB | Tx;
export { schema };
