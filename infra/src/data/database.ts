import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

import { Env } from '../env';
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
  password: Env.dbPassword,

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

export const databaseUrl = pulumi.interpolate`postgresql://grabdy:${Env.dbPassword}@${db.endpoint}/grabdy`;
