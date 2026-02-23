import * as awsx from '@pulumi/awsx';
import * as command from '@pulumi/command';
import * as pulumi from '@pulumi/pulumi';

import { Env } from '../../env';
import { cacheHost, cachePort } from '../../data/cache';
import { db, dbSecretArn } from '../../data/database';
import { vpc } from '../../network/vpc';
import { apiSg } from './api.sg';
import { apiInternalUrl, apiServiceDiscovery, apiTargetGroup, cluster, inngestInternalUrl } from '../ecs';
import { imageUri } from '../ecr';
import { executionRole, kmsKey, taskRole } from '../iam';

const baseEnvironment = [
  { name: 'NODE_ENV', value: 'production' },
  { name: 'API_PORT', value: '4000' },
  { name: 'API_URL', value: pulumi.interpolate`https://${Env.apiDomain}` },
  { name: 'FRONTEND_URL', value: `https://${Env.domain}` },
  { name: 'AWS_REGION', value: Env.region.name },
  { name: 'REDIS_HOST', value: cacheHost },
  { name: 'REDIS_PORT', value: cachePort },
  { name: 'SMTP_HOST', value: Env.smtpHost },
  { name: 'SMTP_PORT', value: Env.smtpPort },
  { name: 'EMAIL_FROM', value: Env.emailFrom },
  { name: 'SSM_PREFIX', value: '/grabdy/prod' },
  { name: 'KMS_KEY_ARN', value: kmsKey.arn },
  { name: 'DB_SECRET_ARN', value: dbSecretArn },
  { name: 'DB_ENDPOINT', value: db.endpoint },
] satisfies { name: string; value: pulumi.Input<string> }[];

const apiService = new awsx.ecs.FargateService('grabdy-api', {
  cluster: cluster.arn,
  desiredCount: 1,
  networkConfiguration: {
    subnets: vpc.publicSubnetIds,
    securityGroups: [apiSg.id],
    assignPublicIp: true,
  },
  loadBalancers: [
    { targetGroupArn: apiTargetGroup.arn, containerName: 'api', containerPort: 4000 },
  ],
  serviceRegistries: { registryArn: apiServiceDiscovery.arn },
  forceNewDeployment: true,
  taskDefinitionArgs: {
    family: 'grabdy-api',
    cpu: '1024',
    memory: '4096',
    runtimePlatform: { cpuArchitecture: 'ARM64', operatingSystemFamily: 'LINUX' },
    executionRole: { roleArn: executionRole.arn },
    taskRole: { roleArn: taskRole.arn },
    logGroup: { args: { retentionInDays: 14 } },
    container: {
      name: 'api',
      image: imageUri,
      portMappings: [{ containerPort: 4000 }],
      environment: [
        ...baseEnvironment,
        { name: 'INNGEST_BASE_URL', value: inngestInternalUrl },
        { name: 'INNGEST_SERVE_HOST', value: apiInternalUrl },
        { name: 'INNGEST_DEV', value: '0' },
      ],
    },
  },
});

// Run migrations before deploying the API service
new command.local.Command(
  'run-migration',
  {
    create: pulumi.interpolate`
    TASK_ARN=$(aws ecs run-task \
      --cluster ${cluster.arn} \
      --task-definition ${apiService.taskDefinition.apply((td) => td?.arn ?? '')} \
      --launch-type FARGATE \
      --network-configuration "awsvpcConfiguration={subnets=[${vpc.publicSubnetIds.apply((ids) => ids.join(','))}],securityGroups=[${apiSg.id}],assignPublicIp=ENABLED}" \
      --overrides '{"containerOverrides":[{"name":"api","command":["node","apps/api/dist/db/migrate.js"]}]}' \
      --region ${Env.region.name} \
      --query 'tasks[0].taskArn' --output text)

    echo "Migration task: $TASK_ARN"
    aws ecs wait tasks-stopped --cluster ${cluster.arn} --tasks "$TASK_ARN" --region ${Env.region.name}

    EXIT_CODE=$(aws ecs describe-tasks --cluster ${cluster.arn} --tasks "$TASK_ARN" --region ${Env.region.name} \
      --query 'tasks[0].containers[0].exitCode' --output text)

    if [ "$EXIT_CODE" != "0" ]; then
      echo "Migration failed with exit code $EXIT_CODE"
      exit 1
    fi
    echo "Migration completed successfully"
  `,
    triggers: [Date.now().toString()],
  },
  { dependsOn: [apiService] }
);
