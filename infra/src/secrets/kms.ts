import * as aws from '@pulumi/aws';

// KMS key for encrypting SSM SecureString parameters,
// RDS master password (Secrets Manager), and application DEKs.
export const kmsKey = new aws.kms.Key('grabdy-secrets-key', {
  description: 'Encrypts SSM SecureString parameters and integration tokens',
  enableKeyRotation: true,
});

new aws.kms.Alias('grabdy-secrets-key-alias', {
  name: 'alias/grabdy-secrets',
  targetKeyId: kmsKey.keyId,
});
