import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';

import { Request } from 'express';

import type { JwtMembership } from '../guards/auth.guard';

export type { JwtMembership };

/**
 * Extracts the org membership resolved by OrgAccessGuard.
 *
 * Requires @OrgAccess() on the handler/controller — the guard
 * validates membership and attaches it to the request.
 *
 * Usage:
 *   @OrgAccess(contract.endpoint, { params: ['orgId'] })
 *   @TsRestHandler(contract.endpoint)
 *   async handler(@CurrentMembership() membership: JwtMembership) { ... }
 */
export const CurrentMembership = createParamDecorator(
  (_data: undefined, ctx: ExecutionContext): JwtMembership => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const membership = request.orgMembership;

    if (!membership) {
      throw new ForbiddenException(
        'No org membership on request — is @OrgAccess() applied to this handler?'
      );
    }

    return membership;
  }
);
