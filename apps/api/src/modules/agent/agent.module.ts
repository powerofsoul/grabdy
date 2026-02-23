import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';

import { CANVAS_OPS_QUEUE } from '../queue/queue.constants';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { StorageModule } from '../storage/storage.module';

import { DataAgent } from './agents/data/data-agent';
import { SlackAgent } from './agents/slack-agent';
import { AgentMemoryService } from './services/memory.service';
import { CanvasDelegateTool } from './tools/canvas-delegate.tool';
import { CanvasTools } from './tools/canvas-tools';
import { RagSearchTool } from './tools/rag-search.tool';
import { SlackReplyTool } from './tools/slack-reply.tool';

@Global()
@Module({
  imports: [StorageModule, RetrievalModule, BullModule.registerQueue({ name: CANVAS_OPS_QUEUE })],
  providers: [
    AgentMemoryService,
    RagSearchTool,
    SlackReplyTool,
    CanvasTools,
    CanvasDelegateTool,
    DataAgent,
    SlackAgent,
  ],
  exports: [
    AgentMemoryService,
    DataAgent,
    SlackAgent,
    CanvasTools,
    CanvasDelegateTool,
    SlackReplyTool,
  ],
})
export class AgentModule {}
