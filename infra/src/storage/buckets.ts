import * as aws from '@pulumi/aws';

// Frontend SPA bucket
export const frontendBucket = new aws.s3.BucketV2('grabdy-frontend', {
  forceDestroy: false,
});

new aws.s3.BucketPublicAccessBlock('grabdy-frontend-pab', {
  bucket: frontendBucket.id,
  blockPublicAcls: true,
  blockPublicPolicy: true,
  ignorePublicAcls: true,
  restrictPublicBuckets: true,
});

// Uploads bucket
export const uploadsBucket = new aws.s3.BucketV2('grabdy-uploads', {
  forceDestroy: false,
});

new aws.s3.BucketPublicAccessBlock('grabdy-uploads-pab', {
  bucket: uploadsBucket.id,
  blockPublicAcls: true,
  blockPublicPolicy: true,
  ignorePublicAcls: true,
  restrictPublicBuckets: true,
});

new aws.s3.BucketCorsConfigurationV2('grabdy-uploads-cors', {
  bucket: uploadsBucket.id,
  corsRules: [
    {
      allowedOrigins: ['*'],
      allowedMethods: ['GET', 'HEAD'],
      allowedHeaders: ['*'],
      exposeHeaders: ['Accept-Ranges', 'Content-Range', 'Content-Length', 'Content-Type'],
      maxAgeSeconds: 3600,
    },
  ],
});

new aws.s3.BucketServerSideEncryptionConfigurationV2('grabdy-uploads-sse', {
  bucket: uploadsBucket.id,
  rules: [
    {
      applyServerSideEncryptionByDefault: {
        sseAlgorithm: 'AES256',
      },
    },
  ],
});
