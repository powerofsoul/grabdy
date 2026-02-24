import { Global, Module } from '@nestjs/common';

import { RetrievalModule } from '../retrieval/retrieval.module';
import { StorageModule } from '../storage/storage.module';

import { DataAgent } from './agents/data/data-agent';
import { SdkChatAgent } from './agents/sdk-chat/sdk-chat-agent';
import { SlackAgent } from './agents/slack-agent';
import { AgentMemoryService } from './services/memory.service';
import { RagSearchTool } from './tools/rag-search.tool';
import { SlackReplyTool } from './tools/slack-reply.tool';

@Global()
@Module({
  imports: [StorageModule, RetrievalModule],
  providers: [
    AgentMemoryService,
    RagSearchTool,
    SlackReplyTool,
    DataAgent,
    SdkChatAgent,
    SlackAgent,
  ],
  exports: [AgentMemoryService, RagSearchTool, DataAgent, SdkChatAgent, SlackAgent, SlackReplyTool],
})
export class AgentModule {}
