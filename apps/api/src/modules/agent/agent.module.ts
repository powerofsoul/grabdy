import { Global, Module } from '@nestjs/common';

import { RetrievalModule } from '../retrieval/retrieval.module';
import { StorageModule } from '../storage/storage.module';

import { DataAgent } from './agents/data-agent';
import { AgentMemoryService } from './services/memory.service';
import { ImageAnalysisTool } from './tools/image-analysis.tool';
import { ListSourcesTool } from './tools/list-sources.tool';
import { RagSearchTool } from './tools/rag-search.tool';
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
    DataAgent,
  ],
  exports: [AgentMemoryService, RagSearchTool, DataAgent],
})
export class AgentModule {}
