import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

import { dbSecretArn } from '../data/database';
import { kmsKey } from '../secrets/kms';
import { uploadsBucket } from '../storage/buckets';

// Re-export so ecs.ts can import from here as before
export { kmsKey };

// ECS task execution role — pulls images from ECR, writes logs
export const executionRole = new aws.iam.Role('grabdy-exec-role', {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: 'ecs-tasks.amazonaws.com',
  }),
});

new aws.iam.RolePolicyAttachment('grabdy-exec-policy', {
  role: executionRole.name,
  policyArn: 'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy',
});

// ECS task role — what the running container can do
export const taskRole = new aws.iam.Role('grabdy-task-role', {
  assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
    Service: 'ecs-tasks.amazonaws.com',
  }),
});

new aws.iam.RolePolicy('grabdy-task-policy', {
  role: taskRole.name,
  policy: pulumi.jsonStringify({
    Version: '2012-10-17',
    Statement: [
      // S3 uploads access
      {
        Effect: 'Allow',
        Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
        Resource: [uploadsBucket.arn, pulumi.interpolate`${uploadsBucket.arn}/*`],
      },
      // SSM Parameter Store — fetch all secrets under /grabdy/prod/
      {
        Effect: 'Allow',
        Action: ['ssm:GetParametersByPath'],
        Resource: [
          pulumi.interpolate`arn:aws:ssm:${aws.getRegionOutput().name}:${aws.getCallerIdentity().then((id) => id.accountId)}:parameter/grabdy/prod`,
          pulumi.interpolate`arn:aws:ssm:${aws.getRegionOutput().name}:${aws.getCallerIdentity().then((id) => id.accountId)}:parameter/grabdy/prod/*`,
        ],
      },
      // Secrets Manager — read RDS-managed master password
      {
        Effect: 'Allow',
        Action: ['secretsmanager:GetSecretValue'],
        Resource: [dbSecretArn],
      },
      // KMS — decrypt SSM SecureString parameters, RDS secret, and manage data encryption keys
      {
        Effect: 'Allow',
        Action: ['kms:Encrypt', 'kms:Decrypt', 'kms:GenerateDataKey'],
        Resource: [kmsKey.arn],
      },
      // Bedrock — invoke Cohere Rerank model for search reranking
      {
        Effect: 'Allow',
        Action: ['bedrock:InvokeModel'],
        Resource: [
          pulumi.interpolate`arn:aws:bedrock:${aws.getRegionOutput().name}::foundation-model/cohere.rerank-v3-5:0`,
        ],
      },
      // Bedrock — invoke Claude Haiku for chat (cross-region inference profile + underlying foundation models)
      {
        Effect: 'Allow',
        Action: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        Resource: [
          pulumi.interpolate`arn:aws:bedrock:${aws.getRegionOutput().name}:${aws.getCallerIdentity().then((id) => id.accountId)}:inference-profile/eu.anthropic.claude-haiku-4-5-20251001-v1:0`,
          'arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0',
        ],
      },
    ],
  }),
});
