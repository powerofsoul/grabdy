import { Global, Module } from '@nestjs/common';

import { AiService } from './ai.service';
import { AiUsageProcessor } from './ai-usage.processor';
import { AiUsageService } from './ai-usage.service';

@Global()
@Module({
  providers: [AiUsageService, AiService, AiUsageProcessor],
  exports: [AiUsageService, AiService],
})
export class AiModule {}
