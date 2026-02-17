import { dbIdSchema } from '@grabdy/common';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

const userSchema = z.object({
  id: dbIdSchema('User'),
  email: z.string(),
  name: z.string(),
  roles: z.array(z.string()),
  createdAt: z.string(),
});

export const usersContract = c.router(
  {
    list: {
      method: 'GET',
      path: '/orgs/:orgId/users',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      responses: {
        200: z.object({ success: z.literal(true), data: z.array(userSchema) }),
      },
    },
  },
  { pathPrefix: '' }
);
