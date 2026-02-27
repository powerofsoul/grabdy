import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

import { temporalSg } from '../compute/services/temporal.sg';
import { vpc } from '../network/vpc';

const dbPasswordParam = aws.ssm.getParameterOutput({
  name: '/grabdy/prod/TEMPORAL_DB_PASSWORD',
  withDecryption: true,
});
const dbPassword = pulumi.secret(dbPasswordParam.value);

// Database security group — Temporal Fargate -> RDS on 5432
const temporalDbSg = new aws.ec2.SecurityGroup('grabdy-temporal-db-sg', {
  vpcId: vpc.vpcId,
  description: 'Temporal RDS security group',
  ingress: [
    { protocol: 'tcp', fromPort: 5432, toPort: 5432, securityGroups: [temporalSg.id] },
  ],
  egress: [{ protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] }],
});

const subnetGroup = new aws.rds.SubnetGroup('grabdy-temporal-db-subnet', {
  subnetIds: vpc.isolatedSubnetIds,
  description: 'Temporal RDS subnet group',
});

export const temporalDb = new aws.rds.Instance('grabdy-temporal-db', {
  engine: 'postgres',
  engineVersion: '16.6',
  instanceClass: 'db.t4g.micro',
  allocatedStorage: 20,
  maxAllocatedStorage: 50,
  storageType: 'gp3',

  dbName: 'temporal',
  username: 'temporal',
  password: dbPassword,

  dbSubnetGroupName: subnetGroup.name,
  vpcSecurityGroupIds: [temporalDbSg.id],

  publiclyAccessible: false,
  storageEncrypted: true,
  backupRetentionPeriod: 7,
  skipFinalSnapshot: false,
  finalSnapshotIdentifier: 'grabdy-temporal-db-final',
  deletionProtection: true,

  performanceInsightsEnabled: false,
});
