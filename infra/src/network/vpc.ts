import * as aws from '@pulumi/aws';
import * as awsx from '@pulumi/awsx';

export const vpc = new awsx.ec2.Vpc('grabdy-vpc', {
  numberOfAvailabilityZones: 2,
  enableDnsHostnames: true,
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
