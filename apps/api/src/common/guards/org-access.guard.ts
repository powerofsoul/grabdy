import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { OrgRole } from '@db/enums';
import { Request } from 'express';

import { extractOrgNumericId, type OrgNumericId, UUID_RE } from '@grabdy/common';

import { ORG_ACCESS_KEY, OrgAccessMetadata } from '../decorators/org-roles.decorator';

/**
 * Global NestJS guard that enforces org access requirements declared
 * by the `@OrgAccess()` decorator.
 *
 * Checks declared IDs from params, query, and body all belong to the
 * same org, then verifies user membership from the JWT (zero DB queries).
 *
 * Runs after AuthGuard (user is authenticated).
 */
@Injectable()
export class OrgAccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const metadata = this.reflector.getAllAndOverride<OrgAccessMetadata | undefined>(
      ORG_ACCESS_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!metadata) return true;

    const req = context.switchToHttp().getRequest<Request>();
    let orgNumericId: OrgNumericId | null = null;
    let hasIds = false;

    const checkId = (value: unknown, label: string) => {
      if (typeof value !== 'string' || !UUID_RE.test(value)) {
        throw new ForbiddenException(`Invalid or missing ID: ${label}`);
      }
      hasIds = true;
      const idOrg = extractOrgNumericId(value);
      if (idOrg === 0) return; // global entity (User, AuthToken)
      if (orgNumericId === null) {
        orgNumericId = idOrg;
      } else if (idOrg !== orgNumericId) {
        throw new ForbiddenException(`${label} does not belong to this organization`);
      }
    };

    for (const field of metadata.params) {
      checkId(req.params?.[field], field);
    }

    for (const field of metadata.query) {
      checkId(req.query?.[field], field);
    }

    if (metadata.body) {
      for (const value of metadata.body(req.body ?? {})) {
        if (value == null) continue; // optional fields
        checkId(value, 'body');
      }
    }

    if (!hasIds) {
      throw new ForbiddenException('No org-scoped IDs found in request');
    }

    // All IDs were global entities — nothing to check
    if (orgNumericId === null) return true;

    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Not authenticated');
    }

    // In-memory lookup: find a membership whose packed UUID embeds the same org
    const membership = user.memberships.find((m) => extractOrgNumericId(m.id) === orgNumericId);

    if (!membership) {
      throw new ForbiddenException('You do not have access to this organization');
    }

    if (metadata.roles.length > 0) {
      const memberRoles: OrgRole[] = membership.roles;
      const hasRequiredRole = metadata.roles.some((role) => memberRoles.includes(role));
      if (!hasRequiredRole) {
        throw new ForbiddenException('Insufficient permissions for this action');
      }
    }

    return true;
  }
}
