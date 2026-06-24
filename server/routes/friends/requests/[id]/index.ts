import { defineHandler } from 'lacis';
import { z } from 'zod';
import { requireAuth } from '../../../../src/auth';
import { cancelRequest, respondToRequest } from '../../../../src/store';

// PATCH /friends/requests/:id — accept or decline an incoming request.
export const PATCH = defineHandler({
  use: [requireAuth],
  params: z.object({ id: z.string() }),
  body: z.object({ action: z.enum(['accept', 'decline']) }),
  handler: async (req, res) => {
    const request = await respondToRequest(req.locals.user, req.params.id, req.body.action);
    res.json({ request });
  },
});

// DELETE /friends/requests/:id — cancel an outgoing request (sender side).
export const DELETE = defineHandler({
  use: [requireAuth],
  params: z.object({ id: z.string() }),
  handler: async (req, res) => {
    await cancelRequest(req.locals.user, req.params.id);
    res.status(204).send('');
  },
});
