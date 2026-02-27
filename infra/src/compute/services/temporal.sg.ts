import * as aws from '@pulumi/aws';

import { vpc } from '../../network/vpc';
import { apiSg } from './api.sg';

// Temporal security group — API -> Temporal on 7233
export const temporalSg = new aws.ec2.SecurityGroup('grabdy-temporal-sg', {
  vpcId: vpc.vpcId,
  description: 'Temporal server security group',
  ingress: [
    { protocol: 'tcp', fromPort: 7233, toPort: 7233, securityGroups: [apiSg.id] },
  ],
  egress: [{ protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] }],
});
