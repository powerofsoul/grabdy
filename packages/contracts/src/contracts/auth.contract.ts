import { dbIdSchema } from '@grabdy/common';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

const c = initContract();

const membership = z.object({
  id: dbIdSchema('OrgMembership'),
  orgId: dbIdSchema('Org'),
  orgName: z.string(),
  roles: z.array(z.string()),
});

const userStatus = z.enum(['ACTIVE', 'INACTIVE']);

const user = z.object({
  id: dbIdSchema('User'),
  email: z.string(),
  name: z.string(),
  status: userStatus,
  memberships: z.array(membership),
});

export const authContract = c.router(
  {
    register: {
      method: 'POST',
      path: '/register',
      body: z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(1),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: user }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    login: {
      method: 'POST',
      path: '/login',
      body: z.object({
        email: z.string().email(),
        password: z.string().min(1),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: user }),
        401: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    logout: {
      method: 'POST',
      path: '/logout',
      body: z.object({}),
      responses: {
        200: z.object({ success: z.literal(true) }),
      },
    },
    forgotPassword: {
      method: 'POST',
      path: '/forgot-password',
      body: z.object({ email: z.string().email() }),
      responses: {
        200: z.object({ success: z.literal(true), message: z.string() }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    resetPassword: {
      method: 'POST',
      path: '/reset-password',
      body: z.object({
        email: z.string().email(),
        otp: z.string().length(6),
        newPassword: z.string().min(8),
      }),
      responses: {
        200: z.object({ success: z.literal(true), message: z.string() }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    me: {
      method: 'GET',
      path: '/me',
      responses: {
        200: z.object({ success: z.literal(true), data: user }),
        401: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
  },
  { pathPrefix: '/api/auth' }
);
