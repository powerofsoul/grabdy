import { Controller, Req } from '@nestjs/common';

import { type DbId } from '@grabdy/common';
import { sharedChatsContract } from '@grabdy/contracts';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

import {
  CurrentMembership,
  JwtMembership,
} from '../../common/decorators/current-membership.decorator';
import { OrgAccess } from '../../common/decorators/org-roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { parseJwtPayload } from '../../common/guards/auth.guard';
import { InjectEnv } from '../../config/env.config';

import { SharedChatService } from './shared-chat.service';

@Controller()
export class SharedChatController {
  constructor(
    private sharedChatService: SharedChatService,
    @InjectEnv('jwtSecret') private readonly jwtSecret: string
  ) {}

  @OrgAccess(sharedChatsContract.createShare, { params: ['orgId'] })
  @TsRestHandler(sharedChatsContract.createShare)
  async createShare(@CurrentMembership() membership: JwtMembership) {
    return tsRestHandler(sharedChatsContract.createShare, async ({ params, body }) => {
      try {
        const share = await this.sharedChatService.createShare(
          params.orgId,
          params.threadId,
          membership.id,
          { isPublic: body.isPublic }
        );

        return {
          status: 200 as const,
          body: { success: true as const, data: share },
        };
      } catch (error) {
        return {
          status: 400 as const,
          body: {
            success: false as const,
            error: error instanceof Error ? error.message : 'Failed to create share',
          },
        };
      }
    });
  }

  @Public()
  @TsRestHandler(sharedChatsContract.getSharedChat)
  async getSharedChat(@Req() req: Request) {
    return tsRestHandler(sharedChatsContract.getSharedChat, async ({ params }) => {
      const viewerMembershipIds = this.extractMembershipIds(req);

      try {
        const snapshot = await this.sharedChatService.getByToken(
          params.shareToken,
          viewerMembershipIds
        );

        return {
          status: 200 as const,
          body: { success: true as const, data: snapshot },
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes('Authentication required')) {
          return {
            status: 401 as const,
            body: {
              success: false as const,
              error: 'Authentication required to view this shared chat',
            },
          };
        }
        if (error instanceof Error && error.message.includes('do not have access')) {
          return {
            status: 401 as const,
            body: { success: false as const, error: 'You do not have access to this shared chat' },
          };
        }
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Shared chat not found' },
        };
      }
    });
  }

  @OrgAccess(sharedChatsContract.listShares, { params: ['orgId'] })
  @TsRestHandler(sharedChatsContract.listShares)
  async listShares() {
    return tsRestHandler(sharedChatsContract.listShares, async ({ params }) => {
      const shares = await this.sharedChatService.listShares(params.orgId, params.threadId);

      return {
        status: 200 as const,
        body: { success: true as const, data: shares },
      };
    });
  }

  @OrgAccess(sharedChatsContract.revokeShare, { params: ['orgId'] })
  @TsRestHandler(sharedChatsContract.revokeShare)
  async revokeShare() {
    return tsRestHandler(sharedChatsContract.revokeShare, async ({ params }) => {
      try {
        await this.sharedChatService.revokeShare(params.orgId, params.threadId, params.shareId);

        return {
          status: 200 as const,
          body: { success: true as const },
        };
      } catch {
        return {
          status: 404 as const,
          body: { success: false as const, error: 'Share not found' },
        };
      }
    });
  }

  /**
   * Try to extract membership IDs from the JWT cookie.
   * Returns empty array if no valid JWT.
   */
  private extractMembershipIds(req: Request): DbId<'OrgMembership'>[] {
    const token = req.cookies?.['auth_token'];
    if (!token) return [];

    let decoded: unknown;
    try {
      decoded = jwt.verify(token, this.jwtSecret);
    } catch {
      return [];
    }

    const payload = parseJwtPayload(decoded);
    if (!payload) return [];

    return payload.memberships.map((m) => m.id);
  }
}
