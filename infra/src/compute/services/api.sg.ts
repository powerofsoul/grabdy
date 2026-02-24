import * as aws from '@pulumi/aws';

import { albSg, vpc } from '../../network/vpc';

// API security group — ALB -> Fargate on port 4000
export const apiSg = new aws.ec2.SecurityGroup('grabdy-api-sg', {
  vpcId: vpc.vpcId,
  description: 'Fargate API security group',
  ingress: [
    { protocol: 'tcp', fromPort: 4000, toPort: 4000, securityGroups: [albSg.id] },
  ],
  egress: [{ protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] }],
});
