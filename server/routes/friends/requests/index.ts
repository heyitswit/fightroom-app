import { defineHandler } from 'lacis';
import { z } from 'zod';
import { requireAuth } from '../../../src/auth';
import { createFriendRequest, listRequests } from '../../../src/store';

// GET /friends/requests — pending requests, split incoming/outgoing.
export const GET = defineHandler({
  use: [requireAuth],
  handler: async (req, res) => {
    res.json(await listRequests(req.locals.user));
  },
});

// POST /friends/requests — send a friend request by email.
export const POST = defineHandler({
  use: [requireAuth],
  body: z.object({ email: z.string().email() }),
  handler: async (req, res) => {
    const request = await createFriendRequest(req.locals.user, req.body.email);
    res.status(201).json({ request });
  },
});
