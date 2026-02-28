import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

import { Env } from '../env';
import { apiCertArn } from '../network/certificates';
import { albSg, vpc } from '../network/vpc';

// ─── Cluster ───

export const cluster = new aws.ecs.Cluster('grabdy-cluster', {
  settings: [{ name: 'containerInsights', value: 'disabled' }],
});

// ─── ALB ───

export const alb = new aws.lb.LoadBalancer('grabdy-alb', {
  loadBalancerType: 'application',
  securityGroups: [albSg.id],
  subnets: vpc.publicSubnetIds,
  internal: false,
});

export const apiTargetGroup = new aws.lb.TargetGroup('grabdy-api-tg', {
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
  deregistrationDelay: 300,
});

// HTTP -> redirect to HTTPS
new aws.lb.Listener('grabdy-http-listener', {
  loadBalancerArn: alb.arn,
  port: 80,
  protocol: 'HTTP',
  defaultActions: [
    {
      type: 'redirect',
      redirect: { port: '443', protocol: 'HTTPS', statusCode: 'HTTP_301' },
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
  defaultActions: [{ type: 'forward', targetGroupArn: apiTargetGroup.arn }],
});

// ─── Cloud Map service discovery ───

export const sdNamespace = new aws.servicediscovery.PrivateDnsNamespace('grabdy-local-ns', {
  name: 'grabdy.local',
  vpc: vpc.vpcId,
});

export const apiServiceDiscovery = new aws.servicediscovery.Service('grabdy-api-sd', {
  name: 'api',
  dnsConfig: {
    namespaceId: sdNamespace.id,
    dnsRecords: [{ ttl: 10, type: 'A' }],
    routingPolicy: 'MULTIVALUE',
  },
  healthCheckCustomConfig: { failureThreshold: 1 },
});

// ─── Cognito auth for admin dashboard ───

const adminUserPool = new aws.cognito.UserPool('grabdy-admin-auth-pool', {
  name: 'grabdy-admin-auth',
  adminCreateUserConfig: { allowAdminCreateUserOnly: true },
  passwordPolicy: {
    minimumLength: 12,
    requireLowercase: true,
    requireUppercase: true,
    requireNumbers: true,
    requireSymbols: false,
  },
});

const adminUserPoolDomain = new aws.cognito.UserPoolDomain('grabdy-admin-auth-domain', {
  domain: 'grabdy-admin-auth',
  userPoolId: adminUserPool.id,
});

const adminUserPoolClient = new aws.cognito.UserPoolClient('grabdy-admin-auth-client', {
  userPoolId: adminUserPool.id,
  name: 'admin-dashboard',
  generateSecret: true,
  allowedOauthFlows: ['code'],
  allowedOauthFlowsUserPoolClient: true,
  allowedOauthScopes: ['openid'],
  callbackUrls: [pulumi.interpolate`https://${Env.apiDomain}/oauth2/idpresponse`],
  supportedIdentityProviders: ['COGNITO'],
});

new aws.lb.ListenerRule('grabdy-admin-queues-rule', {
  listenerArn: httpsListener.arn,
  priority: 20,
  actions: [
    {
      type: 'authenticate-cognito',
      authenticateCognito: {
        userPoolArn: adminUserPool.arn,
        userPoolClientId: adminUserPoolClient.id,
        userPoolDomain: adminUserPoolDomain.domain,
      },
      order: 1,
    },
    { type: 'forward', targetGroupArn: apiTargetGroup.arn, order: 2 },
  ],
  conditions: [{ pathPattern: { values: ['/admin/queues*'] } }],
});

