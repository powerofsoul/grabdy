import * as awsx from '@pulumi/awsx';
import * as pulumi from '@pulumi/pulumi';

import { Env } from '../../env';
import { cacheHost, cachePort } from '../../data/cache';
import { inngestDb, inngestDbSecretArn } from '../../data/database';
import { vpc } from '../../network/vpc';
import { inngestSg } from './inngest.sg';
import {
  cluster,
  inngestEventKeyArn,
  inngestServiceDiscovery,
  inngestSigningKeyArn,
  inngestTargetGroup,
} from '../ecs';
import { executionRole, inngestTaskRole } from '../iam';

new awsx.ecs.FargateService('grabdy-inngest', {
  cluster: cluster.arn,
  desiredCount: 1,
  networkConfiguration: {
    subnets: vpc.publicSubnetIds,
    securityGroups: [inngestSg.id],
    assignPublicIp: true,
  },
  loadBalancers: [
    { targetGroupArn: inngestTargetGroup.arn, containerName: 'inngest', containerPort: 8288 },
  ],
  serviceRegistries: { registryArn: inngestServiceDiscovery.arn },
  forceNewDeployment: true,
  taskDefinitionArgs: {
    family: 'grabdy-inngest',
    cpu: '512',
    memory: '1024',
    runtimePlatform: { cpuArchitecture: 'X86_64', operatingSystemFamily: 'LINUX' },
    executionRole: { roleArn: executionRole.arn },
    taskRole: { roleArn: inngestTaskRole.arn },
    logGroup: { args: { retentionInDays: 14 } },
    container: {
      name: 'inngest',
      image: 'inngest/inngest:latest',
      portMappings: [{ containerPort: 8288 }],
      command: [
        '/bin/sh',
        '-c',
        'export INNGEST_PG_URI="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}/inngest?sslmode=require" && inngest start',
      ],
      environment: [
        { name: 'DB_HOST', value: inngestDb.endpoint },
        { name: 'INNGEST_REDIS_URI', value: pulumi.interpolate`redis://${cacheHost}:${cachePort}` },
        { name: 'INNGEST_BASE_URL', value: pulumi.interpolate`https://${Env.inngestDomain}` },
        { name: 'INNGEST_LOG_LEVEL', value: 'info' },
      ],
      secrets: [
        { name: 'DB_USER', valueFrom: pulumi.interpolate`${inngestDbSecretArn}:username::` },
        { name: 'DB_PASS', valueFrom: pulumi.interpolate`${inngestDbSecretArn}:password::` },
        { name: 'INNGEST_SIGNING_KEY', valueFrom: inngestSigningKeyArn },
        { name: 'INNGEST_EVENT_KEY', valueFrom: inngestEventKeyArn },
      ],
    },
  },
});
