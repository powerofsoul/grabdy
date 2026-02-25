export const SAMPLE_MESSAGES = [
  { role: 'user', text: 'Do you ship internationally?' },
  {
    role: 'assistant',
    text: 'Yes! We ship to over 40 countries. Standard international delivery takes 7-12 business days.',
  },
  { role: 'user', text: 'What about returns?' },
  {
    role: 'assistant',
    text: 'You can return any item within 30 days for a full refund. We even cover return shipping.',
  },
] satisfies ReadonlyArray<{ role: string; text: string }>;

export const SECTION_COPY = {
  overline: 'Embed anywhere',
  title: 'Drop-in chat widget',
  description:
    'Add an AI assistant to your site with a single script tag. Fully customizable to match your brand, works on any website.',
  cta: 'Get Started',
} satisfies Record<string, string>;

export const MOCK_URL = 'yourstore.com/products';
