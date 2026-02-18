import { dbIdSchema } from '@grabdy/common';
import { initContract } from '@ts-rest/core';
import { z } from 'zod';

import { workEmailSchema } from '../schemas/work-email.js';

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
  firstName: z.string(),
  lastName: z.string(),
  status: userStatus,
  memberships: z.array(membership),
});

export const authContract = c.router(
  {
    signup: {
      method: 'POST',
      path: '/signup',
      body: z.object({
        email: workEmailSchema,
        password: z.string().min(8, 'Password must be at least 8 characters'),
        firstName: z.string().min(1, 'First name is required'),
        lastName: z.string().min(1, 'Last name is required'),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: user }),
        409: z.object({ success: z.literal(false), error: z.string() }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    googleAuth: {
      method: 'POST',
      path: '/google',
      body: z.object({
        credential: z.string(),
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
        email: z.string().email('Please enter a valid email'),
        password: z.string().min(1, 'Password is required'),
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
      body: z.object({ email: z.string().email('Please enter a valid email') }),
      responses: {
        200: z.object({ success: z.literal(true), message: z.string() }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    resetPassword: {
      method: 'POST',
      path: '/reset-password',
      body: z.object({
        email: z.string().email('Please enter a valid email'),
        otp: z.string().length(6, 'Reset code must be 6 characters'),
        newPassword: z.string().min(8, 'Password must be at least 8 characters'),
      }),
      responses: {
        200: z.object({ success: z.literal(true), message: z.string() }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    updateProfile: {
      method: 'PATCH',
      path: '/profile',
      body: z
        .object({
          firstName: z.string().min(1, 'First name is required').optional(),
          lastName: z.string().min(1, 'Last name is required').optional(),
        })
        .refine((data) => data.firstName !== undefined || data.lastName !== undefined, {
          message: 'At least one field must be provided',
        }),
      responses: {
        200: z.object({ success: z.literal(true), data: user }),
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
    verifySetupToken: {
      method: 'POST',
      path: '/verify-setup-token',
      body: z.object({ token: z.string() }),
      responses: {
        200: z.object({
          success: z.literal(true),
          data: z.object({
            email: z.string(),
            orgName: z.string(),
          }),
        }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
    completeAccount: {
      method: 'POST',
      path: '/complete-account',
      body: z.object({
        token: z.string(),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        firstName: z.string().min(1, 'First name is required'),
        lastName: z.string().min(1, 'Last name is required'),
      }),
      responses: {
        200: z.object({ success: z.literal(true), data: user }),
        400: z.object({ success: z.literal(false), error: z.string() }),
      },
    },
  },
  { pathPrefix: '/auth' }
);
