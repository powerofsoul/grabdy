import { Injectable } from '@nestjs/common';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { env } from '../../config/env.config';

import type { FileStorage, TempFileHandle } from './file-storage.interface';

@Injectable()
export class S3FileStorage implements FileStorage {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = env.s3UploadsBucket;
    this.s3 = new S3Client({ region: env.awsRegion });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
      })
    );
  }

  async get(key: string): Promise<Buffer> {
    const response = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );

    const stream = response.Body;
    if (!stream) {
      throw new Error('Empty S3 response body');
    }

    const byteArray = await stream.transformToByteArray();
    return Buffer.from(byteArray);
  }

  async getTempPath(key: string): Promise<TempFileHandle> {
    const response = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );

    const stream = response.Body;
    if (!stream) {
      throw new Error('Empty S3 response body');
    }

    const tempPath = join(tmpdir(), `grabdy-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const byteArray = await stream.transformToByteArray();
    await writeFile(tempPath, Buffer.from(byteArray));

    return {
      path: tempPath,
      cleanup: async () => {
        try {
          await unlink(tempPath);
        } catch {
          // Temp file may already be cleaned up
        }
      },
    };
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }

  async getUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.s3, command, { expiresIn: 900 });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
}
