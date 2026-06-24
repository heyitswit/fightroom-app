import '../env';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set. Add it to .env (local) or your platform env (Vercel/Netlify).');
}

// Reuse a single connection across dev hot-reloads and warm serverless
// invocations so we never exhaust the Postgres connection slots. `max: 1` keeps
// each serverless instance to one socket; `sslmode=require` is read from the URL.
const globalForDb = globalThis as unknown as { __frSql?: ReturnType<typeof postgres> };

const client =
  globalForDb.__frSql ??
  postgres(url, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== 'production') globalForDb.__frSql = client;

// Schema is created/updated with drizzle-kit (`npm run db:push` / `db:migrate`),
// not at runtime — see drizzle.config.ts.
export const db = drizzle(client, { schema });
