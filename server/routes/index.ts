import type { Request, Response } from 'lacis';

// Public health/info endpoint (no auth).
export async function GET(_req: Request, res: Response) {
  res.json({ name: 'Fight Room Share', status: 'ok' });
}
