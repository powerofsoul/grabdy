import { Global, Module } from '@nestjs/common';

import { AiService } from './ai.service';
import { AiUsageFunctions } from './ai-usage.functions';
import { AiUsageService } from './ai-usage.service';

@Global()
@Module({
  providers: [AiUsageService, AiService, AiUsageFunctions],
  exports: [AiUsageService, AiService],
})
export class AiModule {}
