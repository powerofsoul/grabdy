export const FEATURE_TABS = [
  {
    number: '01',
    title: 'Contract search',
    heading: 'Ask about any clause, any contract',
    description:
      'Search across your entire contract library in plain English. Find indemnification caps, termination rights, or payment terms in seconds, with cited page numbers.',
  },
  {
    number: '02',
    title: 'Deadline alerts',
    heading: 'Never miss a renewal or compliance date',
    description:
      'Get notified before auto-renewals, option windows, and compliance deadlines expire. No more spreadsheet tracking.',
  },
  {
    number: '03',
    title: 'Document upload',
    heading: 'All your legal docs in one place',
    description:
      'Upload contracts, NDAs, BAAs, compliance filings, and policy documents. Supports PDF, Word, CSV, and plain text.',
  },
  {
    number: '04',
    title: 'Deviation detection',
    heading: 'Spot what changed in new terms',
    description:
      'Compare incoming vendor contracts against your standard terms. Surface material deviations before you sign.',
  },
  {
    number: '05',
    title: 'REST API',
    heading: 'Connect to your CLM and billing systems',
    description:
      'Integrate contract intelligence into your existing tools. Push deadline data to billing, sync terms to your CLM.',
  },
  {
    number: '06',
    title: 'Enterprise security',
    heading: 'Built for sensitive legal documents',
    description:
      'SOC 2 compliant infrastructure. Your documents are encrypted at rest and in transit. Data is never used to train models.',
  },
] as const;

export const TAB_COUNT = FEATURE_TABS.length;
