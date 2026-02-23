import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

import { Env } from '../env';
import { apiCertArn, inngestCertArn } from '../network/certificates';
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

// ─── Inngest ALB routing ───

const inngestSdNamespace = new aws.servicediscovery.PrivateDnsNamespace('grabdy-local-ns', {
  name: 'grabdy.local',
  vpc: vpc.vpcId,
});

const inngestSdServiceName = 'inngest';

export const inngestServiceDiscovery = new aws.servicediscovery.Service('grabdy-inngest-sd', {
  name: inngestSdServiceName,
  dnsConfig: {
    namespaceId: inngestSdNamespace.id,
    dnsRecords: [{ ttl: 10, type: 'A' }],
    routingPolicy: 'MULTIVALUE',
  },
  healthCheckCustomConfig: { failureThreshold: 1 },
});

// ─── API Cloud Map service discovery ───

const apiSdServiceName = 'api';

export const apiServiceDiscovery = new aws.servicediscovery.Service('grabdy-api-sd', {
  name: apiSdServiceName,
  dnsConfig: {
    namespaceId: inngestSdNamespace.id,
    dnsRecords: [{ ttl: 10, type: 'A' }],
    routingPolicy: 'MULTIVALUE',
  },
  healthCheckCustomConfig: { failureThreshold: 1 },
});

/** Internal URL for Inngest to reach the API via Cloud Map DNS (bypasses ALB). */
export const apiInternalUrl = pulumi.interpolate`http://${apiSdServiceName}.${inngestSdNamespace.name}:4000`;

/** Internal URL for the API to reach Inngest via Cloud Map DNS. */
export const inngestInternalUrl = pulumi.interpolate`http://${inngestSdServiceName}.${inngestSdNamespace.name}:8288`;

export const inngestTargetGroup = new aws.lb.TargetGroup('grabdy-inngest-tg', {
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

// ─── Shared SSM secret ARNs ───

export const inngestSigningKeyArn = pulumi.interpolate`arn:aws:ssm:${Env.region.name}:${aws.getCallerIdentity().then((id) => id.accountId)}:parameter/grabdy/prod/INNGEST_SIGNING_KEY`;
export const inngestEventKeyArn = pulumi.interpolate`arn:aws:ssm:${Env.region.name}:${aws.getCallerIdentity().then((id) => id.accountId)}:parameter/grabdy/prod/INNGEST_EVENT_KEY`;
