import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { OrgRole } from '@db/enums';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { z } from 'zod';

import type { DbId } from '@grabdy/common';
import { dbIdSchema } from '@grabdy/common';

import { InjectEnv } from '../../config/env.config';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export interface JwtMembership {
  id: DbId<'OrgMembership'>;
  roles: OrgRole[];
}

export interface JwtPayloadShape {
  sub: DbId<'User'>;
  email: string;
  name: string;
  memberships: JwtMembership[];
  iat: number;
}

/**
 * Zod schema for JWT payload validation.
 * Brands user IDs at the trust boundary so controllers receive DbId<'User'>.
 */
export const jwtPayloadSchema: z.ZodType<JwtPayloadShape> = z.object({
  sub: dbIdSchema('User'),
  email: z.string(),
  name: z.string(),
  memberships: z.array(
    z.object({
      id: dbIdSchema('OrgMembership'),
      roles: z.array(z.enum(Object.values(OrgRole) as [OrgRole, ...OrgRole[]])),
    })
  ),
  iat: z.number(),
});

export type JwtPayload = JwtPayloadShape;

/**
 * Parse and validate JWT payload, returning null if invalid
 */
export function parseJwtPayload(value: unknown): JwtPayload | null {
  const result = jwtPayloadSchema.safeParse(value);
  return result.success ? result.data : null;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @InjectEnv('jwtSecret') private readonly jwtSecret: string,
    private reflector: Reflector
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();

    const token = request.cookies?.['auth_token'];
    if (!token) {
      throw new UnauthorizedException('Not authenticated');
    }

    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      const payload = parseJwtPayload(decoded);
      if (!payload) {
        throw new UnauthorizedException('Invalid token payload');
      }
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
