import { Global, Module } from '@nestjs/common';

import { EmailFunctions } from './email.functions';
import { EmailService } from './email.service';

@Global()
@Module({
  providers: [EmailService, EmailFunctions],
  exports: [EmailService],
})
export class EmailModule {}
