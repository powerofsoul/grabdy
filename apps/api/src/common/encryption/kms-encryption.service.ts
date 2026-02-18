import { Injectable, Logger } from '@nestjs/common';

import { DecryptCommand, EncryptCommand, KMSClient } from '@aws-sdk/client-kms';

import { InjectEnv } from '../../config/env.config';

import { EncryptionService } from './encryption.service';

@Injectable()
export class KmsEncryptionService extends EncryptionService {
  private readonly logger = new Logger(KmsEncryptionService.name);
  private readonly kms: KMSClient;

  constructor(@InjectEnv('kmsKeyArn') private kmsKeyArn: string) {
    super();
    this.kms = new KMSClient({ region: process.env.AWS_REGION || 'eu-central-1' });
    this.logger.log('Using KMS encryption');
  }

  async encrypt(plaintext: string): Promise<string> {
    const response = await this.kms.send(
      new EncryptCommand({
        KeyId: this.kmsKeyArn,
        Plaintext: Buffer.from(plaintext, 'utf8'),
      })
    );

    if (!response.CiphertextBlob) {
      throw new Error('KMS Encrypt returned empty ciphertext');
    }

    return Buffer.from(response.CiphertextBlob).toString('base64');
  }

  async decrypt(encrypted: string): Promise<string> {
    const response = await this.kms.send(
      new DecryptCommand({
        KeyId: this.kmsKeyArn,
        CiphertextBlob: Buffer.from(encrypted, 'base64'),
      })
    );

    if (!response.Plaintext) {
      throw new Error('KMS Decrypt returned empty plaintext');
    }

    return Buffer.from(response.Plaintext).toString('utf8');
  }
}
