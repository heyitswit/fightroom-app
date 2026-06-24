import './src/env';
import { defineConfig } from 'drizzle-kit';

// Schema migrations for the Postgres store. Run `npm run db:push` to sync the
// schema to the database, or `npm run db:generate` + `db:migrate` for versioned
// SQL migrations. Reads DATABASE_URL (loaded from .env via ./src/env).
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
