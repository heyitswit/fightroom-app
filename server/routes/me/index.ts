import { defineHandler } from 'lacis';
import { requireAuth } from '../../src/auth';

// GET /me — the authenticated Fight Room user (also registers them so friends can
// resolve their email to an account).
export const GET = defineHandler({
  use: [requireAuth],
  handler: async (req, res) => {
    res.json({ user: req.locals.user });
  },
});
