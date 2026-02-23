import { Global, Module } from '@nestjs/common';

import { NotificationFunctions } from './notification.functions';
import { NotificationService } from './notification.service';

@Global()
@Module({
  providers: [NotificationService, NotificationFunctions],
  exports: [NotificationService],
})
export class NotificationModule {}
