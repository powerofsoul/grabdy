import { Global, Module } from '@nestjs/common';

import { EmailProcessor } from './email.processor';
import { EmailService } from './email.service';

@Global()
@Module({
  providers: [EmailService, EmailProcessor],
  exports: [EmailService],
})
export class EmailModule {}
