import * as aws from '@pulumi/aws';
import * as command from '@pulumi/command';
import * as pulumi from '@pulumi/pulumi';

import { Env } from '../env';
import { cacheHost, cachePort } from '../data/cache';
import { db, dbSecretArn, inngestDb, inngestDbSecretArn } from '../data/database';
import { apiCertArn, inngestCertArn } from '../network/certificates';
import { albSg, apiSg, inngestSg, vpc } from '../network/vpc';
import { imageUri } from './ecr';
import { executionRole, inngestTaskRole, kmsKey, taskRole } from './iam';

const cluster = new aws.ecs.Cluster('grabdy-cluster', {
  settings: [{ name: 'containerInsights', value: 'disabled' }],
});

// ─── ALB ───

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
const httpsListener = new aws.lb.Listener('grabdy-https-listener', {
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

// ─── Inngest ALB + service discovery ───

// Cloud Map namespace for internal DNS (inngest.grabdy.local)
const serviceDiscoveryNamespace = new aws.servicediscovery.PrivateDnsNamespace(
  'grabdy-local-ns',
  {
    name: 'grabdy.local',
    vpc: vpc.vpcId,
  }
);

const inngestServiceDiscovery = new aws.servicediscovery.Service('grabdy-inngest-sd', {
  name: 'inngest',
  dnsConfig: {
    namespaceId: serviceDiscoveryNamespace.id,
    dnsRecords: [{ ttl: 10, type: 'A' }],
    routingPolicy: 'MULTIVALUE',
  },
  healthCheckCustomConfig: { failureThreshold: 1 },
});

// Inngest CloudWatch log group
const inngestLogGroup = new aws.cloudwatch.LogGroup('grabdy-inngest-logs', {
  retentionInDays: 14,
});

// Inngest target group on port 8288
const inngestTargetGroup = new aws.lb.TargetGroup('grabdy-inngest-tg', {
  port: 8288,
  protocol: 'HTTP',
  targetType: 'ip',
  vpcId: vpc.vpcId,
  healthCheck: {
    path: '/health',
    port: '8288',
    protocol: 'HTTP',
    healthyThreshold: 2,
    unhealthyThreshold: 3,
    interval: 30,
    timeout: 10,
  },
  deregistrationDelay: 30,
});

// Attach Inngest certificate to the HTTPS listener
new aws.lb.ListenerCertificate('grabdy-inngest-listener-cert', {
  listenerArn: httpsListener.arn,
  certificateArn: inngestCertArn,
});

// Cognito user pool for Inngest dashboard auth
const inngestUserPool = new aws.cognito.UserPool('grabdy-inngest-auth-pool', {
  name: 'grabdy-inngest-auth',
  adminCreateUserConfig: { allowAdminCreateUserOnly: true },
  passwordPolicy: {
    minimumLength: 12,
    requireLowercase: true,
    requireUppercase: true,
    requireNumbers: true,
    requireSymbols: false,
  },
});

const inngestUserPoolDomain = new aws.cognito.UserPoolDomain('grabdy-inngest-auth-domain', {
  domain: 'grabdy-inngest-auth',
  userPoolId: inngestUserPool.id,
});

const inngestUserPoolClient = new aws.cognito.UserPoolClient('grabdy-inngest-auth-client', {
  userPoolId: inngestUserPool.id,
  name: 'inngest-dashboard',
  generateSecret: true,
  allowedOauthFlows: ['code'],
  allowedOauthFlowsUserPoolClient: true,
  allowedOauthScopes: ['openid'],
  callbackUrls: [pulumi.interpolate`https://${Env.inngestDomain}/oauth2/idpresponse`],
  supportedIdentityProviders: ['COGNITO'],
});

// Listener rule: host header inngest.grabdy.com -> Cognito auth -> Inngest target group
new aws.lb.ListenerRule('grabdy-inngest-rule', {
  listenerArn: httpsListener.arn,
  priority: 10,
  actions: [
    {
      type: 'authenticate-cognito',
      authenticateCognito: {
        userPoolArn: inngestUserPool.arn,
        userPoolClientId: inngestUserPoolClient.id,
        userPoolDomain: inngestUserPoolDomain.domain,
      },
      order: 1,
    },
    { type: 'forward', targetGroupArn: inngestTargetGroup.arn, order: 2 },
  ],
  conditions: [{ hostHeader: { values: [Env.inngestDomain] } }],
});

// ─── Log groups ───

const logGroup = new aws.cloudwatch.LogGroup('grabdy-api-logs', {
  retentionInDays: 14,
});

// ─── Environment variables ───

// Environment variables shared across containers.
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

// ─── Inngest task definition ───

const inngestTaskDef = new aws.ecs.TaskDefinition('grabdy-inngest-task', {
  family: 'grabdy-inngest',
  requiresCompatibilities: ['FARGATE'],
  networkMode: 'awsvpc',
  cpu: '512',
  memory: '1024',
  runtimePlatform: {
    cpuArchitecture: 'ARM64',
    operatingSystemFamily: 'LINUX',
  },
  executionRoleArn: executionRole.arn,
  taskRoleArn: inngestTaskRole.arn,
  containerDefinitions: pulumi.jsonStringify([
    {
      name: 'inngest',
      image: 'inngest/inngest:latest',
      essential: true,
      portMappings: [{ containerPort: 8288, protocol: 'tcp' }],
      command: [
        'sh',
        '-c',
        'export INNGEST_PG_URI="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}/inngest?sslmode=require" && inngest serve',
      ],
      environment: [
        { name: 'DB_HOST', value: inngestDb.endpoint },
        {
          name: 'INNGEST_REDIS_URI',
          value: pulumi.interpolate`redis://${cacheHost}:${cachePort}`,
        },
        {
          name: 'INNGEST_BASE_URL',
          value: pulumi.interpolate`https://${Env.inngestDomain}`,
        },
        { name: 'INNGEST_LOG_LEVEL', value: 'info' },
      ],
      secrets: [
        {
          name: 'DB_USER',
          valueFrom: pulumi.interpolate`${inngestDbSecretArn}:username::`,
        },
        {
          name: 'DB_PASS',
          valueFrom: pulumi.interpolate`${inngestDbSecretArn}:password::`,
        },
        {
          name: 'INNGEST_SIGNING_KEY',
          valueFrom: pulumi.interpolate`arn:aws:ssm:${Env.region.name}:${aws.getCallerIdentity().then((id) => id.accountId)}:parameter/grabdy/prod/INNGEST_SIGNING_KEY`,
        },
        {
          name: 'INNGEST_EVENT_KEY',
          valueFrom: pulumi.interpolate`arn:aws:ssm:${Env.region.name}:${aws.getCallerIdentity().then((id) => id.accountId)}:parameter/grabdy/prod/INNGEST_EVENT_KEY`,
        },
      ],
      logConfiguration: {
        logDriver: 'awslogs',
        options: {
          'awslogs-group': inngestLogGroup.name,
          'awslogs-region': Env.region.name,
          'awslogs-stream-prefix': 'inngest',
        },
      },
    },
  ]),
});

// ─── API task definition ───

// API environment includes base vars plus Inngest config
const environment = [
  ...baseEnvironment,
  { name: 'INNGEST_SERVER_URL', value: 'http://inngest.grabdy.local:8288' },
] satisfies { name: string; value: pulumi.Input<string> }[];

const apiSecrets = [
  {
    name: 'INNGEST_SIGNING_KEY',
    valueFrom: pulumi.interpolate`arn:aws:ssm:${Env.region.name}:${aws.getCallerIdentity().then((id) => id.accountId)}:parameter/grabdy/prod/INNGEST_SIGNING_KEY`,
  },
  {
    name: 'INNGEST_EVENT_KEY',
    valueFrom: pulumi.interpolate`arn:aws:ssm:${Env.region.name}:${aws.getCallerIdentity().then((id) => id.accountId)}:parameter/grabdy/prod/INNGEST_EVENT_KEY`,
  },
];

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
      secrets: apiSecrets,
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

// ─── Deployment commands ───

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

// ─── ECS services ───

// Fargate API service in public subnet (no NAT gateway)
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

// Inngest ECS service
new aws.ecs.Service(
  'grabdy-inngest-service',
  {
    cluster: cluster.arn,
    taskDefinition: inngestTaskDef.arn,
    desiredCount: 1,
    launchType: 'FARGATE',
    networkConfiguration: {
      subnets: vpc.publicSubnetIds,
      securityGroups: [inngestSg.id],
      assignPublicIp: true,
    },
    loadBalancers: [
      {
        targetGroupArn: inngestTargetGroup.arn,
        containerName: 'inngest',
        containerPort: 8288,
      },
    ],
    serviceRegistries: {
      registryArn: inngestServiceDiscovery.arn,
    },
    forceNewDeployment: true,
  },
  { dependsOn: [runMigration] }
);
