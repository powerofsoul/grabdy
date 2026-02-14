import * as aws from '@pulumi/aws';

import { Env } from '../env';

const zone = aws.route53.getZone({ name: Env.domain });

// SES domain identity
const domainIdentity = new aws.ses.DomainIdentity('grabdy-ses-domain', {
  domain: Env.domain,
});

// DKIM verification
const dkim = new aws.ses.DomainDkim('grabdy-ses-dkim', {
  domain: domainIdentity.domain,
});

// Create DKIM DNS records
[0, 1, 2].map(
  (i) =>
    new aws.route53.Record(`grabdy-ses-dkim-${i}`, {
      zoneId: zone.then((z) => z.zoneId),
      name: dkim.dkimTokens[i].apply((token) => `${token}._domainkey.${Env.domain}`),
      type: 'CNAME',
      ttl: 600,
      records: [dkim.dkimTokens[i].apply((token) => `${token}.dkim.amazonses.com`)],
    }),
);

// SPF record for SES
new aws.route53.Record('grabdy-ses-spf', {
  zoneId: zone.then((z) => z.zoneId),
  name: Env.domain,
  type: 'TXT',
  ttl: 600,
  records: ['v=spf1 include:amazonses.com ~all'],
});

// MAIL FROM domain for better deliverability
new aws.ses.MailFrom('grabdy-ses-mailfrom', {
  domain: domainIdentity.domain,
  mailFromDomain: `mail.${Env.domain}`,
});

new aws.route53.Record('grabdy-ses-mailfrom-mx', {
  zoneId: zone.then((z) => z.zoneId),
  name: `mail.${Env.domain}`,
  type: 'MX',
  ttl: 600,
  records: [aws.getRegionOutput().name.apply((r) => `10 feedback-smtp.${r}.amazonses.com`)],
});

new aws.route53.Record('grabdy-ses-mailfrom-spf', {
  zoneId: zone.then((z) => z.zoneId),
  name: `mail.${Env.domain}`,
  type: 'TXT',
  ttl: 600,
  records: ['v=spf1 include:amazonses.com ~all'],
});
