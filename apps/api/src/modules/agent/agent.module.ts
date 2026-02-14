import { Global, Module } from '@nestjs/common';

import { StorageModule } from '../storage/storage.module';

import { AgentFactory } from './services/agent.factory';
import { AgentMemoryService } from './services/memory.service';
import { AgentStorageProvider } from './services/storage.provider';
import { CanvasTools } from './tools/canvas-tools';
import { RagSearchTool } from './tools/rag-search.tool';

@Global()
@Module({
  imports: [StorageModule],
  providers: [AgentStorageProvider, AgentMemoryService, RagSearchTool, CanvasTools, AgentFactory],
  exports: [AgentMemoryService, AgentFactory],
})
export class AgentModule {}
