import { Injectable } from '@nestjs/common';

import type { DbId } from '@grabdy/common';

import { AiCallerType, AiRequestType } from '../../../db/enums';
import { AiUsageService } from '../../ai/ai-usage.service';
import { DataAgent } from '../data-agent';
import { RagSearchTool } from '../tools/rag-search.tool';
import { AgentMemoryService } from './memory.service';

@Injectable()
export class AgentFactory {
  constructor(
    private memoryService: AgentMemoryService,
    private ragSearchTool: RagSearchTool,
    private aiUsageService: AiUsageService,
  ) {}

  createDataAgent(
    orgId: DbId<'Org'>,
    collectionId?: DbId<'Collection'>,
    userId?: DbId<'User'>,
  ): DataAgent {
    const ragTool = this.ragSearchTool.create(orgId, collectionId);

    return new DataAgent(
      { 'rag-search': ragTool },
      this.memoryService.getMemory(),
      this.aiUsageService,
      {
        callerType: AiCallerType.MEMBER,
        requestType: AiRequestType.CHAT,
        context: { orgId, userId },
      },
    );
  }
}
