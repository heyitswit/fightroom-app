import { defineHandler } from 'lacis';
import { z } from 'zod';
import { requireAuth } from '../../../src/auth';
import { removeFriend } from '../../../src/store';

// DELETE /friends/:id — remove a friendship (id = the accepted request id).
export const DELETE = defineHandler({
  use: [requireAuth],
  params: z.object({ id: z.string() }),
  handler: async (req, res) => {
    await removeFriend(req.locals.user, req.params.id);
    res.status(204).send('');
  },
});
