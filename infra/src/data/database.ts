import * as aws from '@pulumi/aws';

import { kmsKey } from '../secrets/kms';
import { dbSg, vpc } from '../network/vpc';

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
  // During preview or before RDS update completes, secrets may be empty
  if (!secrets || secrets.length === 0) return '';
  return secrets[0].secretArn;
});
