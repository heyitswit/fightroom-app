// Lightweight .env loader for local/dev (zero dependencies — uses Node's built-in
// loader). On Vercel/Netlify the platform injects env vars and no .env file
// exists, so the failure is swallowed. Import this module for its side effect
// before reading process.env.
try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the platform-provided environment.
}
