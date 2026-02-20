import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import type { FileStorage, TempFileHandle } from './file-storage.interface';

export class S3FileStorage implements FileStorage {
  private readonly s3: S3Client;

  constructor(
    private readonly bucket: string,
    region: string
  ) {
    this.s3 = new S3Client({ region });
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
    const nodeStream = stream instanceof Readable ? stream : Readable.fromWeb(stream as never);
    await pipeline(nodeStream, createWriteStream(tempPath));

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
}
