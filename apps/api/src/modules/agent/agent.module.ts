import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';

import { CANVAS_OPS_QUEUE } from '../queue/queue.constants';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { StorageModule } from '../storage/storage.module';

import { AgentFactory } from './services/agent.factory';
import { AgentMemoryService } from './services/memory.service';
import { AgentStorageProvider } from './services/storage.provider';
import { CanvasTools } from './tools/canvas-tools';
import { RagSearchTool } from './tools/rag-search.tool';
import { SlackReplyTool } from './tools/slack-reply.tool';

@Global()
@Module({
  imports: [StorageModule, RetrievalModule, BullModule.registerQueue({ name: CANVAS_OPS_QUEUE })],
  providers: [AgentStorageProvider, AgentMemoryService, RagSearchTool, SlackReplyTool, CanvasTools, AgentFactory],
  exports: [AgentMemoryService, AgentFactory, CanvasTools, SlackReplyTool],
})
export class AgentModule {}
