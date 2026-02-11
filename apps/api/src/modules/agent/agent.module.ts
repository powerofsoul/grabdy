import { Global, Module } from '@nestjs/common';

import { AgentFactory } from './services/agent.factory';
import { AgentMemoryService } from './services/memory.service';
import { AgentStorageProvider } from './services/storage.provider';
import { RagSearchTool } from './tools/rag-search.tool';

@Global()
@Module({
  providers: [AgentStorageProvider, AgentMemoryService, RagSearchTool, AgentFactory],
  exports: [AgentMemoryService, AgentFactory],
})
export class AgentModule {}
