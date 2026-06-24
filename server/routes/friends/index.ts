import { defineHandler } from 'lacis';
import { requireAuth } from '../../src/auth';
import { listFriends } from '../../src/store';

// GET /friends — accepted friends.
export const GET = defineHandler({
  use: [requireAuth],
  handler: async (req, res) => {
    res.json({ friends: await listFriends(req.locals.user) });
  },
});
