import { Controller } from '@nestjs/common';

import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

import { extractOrgNumericId } from '@grabdy/common';
import { retrievalContract } from '@grabdy/contracts';

import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { OrgAccess } from '../../common/decorators/org-roles.decorator';

import { RetrievalService } from './retrieval.service';

@Controller()
export class RetrievalController {
  constructor(private retrievalService: RetrievalService) {}

  @OrgAccess(retrievalContract.query, { params: ['orgId'] })
  @TsRestHandler(retrievalContract.query)
  async query() {
    return tsRestHandler(retrievalContract.query, async ({ params, body }) => {
      try {
        const result = await this.retrievalService.query(params.orgId, body.query, {
          collectionId: body.collectionId,
          limit: body.limit,
        });
        return {
          status: 200 as const,
          body: {
            success: true as const,
            data: result,
          },
        };
      } catch (error) {
        return {
          status: 400 as const,
          body: {
            success: false as const,
            error: error instanceof Error ? error.message : 'Query failed',
          },
        };
      }
    });
  }

  @OrgAccess(retrievalContract.chat, { params: ['orgId'] })
  @TsRestHandler(retrievalContract.chat)
  async chat(@CurrentUser() user: JwtPayload) {
    return tsRestHandler(retrievalContract.chat, async ({ params, body }) => {
      try {
        // Find the user's membership for this org
        const orgNum = extractOrgNumericId(params.orgId);
        const membership = user.memberships.find(
          (m) => extractOrgNumericId(m.id) === orgNum
        );

        if (!membership) {
          return {
            status: 400 as const,
            body: { success: false as const, error: 'No membership found' },
          };
        }

        const result = await this.retrievalService.chat(
          params.orgId,
          membership.id,
          body.message,
          {
            threadId: body.threadId,
            collectionId: body.collectionId,
          }
        );

        return {
          status: 200 as const,
          body: {
            success: true as const,
            data: result,
          },
        };
      } catch (error) {
        return {
          status: 400 as const,
          body: {
            success: false as const,
            error: error instanceof Error ? error.message : 'Chat failed',
          },
        };
      }
    });
  }
}
