import * as aws from '@pulumi/aws';
import * as command from '@pulumi/command';
import * as pulumi from '@pulumi/pulumi';

import { Env } from '../env';
import { cacheHost, cachePort } from '../data/cache';
import { db, dbSecretArn } from '../data/database';
import { apiCertArn } from '../network/certificates';
import { albSg, apiSg, vpc } from '../network/vpc';
import { efs, efsAccessPoint, efsSg } from '../storage/efs';
import { imageUri } from './ecr';
import { executionRole, kmsKey, taskRole } from './iam';

const cluster = new aws.ecs.Cluster('grabdy-cluster', {
  settings: [{ name: 'containerInsights', value: 'disabled' }],
});

// ALB
export const alb = new aws.lb.LoadBalancer('grabdy-alb', {
  loadBalancerType: 'application',
  securityGroups: [albSg.id],
  subnets: vpc.publicSubnetIds,
  internal: false,
});

const targetGroup = new aws.lb.TargetGroup('grabdy-api-tg', {
  port: 4000,
  protocol: 'HTTP',
  targetType: 'ip',
  vpcId: vpc.vpcId,
  healthCheck: {
    path: '/health',
    port: '4000',
    protocol: 'HTTP',
    healthyThreshold: 2,
    unhealthyThreshold: 3,
    interval: 30,
    timeout: 10,
  },
  deregistrationDelay: 30,
});

// HTTP -> redirect to HTTPS
new aws.lb.Listener('grabdy-http-listener', {
  loadBalancerArn: alb.arn,
  port: 80,
  protocol: 'HTTP',
  defaultActions: [
    {
      type: 'redirect',
      redirect: {
        port: '443',
        protocol: 'HTTPS',
        statusCode: 'HTTP_301',
      },
    },
  ],
});

// HTTPS listener
new aws.lb.Listener('grabdy-https-listener', {
  loadBalancerArn: alb.arn,
  port: 443,
  protocol: 'HTTPS',
  certificateArn: apiCertArn,
  sslPolicy: 'ELBSecurityPolicy-TLS13-1-2-2021-06',
  defaultActions: [
    {
      type: 'forward',
      targetGroupArn: targetGroup.arn,
    },
  ],
});

// CloudWatch log group
const logGroup = new aws.cloudwatch.LogGroup('grabdy-api-logs', {
  retentionInDays: 14,
});

// Environment variables shared by API and indexer containers.
// All secrets are fetched from SSM Parameter Store at app startup.
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

// Indexer CloudWatch log group
const indexerLogGroup = new aws.cloudwatch.LogGroup('grabdy-indexer-logs', {
  retentionInDays: 14,
});

// Indexer task definition, 2 vCPU / 8 GB with EFS volume
const indexerTaskDef = new aws.ecs.TaskDefinition('grabdy-indexer-task', {
  family: 'grabdy-indexer',
  requiresCompatibilities: ['FARGATE'],
  networkMode: 'awsvpc',
  cpu: '2048',
  memory: '8192',
  runtimePlatform: {
    cpuArchitecture: 'ARM64',
    operatingSystemFamily: 'LINUX',
  },
  executionRoleArn: executionRole.arn,
  taskRoleArn: taskRole.arn,
  volumes: [
    {
      name: 'repos',
      efsVolumeConfiguration: {
        fileSystemId: efs.id,
        transitEncryption: 'ENABLED',
        authorizationConfig: {
          accessPointId: efsAccessPoint.id,
          iam: 'ENABLED',
        },
      },
    },
  ],
  containerDefinitions: pulumi.jsonStringify([
    {
      name: 'indexer',
      image: imageUri,
      essential: true,
      command: ['node', 'apps/api/dist/code-indexer/main.js'],
      mountPoints: [
        {
          sourceVolume: 'repos',
          containerPath: '/mnt/repos',
          readOnly: false,
        },
      ],
      environment: [
        ...baseEnvironment,
        { name: 'REPOS_BASE_PATH', value: '/mnt/repos' },
      ],
      logConfiguration: {
        logDriver: 'awslogs',
        options: {
          'awslogs-group': indexerLogGroup.name,
          'awslogs-region': Env.region.name,
          'awslogs-stream-prefix': 'indexer',
        },
      },
    },
  ]),
});

// Doc generation task definition, 1 vCPU / 4 GB, no EFS needed
const docGenTaskDef = new aws.ecs.TaskDefinition('grabdy-doc-gen-task', {
  family: 'grabdy-doc-gen',
  requiresCompatibilities: ['FARGATE'],
  networkMode: 'awsvpc',
  cpu: '1024',
  memory: '4096',
  runtimePlatform: {
    cpuArchitecture: 'ARM64',
    operatingSystemFamily: 'LINUX',
  },
  executionRoleArn: executionRole.arn,
  taskRoleArn: taskRole.arn,
  containerDefinitions: pulumi.jsonStringify([
    {
      name: 'doc-gen',
      image: imageUri,
      essential: true,
      command: ['node', 'apps/api/dist/code-indexer/doc-gen-main.js'],
      environment: baseEnvironment,
      logConfiguration: {
        logDriver: 'awslogs',
        options: {
          'awslogs-group': indexerLogGroup.name,
          'awslogs-region': Env.region.name,
          'awslogs-stream-prefix': 'doc-gen',
        },
      },
    },
  ]),
});

// API environment includes base vars plus indexer task references
const environment = [
  ...baseEnvironment,
  { name: 'INDEXER_CLUSTER_ARN', value: cluster.arn },
  { name: 'INDEXER_TASK_DEF_ARN', value: indexerTaskDef.arn },
  { name: 'INDEXER_SUBNETS', value: vpc.publicSubnetIds.apply((ids) => ids.join(',')) },
  { name: 'INDEXER_SECURITY_GROUP', value: apiSg.id },
  { name: 'DOC_GEN_TASK_DEF_ARN', value: docGenTaskDef.arn },
] satisfies { name: string; value: pulumi.Input<string> }[];

// Task definition
const taskDef = new aws.ecs.TaskDefinition('grabdy-api-task', {
  family: 'grabdy-api',
  requiresCompatibilities: ['FARGATE'],
  networkMode: 'awsvpc',
  cpu: '1024',
  memory: '4096',
  runtimePlatform: {
    cpuArchitecture: 'ARM64',
    operatingSystemFamily: 'LINUX',
  },
  executionRoleArn: executionRole.arn,
  taskRoleArn: taskRole.arn,
  containerDefinitions: pulumi.jsonStringify([
    {
      name: 'api',
      image: imageUri,
      essential: true,
      portMappings: [{ containerPort: 4000, protocol: 'tcp' }],
      environment,
      logConfiguration: {
        logDriver: 'awslogs',
        options: {
          'awslogs-group': logGroup.name,
          'awslogs-region': Env.region.name,
          'awslogs-stream-prefix': 'api',
        },
      },
    },
  ]),
});

// Run migrations before deploying the service
const runMigration = new command.local.Command(
  'run-migration',
  {
    create: pulumi.interpolate`
    TASK_ARN=$(aws ecs run-task \
      --cluster ${cluster.arn} \
      --task-definition ${taskDef.arn} \
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
  { dependsOn: [taskDef] }
);

// Fargate service in public subnet (no NAT gateway)
new aws.ecs.Service(
  'grabdy-api-service',
  {
    cluster: cluster.arn,
    taskDefinition: taskDef.arn,
    desiredCount: 1,
    launchType: 'FARGATE',
    networkConfiguration: {
      subnets: vpc.publicSubnetIds,
      securityGroups: [apiSg.id],
      assignPublicIp: true,
    },
    loadBalancers: [
      {
        targetGroupArn: targetGroup.arn,
        containerName: 'api',
        containerPort: 4000,
      },
    ],
    forceNewDeployment: true,
  },
  { dependsOn: [runMigration] }
);
