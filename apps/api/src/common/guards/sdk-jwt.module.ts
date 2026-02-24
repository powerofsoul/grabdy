import { Global, Module } from '@nestjs/common';

import { EncryptionModule } from '../encryption/encryption.module';

import { SdkJwtGuard } from './sdk-jwt.guard';

@Global()
@Module({
  imports: [EncryptionModule],
  providers: [SdkJwtGuard],
  exports: [SdkJwtGuard],
})
export class SdkJwtModule {}
