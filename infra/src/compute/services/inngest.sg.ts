import * as aws from '@pulumi/aws';

import { albSg, vpc } from '../../network/vpc';

// Inngest security group — ALB -> Fargate on port 8288
export const inngestSg = new aws.ec2.SecurityGroup('grabdy-inngest-sg', {
  vpcId: vpc.vpcId,
  description: 'Fargate Inngest security group',
  ingress: [{ protocol: 'tcp', fromPort: 8288, toPort: 8288, securityGroups: [albSg.id] }],
  egress: [{ protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] }],
});
