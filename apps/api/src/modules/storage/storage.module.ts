import { Module } from '@nestjs/common';

import { resolve } from 'node:path';

import { env } from '../../config/env.config';

import { FILE_STORAGE } from './file-storage.interface';
import { LocalFileStorage } from './local-file-storage';
import { S3FileStorage } from './s3-file-storage';

@Module({
  providers: [
    {
      provide: FILE_STORAGE,
      useFactory: () => {
        if (env.nodeEnv === 'production') {
          return new S3FileStorage(env.s3UploadsBucket, env.awsRegion);
        }
        const baseUrl = `http://localhost:${env.port}`;
        return new LocalFileStorage(resolve(process.cwd(), '.uploads'), baseUrl);
      },
    },
  ],
  exports: [FILE_STORAGE],
})
export class StorageModule {}
