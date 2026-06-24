import { jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import type { FriendRequestStatus, SharedBooking } from '../types';

// Timestamps are stored as ISO-8601 text (not native timestamptz) to preserve the
// exact string format the clients already consume and to keep ordering trivial.

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  firstName: text('first_name').notNull().default(''),
  lastName: text('last_name').notNull().default(''),
  updatedAt: text('updated_at').notNull(),
});

export const friendRequests = pgTable('friend_requests', {
  id: text('id').primaryKey(),
  fromId: text('from_id').notNull(),
  fromEmail: text('from_email').notNull(),
  fromName: text('from_name').notNull(),
  toEmail: text('to_email').notNull(),
  toId: text('to_id'), // resolved once the recipient logs in at least once
  status: text('status').$type<FriendRequestStatus>().notNull(),
  createdAt: text('created_at').notNull(),
  respondedAt: text('responded_at'),
});

export const shares = pgTable('shares', {
  id: text('id').primaryKey(),
  fromId: text('from_id').notNull(),
  fromEmail: text('from_email').notNull(),
  fromName: text('from_name').notNull(),
  toEmail: text('to_email').notNull(),
  toId: text('to_id'),
  booking: jsonb('booking').$type<SharedBooking>().notNull(),
  createdAt: text('created_at').notNull(),
});
