import { randomUUID } from 'node:crypto';
import {
  createBadRequestError,
  createConflictError,
  createForbiddenError,
  createNotFoundError,
} from 'lacis';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { db } from './db/client';
import { friendRequests, shares, users } from './db/schema';
import type { AuthUser, Friend, FriendRequest, Share, SharedBooking } from './types';

// Persistence is a Postgres database accessed through Drizzle ORM. Concurrency is
// handled by the database (transactions), so there is no in-memory cache or write
// serialization here — safe to run on serverless (Vercel/Netlify) where each
// invocation is a fresh process. The exported function surface is unchanged from
// the previous JSON-file store, so the routes need no edits.

type Db = typeof db;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Querier = Db | Tx;

const emailKey = (e: string) => e.trim().toLowerCase();
const fullName = (u: AuthUser) => [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email;

// Case-insensitive email comparison helper (Postgres `lower(col) = value`).
const emailEq = (col: AnyPgColumn, email: string) =>
  eq(sql`lower(${col})`, emailKey(email));

async function userIdByEmail(q: Querier, email: string): Promise<string | null> {
  const [row] = await q
    .select({ id: users.id })
    .from(users)
    .where(emailEq(users.email, email))
    .limit(1);
  return row?.id ?? null;
}

// --- Users ---

export async function upsertUser(user: AuthUser): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(users)
      .values({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          updatedAt: new Date().toISOString(),
        },
      });

    // Bind any requests/shares that were addressed to this email before the
    // recipient had ever logged in.
    await tx
      .update(friendRequests)
      .set({ toId: user.id })
      .where(and(isNull(friendRequests.toId), emailEq(friendRequests.toEmail, user.email)));
    await tx
      .update(shares)
      .set({ toId: user.id })
      .where(and(isNull(shares.toId), emailEq(shares.toEmail, user.email)));
  });
}

// --- Friends ---

// Accepted requests where the user is on either side.
async function acceptedFor(q: Querier, user: AuthUser): Promise<FriendRequest[]> {
  return q
    .select()
    .from(friendRequests)
    .where(
      and(
        eq(friendRequests.status, 'accepted'),
        or(
          eq(friendRequests.fromId, user.id),
          emailEq(friendRequests.fromEmail, user.email),
          emailEq(friendRequests.toEmail, user.email)
        )
      )
    );
}

async function isFriendWith(q: Querier, user: AuthUser, otherEmail: string): Promise<boolean> {
  const key = emailKey(otherEmail);
  const accepted = await acceptedFor(q, user);
  return accepted.some((r) => emailKey(r.fromEmail) === key || emailKey(r.toEmail) === key);
}

export async function listFriends(user: AuthUser): Promise<Friend[]> {
  const key = emailKey(user.email);
  const accepted = await acceptedFor(db, user);

  // Resolve display names for friends that have a known account.
  const otherIds = accepted
    .map((r) => (r.fromId === user.id || emailKey(r.fromEmail) === key ? r.toId : r.fromId))
    .filter((id): id is string => Boolean(id));
  const known = otherIds.length
    ? await db.select().from(users).where(inArray(users.id, otherIds))
    : [];
  const byId = new Map(known.map((u) => [u.id, u]));

  return accepted.map((r) => {
    const meIsFrom = r.fromId === user.id || emailKey(r.fromEmail) === key;
    const otherEmail = meIsFrom ? r.toEmail : r.fromEmail;
    const otherId = meIsFrom ? r.toId : r.fromId;
    const friend = otherId ? byId.get(otherId) : undefined;
    return {
      requestId: r.id,
      id: otherId,
      email: otherEmail,
      name: friend ? fullName(friend) : meIsFrom ? otherEmail : r.fromName,
      since: r.respondedAt ?? r.createdAt,
    };
  });
}

export async function listRequests(
  user: AuthUser
): Promise<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }> {
  const [incoming, outgoing] = await Promise.all([
    db
      .select()
      .from(friendRequests)
      .where(and(eq(friendRequests.status, 'pending'), emailEq(friendRequests.toEmail, user.email))),
    db
      .select()
      .from(friendRequests)
      .where(and(eq(friendRequests.status, 'pending'), eq(friendRequests.fromId, user.id))),
  ]);
  return { incoming, outgoing };
}

export async function createFriendRequest(user: AuthUser, toEmailRaw: string): Promise<FriendRequest> {
  const toEmail = toEmailRaw.trim();
  const toKey = emailKey(toEmail);
  if (toKey === emailKey(user.email)) {
    throw createBadRequestError('Vous ne pouvez pas vous ajouter vous-même.');
  }

  return db.transaction(async (tx) => {
    if (await isFriendWith(tx, user, toEmail)) {
      throw createConflictError('Vous êtes déjà amis.');
    }

    // If the target already sent ME a pending request, accept it instead of
    // creating a mirror request.
    const [reverse] = await tx
      .update(friendRequests)
      .set({ status: 'accepted', respondedAt: new Date().toISOString(), toId: user.id })
      .where(
        and(
          eq(friendRequests.status, 'pending'),
          emailEq(friendRequests.fromEmail, toEmail),
          emailEq(friendRequests.toEmail, user.email)
        )
      )
      .returning();
    if (reverse) return reverse;

    const [existing] = await tx
      .select()
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.status, 'pending'),
          eq(friendRequests.fromId, user.id),
          emailEq(friendRequests.toEmail, toEmail)
        )
      )
      .limit(1);
    if (existing) throw createConflictError('Demande déjà envoyée.');

    const [request] = await tx
      .insert(friendRequests)
      .values({
        id: randomUUID(),
        fromId: user.id,
        fromEmail: user.email,
        fromName: fullName(user),
        toEmail,
        toId: await userIdByEmail(tx, toEmail),
        status: 'pending',
        createdAt: new Date().toISOString(),
        respondedAt: null,
      })
      .returning();
    return request;
  });
}

export async function respondToRequest(
  user: AuthUser,
  id: string,
  action: 'accept' | 'decline'
): Promise<FriendRequest> {
  return db.transaction(async (tx) => {
    const [req] = await tx.select().from(friendRequests).where(eq(friendRequests.id, id)).limit(1);
    if (!req) throw createNotFoundError('Demande introuvable.');
    if (emailKey(req.toEmail) !== emailKey(user.email)) {
      throw createForbiddenError('Cette demande ne vous est pas adressée.');
    }
    if (req.status !== 'pending') throw createConflictError('Demande déjà traitée.');

    const [updated] = await tx
      .update(friendRequests)
      .set({
        status: action === 'accept' ? 'accepted' : 'declined',
        respondedAt: new Date().toISOString(),
        toId: user.id,
      })
      .where(eq(friendRequests.id, id))
      .returning();
    return updated;
  });
}

// Cancel an outgoing pending request (sender side).
export async function cancelRequest(user: AuthUser, id: string): Promise<void> {
  const deleted = await db
    .delete(friendRequests)
    .where(
      and(
        eq(friendRequests.id, id),
        eq(friendRequests.fromId, user.id),
        eq(friendRequests.status, 'pending')
      )
    )
    .returning({ id: friendRequests.id });
  if (deleted.length === 0) throw createNotFoundError('Demande introuvable.');
}

// Remove an existing friendship (either side).
export async function removeFriend(user: AuthUser, requestId: string): Promise<void> {
  const key = emailKey(user.email);
  await db.transaction(async (tx) => {
    const [removed] = await tx
      .delete(friendRequests)
      .where(
        and(
          eq(friendRequests.id, requestId),
          eq(friendRequests.status, 'accepted'),
          or(
            eq(friendRequests.fromId, user.id),
            emailEq(friendRequests.fromEmail, user.email),
            emailEq(friendRequests.toEmail, user.email)
          )
        )
      )
      .returning();
    if (!removed) throw createNotFoundError('Ami introuvable.');

    // Drop shares exchanged with that person too. The friend's email is whichever
    // side of the removed friendship isn't us.
    const friendEmail =
      emailKey(removed.fromEmail) === key ? emailKey(removed.toEmail) : emailKey(removed.fromEmail);
    await tx
      .delete(shares)
      .where(
        or(
          and(eq(shares.fromId, user.id), emailEq(shares.toEmail, friendEmail)),
          and(emailEq(shares.fromEmail, friendEmail), emailEq(shares.toEmail, user.email))
        )
      );
  });
}

// --- Shares ---

export async function createShare(
  user: AuthUser,
  toEmailRaw: string,
  booking: SharedBooking
): Promise<Share> {
  const toEmail = toEmailRaw.trim();
  return db.transaction(async (tx) => {
    if (!(await isFriendWith(tx, user, toEmail))) {
      throw createForbiddenError('Vous ne pouvez partager qu\'avec un ami.');
    }

    // Replace a previous share of the same booking to the same friend (refresh).
    await tx
      .delete(shares)
      .where(
        and(
          eq(shares.fromId, user.id),
          emailEq(shares.toEmail, toEmail),
          eq(sql`${shares.booking}->>'bookingId'`, booking.bookingId)
        )
      );

    const [share] = await tx
      .insert(shares)
      .values({
        id: randomUUID(),
        fromId: user.id,
        fromEmail: user.email,
        fromName: fullName(user),
        toEmail,
        toId: await userIdByEmail(tx, toEmail),
        booking,
        createdAt: new Date().toISOString(),
      })
      .returning();
    return share;
  });
}

export async function listShares(user: AuthUser): Promise<{ received: Share[]; sent: Share[] }> {
  const [received, sent] = await Promise.all([
    db
      .select()
      .from(shares)
      .where(emailEq(shares.toEmail, user.email))
      .orderBy(desc(shares.createdAt)),
    db.select().from(shares).where(eq(shares.fromId, user.id)).orderBy(desc(shares.createdAt)),
  ]);
  return { received, sent };
}

export async function deleteShare(user: AuthUser, id: string): Promise<void> {
  const deleted = await db
    .delete(shares)
    .where(and(eq(shares.id, id), or(eq(shares.fromId, user.id), emailEq(shares.toEmail, user.email))))
    .returning({ id: shares.id });
  if (deleted.length === 0) throw createNotFoundError('Partage introuvable.');
}
