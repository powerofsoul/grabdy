import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import { workEmailSchema } from '../schemas/work-email.js';

const c = initContract();

export const demoRequestBodySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  company: z.string().min(1, 'Company is required'),
  email: workEmailSchema,
});

export const demoRequestContract = c.router(
  {
    submit: {
      method: 'POST',
      path: '/',
      body: demoRequestBodySchema,
      responses: {
        200: z.object({ success: z.literal(true) }),
      },
    },
  },
  { pathPrefix: '/demo-request' }
);
