import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  createBadRequestError,
  createConflictError,
  createForbiddenError,
  createNotFoundError,
} from 'lacis';
import type { AuthUser, Friend, FriendRequest, Share, SharedBooking } from './types';

// Persistence is a single JSON file with atomic writes. Zero external services,
// fine for a low-volume friends/sharing feature. The whole DB is held in memory
// and read-modify-write operations are serialized to avoid lost updates. To run
// on a serverless platform (no persistent FS), swap this module for a KV/Redis
// implementation — the exported function surface is all the routes depend on.

interface DB {
  users: Record<string, AuthUser & { updatedAt: string }>;
  emailIndex: Record<string, string>; // lowercased email -> user id
  friendRequests: FriendRequest[];
  shares: Share[];
}

const DATA_FILE = process.env.DATA_FILE || join(process.cwd(), 'data', 'db.json');

function emptyDb(): DB {
  return { users: {}, emailIndex: {}, friendRequests: [], shares: [] };
}

const emailKey = (e: string) => e.trim().toLowerCase();
const fullName = (u: AuthUser) => [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email;

let cache: DB | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function load(): Promise<DB> {
  if (cache) return cache;
  try {
    const raw = await readFile(DATA_FILE, 'utf-8');
    cache = { ...emptyDb(), ...(JSON.parse(raw) as Partial<DB>) };
  } catch {
    cache = emptyDb();
  }
  return cache;
}

async function persist(db: DB): Promise<void> {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  const tmp = `${DATA_FILE}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(db, null, 2));
  await rename(tmp, DATA_FILE);
}

// Serialize read-modify-write operations through a single promise chain. Each op
// runs after the previous one settles; a failing op rejects its own caller but
// must NOT poison the chain for later ops, so the chain swallows the outcome.
async function mutate<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const run = writeChain.then(async () => {
    const db = await load();
    const result = await fn(db);
    await persist(db);
    return result;
  });
  writeChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

// --- Users ---

export async function upsertUser(user: AuthUser): Promise<void> {
  await mutate((db) => {
    db.users[user.id] = { ...user, updatedAt: new Date().toISOString() };
    db.emailIndex[emailKey(user.email)] = user.id;
    // Bind any requests/shares that were addressed to this email before the
    // recipient had ever logged in.
    const key = emailKey(user.email);
    for (const r of db.friendRequests) {
      if (!r.toId && emailKey(r.toEmail) === key) r.toId = user.id;
    }
    for (const s of db.shares) {
      if (!s.toId && emailKey(s.toEmail) === key) s.toId = user.id;
    }
  });
}

// --- Friends ---

// An accepted request where the user is on either side.
function acceptedFor(db: DB, user: AuthUser): FriendRequest[] {
  const key = emailKey(user.email);
  return db.friendRequests.filter(
    (r) =>
      r.status === 'accepted' &&
      (r.fromId === user.id || emailKey(r.fromEmail) === key || emailKey(r.toEmail) === key)
  );
}

function isFriendWith(db: DB, user: AuthUser, otherEmail: string): boolean {
  const key = emailKey(otherEmail);
  return acceptedFor(db, user).some(
    (r) => emailKey(r.fromEmail) === key || emailKey(r.toEmail) === key
  );
}

export async function listFriends(user: AuthUser): Promise<Friend[]> {
  const db = await load();
  const key = emailKey(user.email);
  return acceptedFor(db, user).map((r) => {
    const meIsFrom = r.fromId === user.id || emailKey(r.fromEmail) === key;
    const otherEmail = meIsFrom ? r.toEmail : r.fromEmail;
    const otherId = meIsFrom ? r.toId : r.fromId;
    const known = otherId ? db.users[otherId] : undefined;
    return {
      requestId: r.id,
      id: otherId,
      email: otherEmail,
      name: known ? fullName(known) : meIsFrom ? otherEmail : r.fromName,
      since: r.respondedAt ?? r.createdAt,
    };
  });
}

export async function listRequests(
  user: AuthUser
): Promise<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }> {
  const db = await load();
  const key = emailKey(user.email);
  const incoming = db.friendRequests.filter(
    (r) => r.status === 'pending' && emailKey(r.toEmail) === key
  );
  const outgoing = db.friendRequests.filter((r) => r.status === 'pending' && r.fromId === user.id);
  return { incoming, outgoing };
}

export async function createFriendRequest(user: AuthUser, toEmailRaw: string): Promise<FriendRequest> {
  const toEmail = toEmailRaw.trim();
  const toKey = emailKey(toEmail);
  if (toKey === emailKey(user.email)) {
    throw createBadRequestError('Vous ne pouvez pas vous ajouter vous-même.');
  }

  return mutate((db) => {
    if (isFriendWith(db, user, toEmail)) {
      throw createConflictError('Vous êtes déjà amis.');
    }

    // If the target already sent ME a pending request, accept it instead of
    // creating a mirror request.
    const reverse = db.friendRequests.find(
      (r) =>
        r.status === 'pending' &&
        emailKey(r.fromEmail) === toKey &&
        emailKey(r.toEmail) === emailKey(user.email)
    );
    if (reverse) {
      reverse.status = 'accepted';
      reverse.respondedAt = new Date().toISOString();
      reverse.toId = user.id;
      return reverse;
    }

    const existing = db.friendRequests.find(
      (r) => r.status === 'pending' && r.fromId === user.id && emailKey(r.toEmail) === toKey
    );
    if (existing) throw createConflictError('Demande déjà envoyée.');

    const request: FriendRequest = {
      id: randomUUID(),
      fromId: user.id,
      fromEmail: user.email,
      fromName: fullName(user),
      toEmail,
      toId: db.emailIndex[toKey] ?? null,
      status: 'pending',
      createdAt: new Date().toISOString(),
      respondedAt: null,
    };
    db.friendRequests.push(request);
    return request;
  });
}

export async function respondToRequest(
  user: AuthUser,
  id: string,
  action: 'accept' | 'decline'
): Promise<FriendRequest> {
  return mutate((db) => {
    const req = db.friendRequests.find((r) => r.id === id);
    if (!req) throw createNotFoundError('Demande introuvable.');
    if (emailKey(req.toEmail) !== emailKey(user.email)) {
      throw createForbiddenError("Cette demande ne vous est pas adressée.");
    }
    if (req.status !== 'pending') throw createConflictError('Demande déjà traitée.');
    req.status = action === 'accept' ? 'accepted' : 'declined';
    req.respondedAt = new Date().toISOString();
    req.toId = user.id;
    return req;
  });
}

// Cancel an outgoing pending request (sender side).
export async function cancelRequest(user: AuthUser, id: string): Promise<void> {
  await mutate((db) => {
    const idx = db.friendRequests.findIndex(
      (r) => r.id === id && r.fromId === user.id && r.status === 'pending'
    );
    if (idx === -1) throw createNotFoundError('Demande introuvable.');
    db.friendRequests.splice(idx, 1);
  });
}

// Remove an existing friendship (either side).
export async function removeFriend(user: AuthUser, requestId: string): Promise<void> {
  const key = emailKey(user.email);
  await mutate((db) => {
    const idx = db.friendRequests.findIndex(
      (r) =>
        r.id === requestId &&
        r.status === 'accepted' &&
        (r.fromId === user.id || emailKey(r.fromEmail) === key || emailKey(r.toEmail) === key)
    );
    if (idx === -1) throw createNotFoundError('Ami introuvable.');
    const [removed] = db.friendRequests.splice(idx, 1);
    // Drop shares exchanged with that person too. The friend's email is whichever
    // side of the removed friendship isn't us.
    const friendEmail =
      emailKey(removed.fromEmail) === key ? emailKey(removed.toEmail) : emailKey(removed.fromEmail);
    db.shares = db.shares.filter((s) => {
      const betweenUs =
        (s.fromId === user.id && emailKey(s.toEmail) === friendEmail) ||
        (emailKey(s.fromEmail) === friendEmail && emailKey(s.toEmail) === key);
      return !betweenUs;
    });
  });
}

// --- Shares ---

export async function createShare(
  user: AuthUser,
  toEmailRaw: string,
  booking: SharedBooking
): Promise<Share> {
  const toEmail = toEmailRaw.trim();
  return mutate((db) => {
    if (!isFriendWith(db, user, toEmail)) {
      throw createForbiddenError('Vous ne pouvez partager qu\'avec un ami.');
    }
    const share: Share = {
      id: randomUUID(),
      fromId: user.id,
      fromEmail: user.email,
      fromName: fullName(user),
      toEmail,
      toId: db.emailIndex[emailKey(toEmail)] ?? null,
      booking,
      createdAt: new Date().toISOString(),
    };
    // Replace a previous share of the same booking to the same friend (refresh).
    db.shares = db.shares.filter(
      (s) =>
        !(
          s.fromId === user.id &&
          emailKey(s.toEmail) === emailKey(toEmail) &&
          s.booking.bookingId === booking.bookingId
        )
    );
    db.shares.push(share);
    return share;
  });
}

export async function listShares(
  user: AuthUser
): Promise<{ received: Share[]; sent: Share[] }> {
  const db = await load();
  const key = emailKey(user.email);
  const received = db.shares
    .filter((s) => emailKey(s.toEmail) === key)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sent = db.shares
    .filter((s) => s.fromId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { received, sent };
}

export async function deleteShare(user: AuthUser, id: string): Promise<void> {
  const key = emailKey(user.email);
  await mutate((db) => {
    const idx = db.shares.findIndex(
      (s) => s.id === id && (s.fromId === user.id || emailKey(s.toEmail) === key)
    );
    if (idx === -1) throw createNotFoundError('Partage introuvable.');
    db.shares.splice(idx, 1);
  });
}
