import { Global, Module } from '@nestjs/common';

import { SdkJwtGuard } from './sdk-jwt.guard';

@Global()
@Module({
  providers: [SdkJwtGuard],
  exports: [SdkJwtGuard],
})
export class SdkJwtModule {}
