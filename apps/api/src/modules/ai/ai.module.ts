import { Global, Module } from '@nestjs/common';

import { AiService } from './ai.service';
import { AiUsageService } from './ai-usage.service';

@Global()
@Module({
  providers: [AiUsageService, AiService],
  exports: [AiUsageService, AiService],
})
export class AiModule {}
