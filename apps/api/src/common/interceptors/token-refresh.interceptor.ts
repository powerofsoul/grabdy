import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';

import { Request, Response } from 'express';
import { from, Observable, switchMap } from 'rxjs';

import { InjectEnv } from '../../config/env.config';
import { authCookieOptions, AuthService } from '../../modules/auth/auth.service';
import type { JwtPayload } from '../guards/auth.guard';

const TOKEN_REFRESH_THRESHOLD_S = 10 * 60; // 10 minutes

/**
 * Global interceptor that silently refreshes JWT tokens when they become stale.
 *
 * Execution order: AuthGuard -> OrgAccessGuard -> TokenRefreshInterceptor -> handler.
 *
 * On every authenticated request, checks the token's `iat` (issued-at) claim.
 * If the token is older than 10 minutes, fetches fresh memberships from the DB,
 * generates a new JWT, and sets it as a cookie on the response.
 */
@Injectable()
export class TokenRefreshInterceptor implements NestInterceptor {
  private readonly cookieOptions;

  constructor(
    private authService: AuthService,
    @InjectEnv('nodeEnv') nodeEnv: string
  ) {
    this.cookieOptions = authCookieOptions(nodeEnv);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user;

    // Skip for unauthenticated requests (@Public routes)
    if (!user?.iat) return next.handle();

    const tokenAgeS = Date.now() / 1000 - user.iat;
    if (tokenAgeS < TOKEN_REFRESH_THRESHOLD_S) return next.handle();

    // Token is stale — refresh before running the handler so the
    // Set-Cookie header is included even for streaming responses (SSE).
    const res = context.switchToHttp().getResponse<Response>();

    return from(this.refreshAndContinue(user, res)).pipe(switchMap(() => next.handle()));
  }

  private async refreshAndContinue(user: JwtPayload, res: Response): Promise<void> {
    try {
      const result = await this.authService.refreshToken(user);
      if (result) {
        res.cookie('auth_token', result.token, this.cookieOptions);
      }
    } catch {
      // Refresh failure is non-fatal — the old token is still valid
    }
  }
}
