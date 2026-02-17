import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

export const waitlistContract = c.router(
  {
    join: {
      method: 'POST',
      path: '/join',
      body: z.object({
        name: z.string().min(1),
        email: z.string().email(),
      }),
      responses: {
        200: z.object({ success: z.literal(true) }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
  },
  { pathPrefix: '/waitlist' }
);
