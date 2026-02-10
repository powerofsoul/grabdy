import { dbIdSchema } from '@grabdy/common';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

const orgSchema = z.object({
  id: dbIdSchema('Org'),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const memberSchema = z.object({
  id: dbIdSchema('OrgMembership'),
  userId: dbIdSchema('User'),
  orgId: dbIdSchema('Org'),
  roles: z.array(z.string()),
  email: z.string().optional(),
  name: z.string().optional(),
  createdAt: z.string(),
});

const pendingInvitationSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  roles: z.array(z.string()),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
});

export const orgsContract = c.router(
  {
    create: {
      method: 'POST',
      path: '/orgs',
      body: z.object({ name: z.string().min(1) }),
      responses: {
        200: z.object({ success: z.literal(true), data: orgSchema }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    get: {
      method: 'GET',
      path: '/orgs/:orgId',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      responses: {
        200: z.object({ success: z.literal(true), data: orgSchema }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    update: {
      method: 'PATCH',
      path: '/orgs/:orgId',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      body: z.object({ name: z.string().optional() }),
      responses: {
        200: z.object({ success: z.literal(true), data: orgSchema }),
        400: z.object({ success: z.literal(false), error: z.string() }),
        404: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    invite: {
      method: 'POST',
      path: '/orgs/:orgId/invite',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      body: z.object({
        email: z.string().email(),
        name: z.string(),
        roles: z.array(z.enum(['OWNER', 'ADMIN', 'MEMBER'])),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: pendingInvitationSchema }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    listMembers: {
      method: 'GET',
      path: '/orgs/:orgId/members',
      pathParams: z.object({ orgId: dbIdSchema('Org') }),
      responses: {
        200: z.object({ success: z.literal(true), data: z.array(memberSchema) }),
      },
    },
    removeMember: {
      method: 'DELETE',
      path: '/orgs/:orgId/members/:memberId',
      pathParams: z.object({
        orgId: dbIdSchema('Org'),
        memberId: dbIdSchema('OrgMembership'),
      }),
      body: z.object({}),
      responses: {
        200: z.object({ success: z.literal(true) }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
  },
  { pathPrefix: '/api' }
);
