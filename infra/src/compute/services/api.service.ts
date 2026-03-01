import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';
import * as command from '@pulumi/command';
import * as pulumi from '@pulumi/pulumi';

import { Env } from '../../env';
import { cacheHost, cachePort } from '../../data/cache';
import { db } from '../../data/database';
import { vpc } from '../../network/vpc';
import { apiSg } from './api.sg';
import { apiServiceDiscovery, apiTargetGroup, cluster } from '../ecs';
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
  { name: 'DB_ENDPOINT', value: db.endpoint },
] satisfies { name: string; value: pulumi.Input<string> }[];

// Separate task definition so migrations can run before the service updates
const apiLogGroup = new aws.cloudwatch.LogGroup('grabdy-api-logs', {
  retentionInDays: 14,
});

const apiTaskDefinition = new aws.ecs.TaskDefinition('grabdy-api-task', {
  family: 'grabdy-api',
  cpu: '1024',
  memory: '4096',
  networkMode: 'awsvpc',
  requiresCompatibilities: ['FARGATE'],
  runtimePlatform: { cpuArchitecture: 'ARM64', operatingSystemFamily: 'LINUX' },
  executionRoleArn: executionRole.arn,
  taskRoleArn: taskRole.arn,
  containerDefinitions: pulumi.jsonStringify([
    {
      name: 'api',
      image: imageUri,
      portMappings: [{ containerPort: 4000, protocol: 'tcp' }],
      environment: baseEnvironment,
      stopTimeout: 120,
      logConfiguration: {
        logDriver: 'awslogs',
        options: {
          'awslogs-group': apiLogGroup.name,
          'awslogs-region': Env.region.name,
          'awslogs-stream-prefix': 'api',
        },
      },
    },
  ]),
});

// Run migrations using the new image before updating the service
const runMigration = new command.local.Command(
  'run-migration',
  {
    create: pulumi.interpolate`
    TASK_ARN=$(aws ecs run-task \
      --cluster ${cluster.arn} \
      --task-definition ${apiTaskDefinition.arn} \
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
  { dependsOn: [apiTaskDefinition] }
);

// Deploy the service only after migrations succeed
const apiService = new aws.ecs.Service('grabdy-api', {
  cluster: cluster.arn,
  desiredCount: 1,
  taskDefinition: apiTaskDefinition.arn,
  launchType: 'FARGATE',
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
}, { dependsOn: [runMigration] });

// Worker process: runs BullMQ processors, no HTTP server
const workerLogGroup = new aws.cloudwatch.LogGroup('grabdy-worker-logs', {
  retentionInDays: 14,
});

const workerTaskDefinition = new aws.ecs.TaskDefinition('grabdy-worker-task', {
  family: 'grabdy-worker',
  cpu: '1024',
  memory: '4096',
  networkMode: 'awsvpc',
  requiresCompatibilities: ['FARGATE'],
  runtimePlatform: { cpuArchitecture: 'ARM64', operatingSystemFamily: 'LINUX' },
  executionRoleArn: executionRole.arn,
  taskRoleArn: taskRole.arn,
  containerDefinitions: pulumi.jsonStringify([
    {
      name: 'worker',
      image: imageUri,
      command: ['node', '--max-old-space-size=3584', 'apps/api/dist/worker.js'],
      environment: baseEnvironment,
      stopTimeout: 120,
      logConfiguration: {
        logDriver: 'awslogs',
        options: {
          'awslogs-group': workerLogGroup.name,
          'awslogs-region': Env.region.name,
          'awslogs-stream-prefix': 'worker',
        },
      },
    },
  ]),
});

const workerService = new aws.ecs.Service('grabdy-worker', {
  cluster: cluster.arn,
  desiredCount: 1,
  taskDefinition: workerTaskDefinition.arn,
  launchType: 'FARGATE',
  networkConfiguration: {
    subnets: vpc.publicSubnetIds,
    securityGroups: [apiSg.id],
    assignPublicIp: true,
  },
  forceNewDeployment: true,
}, { dependsOn: [runMigration] });
