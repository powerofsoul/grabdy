import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

import { Env } from '../env';
import { sdkCertArn } from '../network/certificates';
import { sdkBucket } from './buckets';

const sdkOac = new aws.cloudfront.OriginAccessControl('grabdy-sdk-oac', {
  originAccessControlOriginType: 's3',
  signingBehavior: 'always',
  signingProtocol: 'sigv4',
});

export const sdkDistribution = new aws.cloudfront.Distribution('grabdy-sdk-cdn', {
  enabled: true,
  httpVersion: 'http2and3',
  priceClass: 'PriceClass_100',
  aliases: [Env.sdkDomain],

  origins: [
    {
      originId: 'sdk-s3',
      domainName: sdkBucket.bucketRegionalDomainName,
      originAccessControlId: sdkOac.id,
    },
  ],

  defaultCacheBehavior: {
    targetOriginId: 'sdk-s3',
    viewerProtocolPolicy: 'redirect-to-https',
    allowedMethods: ['GET', 'HEAD', 'OPTIONS'],
    cachedMethods: ['GET', 'HEAD'],
    compress: true,
    cachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6', // CachingOptimized
  },

  customErrorResponses: [
    { errorCode: 403, responseCode: 200, responsePagePath: '/sdk.min.js', errorCachingMinTtl: 60 },
    { errorCode: 404, responseCode: 200, responsePagePath: '/sdk.min.js', errorCachingMinTtl: 60 },
  ],

  restrictions: {
    geoRestriction: { restrictionType: 'none' },
  },

  viewerCertificate: {
    acmCertificateArn: sdkCertArn,
    sslSupportMethod: 'sni-only',
    minimumProtocolVersion: 'TLSv1.2_2021',
  },
});

// Allow CloudFront to read from the SDK bucket
new aws.s3.BucketPolicy('grabdy-sdk-policy', {
  bucket: sdkBucket.id,
  policy: pulumi.jsonStringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: { Service: 'cloudfront.amazonaws.com' },
        Action: 's3:GetObject',
        Resource: pulumi.interpolate`${sdkBucket.arn}/*`,
        Condition: {
          StringEquals: {
            'AWS:SourceArn': sdkDistribution.arn,
          },
        },
      },
    ],
  }),
});
