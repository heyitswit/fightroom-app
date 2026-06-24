import { defineHandler } from 'lacis';
import { z } from 'zod';
import { requireAuth } from '../../src/auth';
import { createShare, listShares } from '../../src/store';

const netcodeSchema = z.object({
  deviceName: z.string(),
  code: z.string().nullable(),
  status: z.string(),
  from: z.string(),
  until: z.string(),
});

const bookingSchema = z.object({
  bookingId: z.string(),
  room: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  timeZone: z.string(),
  netcodes: z.array(netcodeSchema),
});

// GET /shares — shares received (auto-pulled by friends) and shares I sent.
export const GET = defineHandler({
  use: [requireAuth],
  handler: async (req, res) => {
    res.json(await listShares(req.locals.user));
  },
});

// POST /shares — share a booking's access codes with a friend.
export const POST = defineHandler({
  use: [requireAuth],
  body: z.object({ toEmail: z.string().email(), booking: bookingSchema }),
  handler: async (req, res) => {
    const share = await createShare(req.locals.user, req.body.toEmail, req.body.booking);
    res.status(201).json({ share });
  },
});
