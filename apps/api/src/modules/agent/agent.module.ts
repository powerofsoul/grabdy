import { Global, Module } from '@nestjs/common';

import { RetrievalModule } from '../retrieval/retrieval.module';
import { StorageModule } from '../storage/storage.module';

import { DataAgent } from './agents/data-agent';
import { SdkChatAgent } from './agents/sdk-chat-agent';
import { SlackAgent } from './agents/slack-agent';
import { AgentMemoryService } from './services/memory.service';
import { ImageAnalysisTool } from './tools/image-analysis.tool';
import { ListSourcesTool } from './tools/list-sources.tool';
import { RagSearchTool } from './tools/rag-search.tool';
import { SlackReplyTool } from './tools/slack-reply.tool';
import { ThinkTool } from './tools/think.tool';

@Global()
@Module({
  imports: [StorageModule, RetrievalModule],
  providers: [
    AgentMemoryService,
    RagSearchTool,
    ListSourcesTool,
    ImageAnalysisTool,
    ThinkTool,
    SlackReplyTool,
    DataAgent,
    SdkChatAgent,
    SlackAgent,
  ],
  exports: [AgentMemoryService, RagSearchTool, DataAgent, SdkChatAgent, SlackAgent, SlackReplyTool],
})
export class AgentModule {}
