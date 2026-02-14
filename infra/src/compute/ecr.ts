import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';
import * as path from 'path';

const monorepoRoot = path.resolve(__dirname, '..', '..', '..');

export const repo = new aws.ecr.Repository('grabdy-api', {
  forceDelete: false,
  imageTagMutability: 'MUTABLE',
  imageScanningConfiguration: {
    scanOnPush: true,
  },
});

new aws.ecr.LifecyclePolicy('grabdy-api-lifecycle', {
  repository: repo.name,
  policy: JSON.stringify({
    rules: [
      {
        rulePriority: 1,
        description: 'Keep last 10 images',
        selection: {
          tagStatus: 'any',
          countType: 'imageCountMoreThan',
          countNumber: 10,
        },
        action: { type: 'expire' },
      },
    ],
  }),
});

const image = new awsx.ecr.Image('grabdy-api-image', {
  repositoryUrl: repo.repositoryUrl,
  context: monorepoRoot,
  dockerfile: path.join(monorepoRoot, 'apps/api/Dockerfile'),
  platform: 'linux/arm64',
  imageTag: `deploy-${Date.now()}`,
});

export const imageUri = image.imageUri;
