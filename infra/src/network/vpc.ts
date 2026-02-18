import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';

export const vpc = new awsx.ec2.Vpc('grabdy-vpc', {
  numberOfAvailabilityZones: 2,
  natGateways: { strategy: awsx.ec2.NatGatewayStrategy.None },
  subnetStrategy: awsx.ec2.SubnetAllocationStrategy.Auto,
  subnetSpecs: [
    { type: awsx.ec2.SubnetType.Public, name: 'public' },
    { type: awsx.ec2.SubnetType.Isolated, name: 'isolated' },
  ],
});

// ALB security group — internet -> ALB on 80/443
export const albSg = new aws.ec2.SecurityGroup('grabdy-alb-sg', {
  vpcId: vpc.vpcId,
  description: 'ALB security group',
  ingress: [
    { protocol: 'tcp', fromPort: 80, toPort: 80, cidrBlocks: ['0.0.0.0/0'] },
    { protocol: 'tcp', fromPort: 443, toPort: 443, cidrBlocks: ['0.0.0.0/0'] },
  ],
  egress: [{ protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] }],
});

// API security group — ALB -> Fargate on port 4000
export const apiSg = new aws.ec2.SecurityGroup('grabdy-api-sg', {
  vpcId: vpc.vpcId,
  description: 'Fargate API security group',
  ingress: [{ protocol: 'tcp', fromPort: 4000, toPort: 4000, securityGroups: [albSg.id] }],
  egress: [{ protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] }],
});

// Database security group — Fargate -> RDS on 5432
export const dbSg = new aws.ec2.SecurityGroup('grabdy-db-sg', {
  vpcId: vpc.vpcId,
  description: 'RDS security group',
  ingress: [{ protocol: 'tcp', fromPort: 5432, toPort: 5432, securityGroups: [apiSg.id] }],
  egress: [{ protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] }],
});

// Cache security group — Fargate -> ElastiCache on 6379
export const cacheSg = new aws.ec2.SecurityGroup('grabdy-cache-sg', {
  vpcId: vpc.vpcId,
  description: 'ElastiCache security group',
  ingress: [{ protocol: 'tcp', fromPort: 6379, toPort: 6379, securityGroups: [apiSg.id] }],
  egress: [{ protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] }],
});
