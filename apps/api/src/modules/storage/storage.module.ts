import { Module } from '@nestjs/common';

import { S3FileStorage } from './s3-file-storage';

@Module({
  providers: [S3FileStorage],
  exports: [S3FileStorage],
})
export class StorageModule {}
