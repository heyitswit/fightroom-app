import type { AuthUser } from './types';

// We don't run our own account system. Identity is the user's existing Fight Room
// (Medusa) account: the app forwards its `_medusa_jwt`, and we confirm it against
// fightroom.fr to recover the real customer id/email. Results are cached briefly so
// we don't hammer fightroom on every request.

const BASE_URL = 'https://fightroom.fr';
const REGION_ID = 'reg_01KP9Z19XKXCGQC3HCH64EXA0R';
const TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  user: AuthUser;
  expires: number;
}

const cache = new Map<string, CacheEntry>();

interface MedusaCustomer {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

export async function validateToken(jwt: string): Promise<AuthUser | null> {
  if (!jwt) return null;

  const cached = cache.get(jwt);
  if (cached && cached.expires > Date.now()) return cached.user;

  try {
    const res = await fetch(`${BASE_URL}/api/storefront/customer`, {
      headers: {
        Cookie: `_medusa_jwt=${jwt}; _medusa_region_id=${REGION_ID}; _medusa_locale=fr-FR`,
        Referer: BASE_URL,
        Origin: BASE_URL,
      },
      // An expired session 307-redirects to /sign-in; never follow it.
      redirect: 'manual',
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { customer?: MedusaCustomer };
    const c = data.customer;
    if (!c?.id || !c.email) return null;

    const user: AuthUser = {
      id: c.id,
      email: c.email,
      firstName: c.first_name ?? '',
      lastName: c.last_name ?? '',
    };
    cache.set(jwt, { user, expires: Date.now() + TTL_MS });
    return user;
  } catch {
    return null;
  }
}
