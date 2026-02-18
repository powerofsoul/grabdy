import { Global, Module } from '@nestjs/common';

import { env } from '../../config/env.config';

import { EncryptionService } from './encryption.service';
import { KmsEncryptionService } from './kms-encryption.service';
import { LocalEncryptionService } from './local-encryption.service';

@Global()
@Module({
  providers: [
    {
      provide: EncryptionService,
      useClass: env.nodeEnv === 'production' ? KmsEncryptionService : LocalEncryptionService,
    },
  ],
  exports: [EncryptionService],
})
export class EncryptionModule {}
