import * as aws from '@pulumi/aws';
import * as command from '@pulumi/command';
import * as pulumi from '@pulumi/pulumi';
import * as path from 'path';

import { Env } from './src/env';
import { alb } from './src/compute/ecs';
import './src/compute/services/api.service';

import { db } from './src/data/database';
import { frontendBucket, sdkBucket } from './src/storage/buckets';
import { distribution } from './src/storage/cdn';
import { sdkDistribution } from './src/storage/sdk-cdn';

// DNS records (wires ALB + CloudFront to Route53)
const zone = aws.route53.getZone({ name: Env.domain });

// api.grabdy.com -> ALB
new aws.route53.Record('grabdy-api-dns', {
  zoneId: zone.then((z) => z.zoneId),
  name: Env.apiDomain,
  type: 'A',
  aliases: [
    {
      name: alb.dnsName,
      zoneId: alb.zoneId,
      evaluateTargetHealth: true,
    },
  ],
});

// grabdy.com -> CloudFront
new aws.route53.Record('grabdy-frontend-dns', {
  zoneId: zone.then((z) => z.zoneId),
  name: Env.domain,
  type: 'A',
  aliases: [
    {
      name: distribution.domainName,
      zoneId: distribution.hostedZoneId,
      evaluateTargetHealth: false,
    },
  ],
});

// www.grabdy.com -> CloudFront
new aws.route53.Record('grabdy-www-dns', {
  zoneId: zone.then((z) => z.zoneId),
  name: `www.${Env.domain}`,
  type: 'A',
  aliases: [
    {
      name: distribution.domainName,
      zoneId: distribution.hostedZoneId,
      evaluateTargetHealth: false,
    },
  ],
});

// sdk.grabdy.com -> CloudFront
new aws.route53.Record('grabdy-sdk-dns', {
  zoneId: zone.then((z) => z.zoneId),
  name: Env.sdkDomain,
  type: 'A',
  aliases: [
    {
      name: sdkDistribution.domainName,
      zoneId: sdkDistribution.hostedZoneId,
      evaluateTargetHealth: false,
    },
  ],
});

// Frontend build & deploy
const monorepoRoot = path.resolve(__dirname, '..');
const awsRegion = new pulumi.Config('aws').require('region');

const buildFrontend = new command.local.Command('build-frontend', {
  create: pulumi.interpolate`
    cd ${monorepoRoot}
    export NODE_ENV=production
    export VITE_API_URL="https://${Env.apiDomain}"
    export VITE_GOOGLE_CLIENT_ID="${Env.googleClientId}"
    yarn workspace @grabdy/web build
  `,
  triggers: [Date.now().toString()],
});

new command.local.Command(
  'deploy-frontend',
  {
    create: pulumi.interpolate`
      cd ${monorepoRoot}
      aws s3 sync apps/web/dist/ s3://${frontendBucket.bucket}/ --delete --region ${awsRegion}
      aws cloudfront create-invalidation --distribution-id ${distribution.id} --paths "/*"
    `,
    triggers: [Date.now().toString()],
  },
  { dependsOn: [buildFrontend] }
);

// SDK build & deploy
const buildSdk = new command.local.Command('build-sdk', {
  create: pulumi.interpolate`
    cd ${monorepoRoot}
    export NODE_ENV=production
    yarn workspace @grabdy/sdk build
  `,
  triggers: [Date.now().toString()],
});

new command.local.Command(
  'deploy-sdk',
  {
    create: pulumi.interpolate`
      cd ${monorepoRoot}
      aws s3 sync apps/sdk/dist/ s3://${sdkBucket.bucket}/ --delete --region ${awsRegion}
      aws cloudfront create-invalidation --distribution-id ${sdkDistribution.id} --paths "/*"
    `,
    triggers: [Date.now().toString()],
  },
  { dependsOn: [buildSdk] }
);

// Stack outputs
export const appUrl = `https://${Env.domain}`;
export const apiUrl = `https://${Env.apiDomain}`;
export const sdkUrl = `https://${Env.sdkDomain}`;
export const dbEndpoint = db.endpoint;
