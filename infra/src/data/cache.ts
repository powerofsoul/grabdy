import * as aws from '@pulumi/aws';

import { apiSg } from '../compute/services/api.sg';
import { inngestSg } from '../compute/services/inngest.sg';
import { vpc } from '../network/vpc';

// Cache security group — Fargate + Inngest -> ElastiCache on 6379
const cacheSg = new aws.ec2.SecurityGroup('grabdy-cache-sg', {
  vpcId: vpc.vpcId,
  description: 'ElastiCache security group',
  ingress: [
    { protocol: 'tcp', fromPort: 6379, toPort: 6379, securityGroups: [apiSg.id] },
    { protocol: 'tcp', fromPort: 6379, toPort: 6379, securityGroups: [inngestSg.id] },
  ],
  egress: [{ protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] }],
});

const subnetGroup = new aws.elasticache.SubnetGroup('grabdy-cache-subnet', {
  subnetIds: vpc.isolatedSubnetIds,
  description: 'Grabdy ElastiCache subnet group',
});

const cache = new aws.elasticache.Cluster('grabdy-cache', {
  engine: 'redis',
  engineVersion: '7.1',
  nodeType: 'cache.t4g.micro',
  numCacheNodes: 1,
  subnetGroupName: subnetGroup.name,
  securityGroupIds: [cacheSg.id],
  snapshotRetentionLimit: 1,
});

export const cacheHost = cache.cacheNodes.apply((nodes) => nodes[0].address);
export const cachePort = cache.cacheNodes.apply((nodes) => nodes[0].port.toString());
