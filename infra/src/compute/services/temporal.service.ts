import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

import { Env } from '../../env';
import { temporalDb } from '../../data/temporal-database';
import { albSg, vpc } from '../../network/vpc';
import { temporalSg } from './temporal.sg';
import { cluster, sdNamespace, temporalUiTargetGroup } from '../ecs';
import { executionRole } from '../iam';

const temporalDbPasswordParam = aws.ssm.getParameter({
  name: '/grabdy/prod/TEMPORAL_DB_PASSWORD',
});

const temporalLogGroup = new aws.cloudwatch.LogGroup('grabdy-temporal-logs', {
  retentionInDays: 14,
});

const temporalTaskDefinition = new aws.ecs.TaskDefinition('grabdy-temporal-task', {
  family: 'grabdy-temporal',
  cpu: '512',
  memory: '1024',
  networkMode: 'awsvpc',
  requiresCompatibilities: ['FARGATE'],
  runtimePlatform: { cpuArchitecture: 'X86_64', operatingSystemFamily: 'LINUX' },
  executionRoleArn: executionRole.arn,
  containerDefinitions: pulumi.jsonStringify([
    {
      name: 'temporal',
      image: 'temporalio/auto-setup:1.26.2',
      portMappings: [{ containerPort: 7233, protocol: 'tcp' }],
      essential: true,
      environment: [
        { name: 'DB', value: 'postgres12' },
        { name: 'DB_PORT', value: '5432' },
        { name: 'POSTGRES_USER', value: 'temporal' },
        { name: 'POSTGRES_SEEDS', value: temporalDb.address },
        { name: 'DBNAME', value: 'temporal' },
        { name: 'VISIBILITY_DBNAME', value: 'temporal_visibility' },
        { name: 'POSTGRES_TLS_ENABLED', value: 'true' },
        { name: 'POSTGRES_TLS_DISABLE_HOST_VERIFICATION', value: 'true' },
        { name: 'SQL_TLS_ENABLED', value: 'true' },
        { name: 'SQL_TLS_SKIP_HOST_VERIFICATION', value: 'true' },
      ],
      secrets: [
        { name: 'POSTGRES_PWD', valueFrom: temporalDbPasswordParam.then((p) => p.arn) },
      ],
      healthCheck: {
        command: ['CMD-SHELL', 'tctl cluster health || exit 1'],
        interval: 30,
        timeout: 5,
        retries: 3,
        startPeriod: 120,
      },
      logConfiguration: {
        logDriver: 'awslogs',
        options: {
          'awslogs-group': temporalLogGroup.name,
          'awslogs-region': Env.region.name,
          'awslogs-stream-prefix': 'temporal',
        },
      },
    },
    {
      name: 'temporal-ui',
      image: 'temporalio/ui:2.34.0',
      portMappings: [{ containerPort: 8080, protocol: 'tcp' }],
      essential: false,
      environment: [
        { name: 'TEMPORAL_ADDRESS', value: 'localhost:7233' },
        { name: 'TEMPORAL_CORS_ORIGINS', value: 'https://temporal.grabdy.com' },
      ],
      logConfiguration: {
        logDriver: 'awslogs',
        options: {
          'awslogs-group': temporalLogGroup.name,
          'awslogs-region': Env.region.name,
          'awslogs-stream-prefix': 'temporal-ui',
        },
      },
      dependsOn: [{ containerName: 'temporal', condition: 'HEALTHY' }],
    },
  ]),
});

const temporalServiceDiscovery = new aws.servicediscovery.Service('grabdy-temporal-sd', {
  name: 'temporal',
  dnsConfig: {
    namespaceId: sdNamespace.id,
    dnsRecords: [{ ttl: 10, type: 'A' }],
    routingPolicy: 'MULTIVALUE',
  },
  healthCheckCustomConfig: { failureThreshold: 1 },
});

// Allow ALB -> Temporal UI on port 8080
new aws.ec2.SecurityGroupRule('alb-to-temporal-ui', {
  type: 'ingress',
  fromPort: 8080,
  toPort: 8080,
  protocol: 'tcp',
  securityGroupId: temporalSg.id,
  sourceSecurityGroupId: albSg.id,
});

new aws.ecs.Service('grabdy-temporal', {
  cluster: cluster.arn,
  desiredCount: 1,
  taskDefinition: temporalTaskDefinition.arn,
  launchType: 'FARGATE',
  networkConfiguration: {
    subnets: vpc.publicSubnetIds,
    securityGroups: [temporalSg.id],
    assignPublicIp: true,
  },
  loadBalancers: [
    { targetGroupArn: temporalUiTargetGroup.arn, containerName: 'temporal-ui', containerPort: 8080 },
  ],
  serviceRegistries: { registryArn: temporalServiceDiscovery.arn },
  forceNewDeployment: true,
});
