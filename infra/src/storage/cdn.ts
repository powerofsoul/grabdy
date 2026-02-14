import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

import { Env } from '../env';
import { frontendCertArn } from '../network/certificates';
import { frontendBucket } from './buckets';

const oac = new aws.cloudfront.OriginAccessControl('grabdy-oac', {
  originAccessControlOriginType: 's3',
  signingBehavior: 'always',
  signingProtocol: 'sigv4',
});

export const distribution = new aws.cloudfront.Distribution('grabdy-cdn', {
  enabled: true,
  defaultRootObject: 'index.html',
  httpVersion: 'http2and3',
  priceClass: 'PriceClass_100',
  aliases: [Env.domain, `www.${Env.domain}`],

  origins: [
    {
      originId: 'frontend-s3',
      domainName: frontendBucket.bucketRegionalDomainName,
      originAccessControlId: oac.id,
    },
  ],

  defaultCacheBehavior: {
    targetOriginId: 'frontend-s3',
    viewerProtocolPolicy: 'redirect-to-https',
    allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
    cachedMethods: ['GET', 'HEAD'],
    compress: true,
    cachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6', // CachingOptimized
  },

  // SPA: return index.html for 403/404
  customErrorResponses: [
    { errorCode: 403, responseCode: 200, responsePagePath: '/index.html', errorCachingMinTtl: 10 },
    { errorCode: 404, responseCode: 200, responsePagePath: '/index.html', errorCachingMinTtl: 10 },
  ],

  restrictions: {
    geoRestriction: { restrictionType: 'none' },
  },

  viewerCertificate: {
    acmCertificateArn: frontendCertArn,
    sslSupportMethod: 'sni-only',
    minimumProtocolVersion: 'TLSv1.2_2021',
  },
});

// Allow CloudFront to read from the frontend bucket
new aws.s3.BucketPolicy('grabdy-frontend-policy', {
  bucket: frontendBucket.id,
  policy: pulumi.jsonStringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { Service: 'cloudfront.amazonaws.com' },
        Action: 's3:GetObject',
        Resource: pulumi.interpolate`${frontendBucket.arn}/*`,
        Condition: {
          StringEquals: {
            'AWS:SourceArn': distribution.arn,
          },
        },
      },
    ],
  }),
});
