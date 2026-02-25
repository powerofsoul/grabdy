import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

import { apiSg } from '../compute/services/api.sg';
import { vpc } from '../network/vpc';

const dbPasswordParam = aws.ssm.getParameterOutput({
  name: '/grabdy/prod/DB_PASSWORD',
  withDecryption: true,
});
const dbPassword = pulumi.secret(dbPasswordParam.value);

// Database security group — Fargate API -> RDS on 5432
const dbSg = new aws.ec2.SecurityGroup('grabdy-db-sg', {
  vpcId: vpc.vpcId,
  description: 'RDS security group',
  ingress: [
    { protocol: 'tcp', fromPort: 5432, toPort: 5432, securityGroups: [apiSg.id] },
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
  password: dbPassword,

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


