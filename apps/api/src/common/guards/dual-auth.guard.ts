import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

import { InjectEnv } from '../../config/env.config';

import { parseJwtPayload } from './auth.guard';

/**
 * Try cookie auth. Populates req.user when credentials are valid.
 * Returns true if authenticated, false otherwise. Never throws.
 */
function tryAuthenticate(request: Request, jwtSecret: string): boolean {
  const cookieToken = request.cookies?.['auth_token'];
  if (typeof cookieToken === 'string') {
    try {
      const decoded = jwt.verify(cookieToken, jwtSecret, { algorithms: ['HS256'] });
      const payload = parseJwtPayload(decoded);
      if (payload) {
        request.user = payload;
        return true;
      }
    } catch {
      // Cookie invalid
    }
  }

  return false;
}

/**
 * Guard that accepts dashboard cookie auth.
 * Throws 401 if not authenticated.
 */
@Injectable()
export class DualAuthGuard implements CanActivate {
  constructor(@InjectEnv('jwtSecret') private jwtSecret: string) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (tryAuthenticate(request, this.jwtSecret)) {
      return true;
    }
    throw new UnauthorizedException('Not authenticated');
  }
}

/**
 * Like DualAuthGuard but allows unauthenticated requests through.
 * Populates req.user when credentials are present
 * so the controller can apply its own access logic (e.g. share_token).
 */
@Injectable()
export class OptionalDualAuthGuard implements CanActivate {
  constructor(@InjectEnv('jwtSecret') private jwtSecret: string) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    tryAuthenticate(request, this.jwtSecret);
    return true;
  }
}
