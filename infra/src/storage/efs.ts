import * as aws from '@pulumi/aws';

import { kmsKey } from '../secrets/kms';
import { apiSg, vpc } from '../network/vpc';

// EFS security group, NFS port 2049, ingress from API tasks
export const efsSg = new aws.ec2.SecurityGroup('grabdy-efs-sg', {
  vpcId: vpc.vpcId,
  description: 'EFS security group for code repo storage',
  ingress: [{ protocol: 'tcp', fromPort: 2049, toPort: 2049, securityGroups: [apiSg.id] }],
  egress: [{ protocol: 'tcp', fromPort: 2049, toPort: 2049, securityGroups: [apiSg.id] }],
});

// EFS filesystem, encrypted, elastic throughput, transition to IA after 30 days
export const efs = new aws.efs.FileSystem('grabdy-repos-efs', {
  encrypted: true,
  kmsKeyId: kmsKey.arn,
  throughputMode: 'elastic',
  lifecyclePolicies: [{ transitionToIa: 'AFTER_30_DAYS' }],
  tags: { Name: 'grabdy-repos' },
});

// Mount targets in each public subnet (2 AZs)
const mountTarget0 = new aws.efs.MountTarget('grabdy-efs-mt-0', {
  fileSystemId: efs.id,
  subnetId: vpc.publicSubnetIds.apply((ids) => ids[0]),
  securityGroups: [efsSg.id],
});

const mountTarget1 = new aws.efs.MountTarget('grabdy-efs-mt-1', {
  fileSystemId: efs.id,
  subnetId: vpc.publicSubnetIds.apply((ids) => ids[1]),
  securityGroups: [efsSg.id],
});

// Access point at /repos with posix user 1000:1000
export const efsAccessPoint = new aws.efs.AccessPoint('grabdy-repos-ap', {
  fileSystemId: efs.id,
  posixUser: { uid: 1000, gid: 1000 },
  rootDirectory: {
    path: '/repos',
    creationInfo: { ownerUid: 1000, ownerGid: 1000, permissions: '755' },
  },
  tags: { Name: 'grabdy-repos-ap' },
});
