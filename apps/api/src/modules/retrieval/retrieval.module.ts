import { Global, Module } from '@nestjs/common';

import { bedrockProvider } from '../agent/providers/bedrock.provider';

import { RerankService } from './rerank.service';
import { SearchService } from './search.service';

@Global()
@Module({
  providers: [SearchService, RerankService, bedrockProvider],
  exports: [SearchService, RerankService],
})
export class RetrievalModule {}
