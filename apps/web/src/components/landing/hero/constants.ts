import { nonDbIdSchema } from '@grabdy/common';
import type { Card } from '@grabdy/contracts';
import type { Node, Edge } from '@xyflow/react';

import type { ChatMessage } from '@/components/chat/types';

import type { DemoSource } from './types';

// ── ID helpers for demo data ──
// Construct valid packed UUIDs with correct entity type bytes.
// Layout: org(4B) + timestamp(6B) + entity_type(1B) + random(5B)
// Byte 10 (hex chars 20-21): CanvasCard=0x31, CanvasEdge=0x32, CanvasComponent=0x33
const parseCardId = nonDbIdSchema('CanvasCard').parse;
const parseComponentId = nonDbIdSchema('CanvasComponent').parse;
const parseEdgeId = nonDbIdSchema('CanvasEdge').parse;

const cardId = (n: number) => parseCardId(`00000001-0000-0000-0000-31000000000${n}`);
const compId = (n: number) => parseComponentId(`00000001-0000-0000-0000-33000000000${n}`);
const edgeId = (n: number) => parseEdgeId(`00000001-0000-0000-0000-32000000000${n}`);

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

// ── Canvas demo data (real Card types for ReactFlow) ──

const DEMO_CARD_DEFS = [
  {
    id: cardId(1),
    position: { x: 0, y: 0 },
    width: 360,
    height: 140,
    title: 'Pricing Summary',
    component: {
      id: compId(1),
      type: 'key_value',
      data: {
        pairs: [
          { key: 'Enterprise tier', value: '$99/seat/mo' },
          { key: 'Effective date', value: 'July 1, 2025' },
          { key: 'Volume discount', value: '15% (200+ seats)' },
        ],
      },
      citations: [],
    },
    sources: [],
    metadata: { createdBy: 'ai', locked: false, tags: [] },
  },
  {
    id: cardId(2),
    position: { x: 420, y: 0 },
    width: 360,
    height: 140,
    title: 'Tier Comparison',
    component: {
      id: compId(2),
      type: 'table',
      data: {
        columns: [
          { key: 'tier', label: 'Tier' },
          { key: 'price', label: 'Price' },
        ],
        rows: [
          { tier: 'Starter', price: '$29/seat' },
          { tier: 'Pro', price: '$59/seat' },
          { tier: 'Enterprise', price: '$99/seat' },
        ],
      },
      citations: [],
    },
    sources: [],
    metadata: { createdBy: 'ai', locked: false, tags: [] },
  },
  {
    id: cardId(3),
    position: { x: 0, y: 220 },
    width: 360,
    height: 140,
    title: 'Revenue Impact',
    component: {
      id: compId(3),
      type: 'kpi_row',
      data: {
        metrics: [
          { label: 'Projected ARR', value: '+$2.4M', trend: { direction: 'up', value: '+27%' } },
          { label: 'Enterprise seats', value: '4,200' },
          { label: 'Grandfathered', value: '~30%' },
        ],
      },
      citations: [],
    },
    sources: [],
    metadata: { createdBy: 'ai', locked: false, tags: [] },
  },
  {
    id: cardId(4),
    position: { x: 420, y: 220 },
    width: 360,
    height: 160,
    title: 'Action Items',
    component: {
      id: compId(4),
      type: 'checklist',
      data: {
        items: [
          { label: 'Notify existing enterprise customers', checked: false },
          { label: 'Update pricing page by June 15', checked: false },
          { label: 'Brief sales team on new tiers', checked: true },
          { label: 'Set up grandfathering logic', checked: false },
        ],
      },
      citations: [],
    },
    sources: [],
    metadata: { createdBy: 'ai', locked: false, tags: [] },
  },
] satisfies Card[];

// Convert Card[] to ReactFlow Node[]
export const DEMO_NODES: Node[] = DEMO_CARD_DEFS.map((card) => ({
  id: card.id,
  type: 'card',
  position: card.position,
  data: {
    id: card.id,
    position: card.position,
    width: card.width,
    height: card.height,
    title: card.title,
    component: card.component,
    sources: card.sources,
    metadata: card.metadata,
  },
  width: card.width,
  style: { width: card.width },
  connectable: false,
}));

export const DEMO_EDGES: Edge[] = [
  { id: edgeId(1), source: cardId(1), target: cardId(3), sourceHandle: 'bottom', targetHandle: 'top' },
  { id: edgeId(2), source: cardId(2), target: cardId(4), sourceHandle: 'bottom', targetHandle: 'top' },
  { id: edgeId(3), source: cardId(1), target: cardId(2), sourceHandle: 'right', targetHandle: 'left' },
  { id: edgeId(4), source: cardId(3), target: cardId(4), sourceHandle: 'right', targetHandle: 'left' },
].map((e) => ({ ...e, type: 'custom' satisfies string, data: { strokeWidth: 2 } }));

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
