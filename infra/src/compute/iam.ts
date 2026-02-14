import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

import { Env } from '../env';
import { uploadsBucket } from '../storage/buckets';

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

const callerIdentity = aws.getCallerIdentity();

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
      // SES send email
      {
        Effect: 'Allow',
        Action: ['ses:SendEmail', 'ses:SendRawEmail'],
        Resource: pulumi.interpolate`arn:aws:ses:${Env.region.name}:${callerIdentity.then((id) => id.accountId)}:identity/${Env.domain}`,
      },
    ],
  }),
});
