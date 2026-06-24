import { defineHandler } from 'lacis';
import { z } from 'zod';
import { requireAuth } from '../../../src/auth';
import { deleteShare } from '../../../src/store';

// DELETE /shares/:id — remove a share (sender or recipient).
export const DELETE = defineHandler({
  use: [requireAuth],
  params: z.object({ id: z.string() }),
  handler: async (req, res) => {
    await deleteShare(req.locals.user, req.params.id);
    res.status(204).send('');
  },
});
