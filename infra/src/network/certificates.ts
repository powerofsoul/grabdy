import * as aws from '@pulumi/aws';

import { Env } from '../env';

const zone = aws.route53.getZone({ name: Env.domain });

// ACM cert for ALB (api.grabdy.com) — same region
const apiCert = new aws.acm.Certificate('grabdy-api-cert', {
  domainName: Env.apiDomain,
  validationMethod: 'DNS',
});

const apiCertValidation = new aws.route53.Record('grabdy-api-cert-validation', {
  zoneId: zone.then((z) => z.zoneId),
  name: apiCert.domainValidationOptions[0].resourceRecordName,
  type: apiCert.domainValidationOptions[0].resourceRecordType,
  records: [apiCert.domainValidationOptions[0].resourceRecordValue],
  ttl: 60,
  allowOverwrite: true,
});

const apiCertWaiter = new aws.acm.CertificateValidation('grabdy-api-cert-wait', {
  certificateArn: apiCert.arn,
  validationRecordFqdns: [apiCertValidation.fqdn],
});

// ACM cert for CloudFront (grabdy.com + www) — MUST be us-east-1
const usEast1 = new aws.Provider('us-east-1', { region: 'us-east-1' });

const frontendCert = new aws.acm.Certificate(
  'grabdy-frontend-cert',
  {
    domainName: Env.domain,
    subjectAlternativeNames: [`www.${Env.domain}`],
    validationMethod: 'DNS',
  },
  { provider: usEast1 }
);

// Create a validation record for each unique domain on the cert
const frontendCertValidationRecords = frontendCert.domainValidationOptions.apply((opts) => {
  const seen = new Set<string>();
  return opts.filter((opt) => {
    if (seen.has(opt.resourceRecordName)) return false;
    seen.add(opt.resourceRecordName);
    return true;
  });
});

const frontendValidation0 = new aws.route53.Record('grabdy-frontend-cert-validation-0', {
  zoneId: zone.then((z) => z.zoneId),
  name: frontendCertValidationRecords[0].resourceRecordName,
  type: frontendCertValidationRecords[0].resourceRecordType,
  records: [frontendCertValidationRecords[0].resourceRecordValue],
  ttl: 60,
  allowOverwrite: true,
});

const frontendValidation1 = new aws.route53.Record('grabdy-frontend-cert-validation-1', {
  zoneId: zone.then((z) => z.zoneId),
  name: frontendCertValidationRecords[1].resourceRecordName,
  type: frontendCertValidationRecords[1].resourceRecordType,
  records: [frontendCertValidationRecords[1].resourceRecordValue],
  ttl: 60,
  allowOverwrite: true,
});

const frontendCertWaiter = new aws.acm.CertificateValidation(
  'grabdy-frontend-cert-wait',
  {
    certificateArn: frontendCert.arn,
    validationRecordFqdns: [frontendValidation0.fqdn, frontendValidation1.fqdn],
  },
  { provider: usEast1 }
);

export const apiCertArn = apiCertWaiter.certificateArn;
export const frontendCertArn = frontendCertWaiter.certificateArn;
