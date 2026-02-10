import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { type JwtPayload, parseJwtPayload } from '../guards/auth.guard';

export type { JwtPayload };

/**
 * Extracts the authenticated user from the request.
 * Throws UnauthorizedException if no user is present (route not authenticated).
 *
 * Usage:
 *   @TsRestHandler(contract.endpoint)
 *   async handler(@CurrentUser() user: JwtPayload) { ... }
 *
 *   // Extract a single field:
 *   async handler(@CurrentUser('sub') userId: DbId<'User'>) { ... }
 */
export const CurrentUser = createParamDecorator(
  (
    data: keyof JwtPayload | undefined,
    ctx: ExecutionContext
  ): JwtPayload | JwtPayload[keyof JwtPayload] => {
    const request = ctx.switchToHttp().getRequest();
    const user: unknown = request.user;

    const payload = parseJwtPayload(user);
    if (!payload) {
      throw new UnauthorizedException('Not authenticated');
    }

    if (data) {
      return payload[data];
    }

    return payload;
  }
);
