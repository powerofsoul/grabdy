import * as aws from '@pulumi/aws';

import { albSg, vpc } from '../../network/vpc';
import { inngestSg } from './inngest.sg';

// API security group — ALB + Inngest -> Fargate on port 4000
export const apiSg = new aws.ec2.SecurityGroup('grabdy-api-sg', {
  vpcId: vpc.vpcId,
  description: 'Fargate API security group',
  ingress: [
    { protocol: 'tcp', fromPort: 4000, toPort: 4000, securityGroups: [albSg.id] },
    { protocol: 'tcp', fromPort: 4000, toPort: 4000, securityGroups: [inngestSg.id] },
  ],
  egress: [{ protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] }],
});

// Allow API -> Inngest on 8288 (for Cloud Map service discovery)
new aws.ec2.SecurityGroupRule('api-to-inngest', {
  type: 'ingress',
  securityGroupId: inngestSg.id,
  fromPort: 8288,
  toPort: 8288,
  protocol: 'tcp',
  sourceSecurityGroupId: apiSg.id,
});
