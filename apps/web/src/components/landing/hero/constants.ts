import type { DemoSource } from './types';

import type { ChatMessage } from '@/components/chat/types';

// ── Chat demo data ──

export const DEMO_MESSAGES = [
  {
    id: 'demo-user-1',
    role: 'user',
    content: 'What was decided about the Q2 pricing changes?',
  },
  {
    id: 'demo-assistant-1',
    role: 'assistant',
    content:
      'Based on the Q2 Pricing Review and the discussion in #pricing-team, enterprise tier pricing increases from **$89/seat to $99/seat** effective July 1st. Existing annual contracts are grandfathered at the current rate through renewal. A **15% volume discount** now applies to teams over 200 seats.',
    thinkingTexts: [
      'Scanning Q2-pricing-review.pdf...',
      'Reading #pricing-team discussion...',
      'Cross-referencing PROD-892...',
    ],
    durationMs: 2300,
  },
] satisfies ChatMessage[];

export const DEMO_SOURCES = [
  { type: 'PDF', name: 'Q2-pricing-review.pdf', detail: 'page 3' },
  { type: 'SLACK', name: '#pricing-team', detail: 'discussion' },
  { type: 'LINEAR', name: 'PROD-892', detail: '' },
] satisfies DemoSource[];

// ── Slack demo data ──

export const SLACK_DEMO = {
  userName: 'Sarah Chen',
  userInitials: 'SC',
  userMessage: 'What was decided about the Q2 pricing changes for enterprise tier?',
  botResponse:
    'Based on the Q2 Pricing Review and the discussion in #pricing-team: enterprise tier pricing will increase from $89/seat to $99/seat, effective July 1st. Existing annual contracts are grandfathered at the current rate through renewal. A 15% volume discount now applies to teams over 200 seats.',
  sources: [
    { name: 'Q2-pricing-review.pdf', detail: 'page 3' },
    { name: '#pricing-team', detail: 'discussion (Apr 2)' },
    { name: 'PROD-892', detail: 'Linear' },
  ],
  channel: 'product-team',
  time: '2:42 PM',
} satisfies {
  userName: string;
  userInitials: string;
  userMessage: string;
  botResponse: string;
  sources: ReadonlyArray<{ name: string; detail: string }>;
  channel: string;
  time: string;
};
