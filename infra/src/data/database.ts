import * as aws from '@pulumi/aws';

import { kmsKey } from '../secrets/kms';
import { apiSg } from '../compute/services/api.sg';
import { inngestSg } from '../compute/services/inngest.sg';
import { vpc } from '../network/vpc';

// Database security group — Fargate API -> RDS on 5432
const dbSg = new aws.ec2.SecurityGroup('grabdy-db-sg', {
  vpcId: vpc.vpcId,
  description: 'RDS security group',
  ingress: [
    { protocol: 'tcp', fromPort: 5432, toPort: 5432, securityGroups: [apiSg.id] },
  ],
  egress: [{ protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] }],
});

// Inngest database security group — Inngest Fargate -> Inngest RDS on 5432
const inngestDbSg = new aws.ec2.SecurityGroup('inngest-db-sg', {
  vpcId: vpc.vpcId,
  description: 'Inngest RDS security group',
  ingress: [
    { protocol: 'tcp', fromPort: 5432, toPort: 5432, securityGroups: [inngestSg.id] },
  ],
  egress: [{ protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] }],
});

const subnetGroup = new aws.rds.SubnetGroup('grabdy-db-subnet', {
  subnetIds: vpc.isolatedSubnetIds,
  description: 'Grabdy RDS subnet group',
});

export const db = new aws.rds.Instance('grabdy-db', {
  engine: 'postgres',
  engineVersion: '16.6',
  instanceClass: 'db.t4g.micro',
  allocatedStorage: 20,
  maxAllocatedStorage: 50,
  storageType: 'gp3',

  dbName: 'grabdy',
  username: 'grabdy',
  manageMasterUserPassword: true,
  masterUserSecretKmsKeyId: kmsKey.keyId,

  dbSubnetGroupName: subnetGroup.name,
  vpcSecurityGroupIds: [dbSg.id],

  publiclyAccessible: false,
  skipFinalSnapshot: false,
  finalSnapshotIdentifier: 'grabdy-db-final',
  backupRetentionPeriod: 7,
  deletionProtection: true,

  performanceInsightsEnabled: true,
  performanceInsightsRetentionPeriod: 7,
});

/** ARN of the Secrets Manager secret containing the RDS master password. */
export const dbSecretArn = db.masterUserSecrets.apply((secrets) => {
  if (!secrets || secrets.length === 0) {
    throw new Error('Main RDS master user secret not available. Has the RDS instance been created?');
  }
  return secrets[0].secretArn;
});

// ─── Inngest RDS ───

const inngestSubnetGroup = new aws.rds.SubnetGroup('inngest-db-subnet', {
  subnetIds: vpc.isolatedSubnetIds,
  description: 'Inngest RDS subnet group',
});

export const inngestDb = new aws.rds.Instance('inngest-db', {
  engine: 'postgres',
  engineVersion: '16.6',
  instanceClass: 'db.t4g.micro',
  allocatedStorage: 20,
  maxAllocatedStorage: 50,
  storageType: 'gp3',

  dbName: 'inngest',
  username: 'inngest',
  manageMasterUserPassword: true,
  masterUserSecretKmsKeyId: kmsKey.keyId,

  dbSubnetGroupName: inngestSubnetGroup.name,
  vpcSecurityGroupIds: [inngestDbSg.id],

  publiclyAccessible: false,
  skipFinalSnapshot: false,
  finalSnapshotIdentifier: 'inngest-db-final',
  backupRetentionPeriod: 1,
  deletionProtection: true,

  performanceInsightsEnabled: false,
});

export const inngestDbSecretArn = inngestDb.masterUserSecrets.apply((secrets) => {
  if (!secrets || secrets.length === 0) {
    throw new Error('Inngest RDS master user secret not available. Has the RDS instance been created?');
  }
  return secrets[0].secretArn;
});
