import { Injectable } from '@nestjs/common';

import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import type { DbId } from '@grabdy/common';
import {
  AiCallerType,
  type AiRequestSource,
  AiRequestType,
  type CanvasState,
  CHAT_MODEL,
} from '@grabdy/contracts';

import { AiUsageService } from '../../ai/ai-usage.service';
import { CANVAS_INSTRUCTIONS, summarizeCanvas } from '../../chat/canvas-prompt';
import { BaseAgent } from '../base-agent';
import { CanvasTools } from '../tools/canvas-tools';

const awsCredentials = fromNodeProviderChain();
const bedrockProvider = createAmazonBedrock({
  credentialProvider: async () => {
    const creds = await awsCredentials();
    return {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    };
  },
});
const CANVAS_LANGUAGE_MODEL = bedrockProvider(CHAT_MODEL.replace('amazon-bedrock/', ''));

@Injectable()
export class CanvasAgentFactory {
  constructor(
    private canvasTools: CanvasTools,
    private aiUsageService: AiUsageService
  ) {}

  create(opts: {
    orgId: DbId<'Org'>;
    userId: DbId<'User'>;
    threadId: DbId<'ChatThread'>;
    source: AiRequestSource;
    canvasState?: CanvasState;
  }): BaseAgent {
    const { orgId, userId, threadId, source, canvasState } = opts;

    const parts = [CANVAS_INSTRUCTIONS];
    if (canvasState && canvasState.cards.length > 0) {
      parts.push(summarizeCanvas(canvasState));
    }
    const instructions = parts.join('\n\n');

    const tools = this.canvasTools.create(threadId, orgId);

    return new BaseAgent(
      'canvas-agent',
      'Canvas Agent',
      instructions,
      tools,
      CHAT_MODEL,
      this.aiUsageService,
      {
        callerType: AiCallerType.MEMBER,
        requestType: AiRequestType.CHAT,
        context: { orgId, userId, source },
      },
      undefined,
      10,
      CANVAS_LANGUAGE_MODEL
    );
  }
}
