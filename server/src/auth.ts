import { createUnauthorizedError } from 'lacis';
import type { Request } from 'lacis';
import { validateToken } from './fightroom';
import { upsertUser } from './store';
import type { AuthUser } from './types';

// Per-route guard. Reads the Fight Room JWT from the Authorization header,
// validates it against fightroom.fr, records/refreshes the user, and exposes the
// authenticated user on req.locals.user (typed via lacis-env.d.ts).
export async function requireAuth(req: Request): Promise<{ user: AuthUser }> {
  const header = req.getHeader('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim();
  if (!token) throw createUnauthorizedError('Token manquant.');

  const user = await validateToken(token);
  if (!user) throw createUnauthorizedError('Session Fight Room invalide ou expirée.');

  await upsertUser(user);
  return { user };
}
