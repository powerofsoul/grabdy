import type { MockMessage } from './types';

export const MOCK_CONVERSATION = [
  {
    role: 'user',
    content: 'Which contracts auto-renew in the next 90 days?',
  },
  {
    role: 'assistant',
    content:
      'Four contracts auto-renew before June 30:\n\n- **Datadog** and **Snowflake** require 60-day written notice {{1}} {{2}}\n- **AWS** and **Zendesk** require 30-day notice {{3}}\n\nAction needed by April 1 for the 60-day contracts.',
    sources: [
      {
        name: 'datadog-msa.pdf',
        excerpt:
          'This Agreement shall automatically renew for successive one (1) year terms unless either party provides written notice of non-renewal at least sixty (60) days prior to the end of the then-current term.',
        location: 'Section 7.2',
      },
      {
        name: 'snowflake-order-form.pdf',
        excerpt:
          'The Subscription Term shall automatically renew for additional periods of twelve (12) months each, unless either party gives the other written notice of termination not less than sixty (60) days before expiration.',
        location: 'Section 4.1',
      },
      {
        name: 'aws-enterprise.pdf',
        excerpt:
          'Unless terminated in accordance with this Section, the Term will automatically renew for successive one-year periods. Either party may terminate by providing at least thirty (30) days prior written notice.',
        location: 'Section 6.3',
      },
    ],
  },
  {
    role: 'user',
    content: 'What is the indemnification cap in the Snowflake deal?',
  },
  {
    role: 'assistant',
    content:
      'Mutual indemnification capped at **2x annual fees** ($430K). {{1}} Carve-outs for IP infringement and data breach are uncapped per Section 9.3. {{2}}',
    sources: [
      {
        name: 'snowflake-order-form.pdf',
        excerpt:
          'The aggregate liability of each party for all claims arising under this Agreement shall not exceed two times (2x) the total fees paid or payable during the twelve (12) month period preceding the claim.',
        location: 'Section 9.1',
      },
      {
        name: 'snowflake-order-form.pdf',
        excerpt:
          "The limitations set forth in Section 9.1 shall not apply to: (a) a party's indemnification obligations under Section 8; (b) a party's breach of confidentiality obligations; (c) IP infringement claims.",
        location: 'Section 9.3',
      },
    ],
  },
  {
    role: 'user',
    content: 'What is our total value at risk this quarter?',
  },
  {
    role: 'assistant',
    content:
      '$2.4M across 12 contracts expiring before June 30. {{1}} Top concentration: Acme Corp ($890K, 3 contracts). {{2}} Two contracts have uncapped auto-renewal. {{3}}',
    sources: [
      {
        name: 'Q2 Expiration Report',
        excerpt:
          'Total contract value expiring in Q2 2026: $2,412,800 across 12 active agreements. Includes 4 auto-renewing contracts with combined value of $1.1M.',
        location: 'Summary',
      },
      {
        name: 'acme-msa-2023.pdf',
        excerpt:
          'Master Services Agreement between Acme Corp and Company. Total annual contract value: $890,000 across three (3) Statements of Work executed under this MSA.',
        location: 'Schedule A',
      },
      {
        name: 'vendor-risk-analysis/',
        excerpt:
          'Two vendor agreements contain uncapped auto-renewal clauses with no termination-for-convenience right. Combined annual spend: $340K. Recommend renegotiation before renewal window closes.',
        location: 'Risk Flags',
      },
    ],
  },
] satisfies ReadonlyArray<MockMessage>;
