import type { DemoSource } from './types';

import type { ChatMessage } from '@/components/chat/types';

// ── Chat demo data ──

export const DEMO_MESSAGES = [
  {
    id: 'demo-user-1',
    role: 'user',
    content: 'When does the Acme MSA auto-renew, and what is the notice period?',
  },
  {
    id: 'demo-assistant-1',
    role: 'assistant',
    content:
      'The Acme MSA auto-renews on **September 15, 2026**. A **90-day written notice** is required to terminate per Section 12.1. The current term is 3 years from the execution date. Annual contract value is **$240,000**.',
    thinkingTexts: [
      'Scanning acme-msa-2023.pdf...',
      'Reading Section 12.1 (Term & Renewal)...',
      'Cross-referencing vendor tracker...',
    ],
    durationMs: 2300,
  },
] satisfies ChatMessage[];

export const DEMO_SOURCES = [
  { type: 'PDF', name: 'acme-msa-2023.pdf', detail: 'Section 12.1' },
  { type: 'PDF', name: 'acme-sow-2024.pdf', detail: 'page 2' },
  { type: 'PDF', name: 'vendor-tracker.pdf', detail: '' },
] satisfies DemoSource[];

// ── Email alert demo data ──

export const SLACK_DEMO = {
  userName: 'Jordan Rivera',
  userInitials: 'JR',
  userMessage: 'Which vendor agreements have termination notice periods ending this quarter?',
  botResponse:
    'Three agreements have notice periods ending before June 30: Acme MSA (notice due by June 17, 90-day window), Contoso SaaS Agreement (notice due by May 2, 60-day window), and Northwind NDA (notice due by May 29, 30-day window).',
  sources: [
    { name: 'acme-msa-2023.pdf', detail: 'Section 12.1' },
    { name: 'contoso-agreement.pdf', detail: 'Section 8.4' },
    { name: 'northwind-nda.pdf', detail: 'Section 5.2' },
  ],
  channel: 'legal-team',
  time: '9:15 AM',
} satisfies {
  userName: string;
  userInitials: string;
  userMessage: string;
  botResponse: string;
  sources: ReadonlyArray<{ name: string; detail: string }>;
  channel: string;
  time: string;
};
