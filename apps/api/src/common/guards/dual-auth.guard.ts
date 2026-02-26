import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

import { InjectEnv } from '../../config/env.config';

import { parseJwtPayload } from './auth.guard';
import { SdkJwtGuard } from './sdk-jwt.guard';

/**
 * Guard that accepts either dashboard cookie auth or SDK Bearer auth.
 * Used for endpoints that must serve both dashboard users and SDK consumers
 * (e.g. the storage proxy for AI-generated image URLs).
 */
@Injectable()
export class DualAuthGuard implements CanActivate {
  constructor(
    @InjectEnv('jwtSecret') private jwtSecret: string,
    private sdkJwtGuard: SdkJwtGuard
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Try cookie auth (dashboard users)
    const cookieToken = request.cookies?.['auth_token'];
    if (typeof cookieToken === 'string') {
      try {
        const decoded = jwt.verify(cookieToken, this.jwtSecret, { algorithms: ['HS256'] });
        const payload = parseJwtPayload(decoded);
        if (payload) {
          request.user = payload;
          return true;
        }
      } catch {
        // Cookie invalid, fall through to SDK auth
      }
    }

    // Try SDK Bearer auth
    const authHeader = request.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return this.sdkJwtGuard.canActivate(context);
    }

    throw new UnauthorizedException('Not authenticated');
  }
}
