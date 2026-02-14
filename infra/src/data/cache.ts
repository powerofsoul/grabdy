import * as aws from '@pulumi/aws';

import { cacheSg, vpc } from '../network/vpc';

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
