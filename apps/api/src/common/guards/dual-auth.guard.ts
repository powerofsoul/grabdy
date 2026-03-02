import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

import { InjectEnv } from '../../config/env.config';

import { parseJwtPayload } from './auth.guard';
import { SdkJwtGuard } from './sdk-jwt.guard';

/**
 * Try cookie auth then SDK Bearer auth. Populates req.user / req.sdkAuth
 * when credentials are valid. Returns true if authenticated, false otherwise.
 * Never throws.
 */
async function tryAuthenticate(
  request: Request,
  jwtSecret: string,
  sdkJwtGuard: SdkJwtGuard,
  context: ExecutionContext
): Promise<boolean> {
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
      // Cookie invalid, fall through to SDK auth
    }
  }

  const authHeader = request.headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    try {
      return await sdkJwtGuard.canActivate(context);
    } catch {
      // SDK auth invalid, fall through
    }
  }

  return false;
}

/**
 * Guard that accepts either dashboard cookie auth or SDK Bearer auth.
 * Throws 401 if neither is present.
 */
@Injectable()
export class DualAuthGuard implements CanActivate {
  constructor(
    @InjectEnv('jwtSecret') private jwtSecret: string,
    private sdkJwtGuard: SdkJwtGuard
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (await tryAuthenticate(request, this.jwtSecret, this.sdkJwtGuard, context)) {
      return true;
    }
    throw new UnauthorizedException('Not authenticated');
  }
}

/**
 * Like DualAuthGuard but allows unauthenticated requests through.
 * Populates req.user / req.sdkAuth when credentials are present
 * so the controller can apply its own access logic (e.g. share_token).
 */
@Injectable()
export class OptionalDualAuthGuard implements CanActivate {
  constructor(
    @InjectEnv('jwtSecret') private jwtSecret: string,
    private sdkJwtGuard: SdkJwtGuard
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    await tryAuthenticate(request, this.jwtSecret, this.sdkJwtGuard, context);
    return true;
  }
}
