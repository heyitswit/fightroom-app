import { createServer } from 'lacis';

// Node.js / Bun entry point. Lacis scans ./routes at startup (persistent
// filesystem), so this works out of the box on any Node host or VPS — no external
// database to provision. See README for the (serverless) Vercel/Netlify variant.
const PORT = Number(process.env.PORT) || 3000;

createServer('./routes', {
  port: PORT,
  isDev: process.env.NODE_ENV !== 'production',
  platform: 'netlify',
  cors: {
    // The mobile app has no fixed Origin, so allow any. Auth is per-request via
    // the Fight Room JWT (Authorization header), not cookies — so '*' is safe.
    origin: '*',
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
});

// eslint-disable-next-line no-console
console.log(`Fight Room share server listening on :${PORT}`);
