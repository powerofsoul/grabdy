import type { CardSource, HeroCardId } from './types';

export const TURNS = [
  {
    user: 'Analyze the uploaded market research and map out the competitive landscape',
    thinking: [
      'Scanning Google Drive (3 files)...',
      'Reading #market-research on Slack...',
      'Cross-referencing Linear PRD-142...',
      'Extracting from Internal Review.docx...',
    ],
    answer:
      'Based on Market Analysis 2024.pdf from Drive, the TAM is $47B with $12B serviceable. From Competitor Data.xlsx + Linear PRD-142, you rank 2nd among 4 key players. SWOT pulled from Slack #strategy-discussion and Internal Review.docx.',
    sources: ['Google Drive (3 files)', 'Slack (2 channels)', 'Linear (1 issue)'],
    responseMs: 2340,
  },
  {
    user: 'Break down our metrics and identify the best growth channels',
    thinking: [
      'Parsing Financial Report Q4.pdf from Drive...',
      'Analyzing Marketing Data.csv...',
      'Reading Slack #growth-team history...',
    ],
    answer:
      'From Financial Report Q4.pdf: revenue $9.6M, +23% YoY, NRR 124%. Marketing Data.csv shows organic content drives 45% of new ARR. Slack #ops-alerts flags the 4.2-month enterprise sales cycle as a risk.',
    sources: ['Google Drive (2 files)', 'Slack (2 channels)', 'Linear (KPI-Dashboard)'],
    responseMs: 1870,
  },
  {
    user: 'What are your strategic recommendations? Build me a 90-day plan.',
    thinking: [
      'Synthesizing across all sources...',
      'Ranking opportunities by confidence...',
      'Mapping to Linear Sprint 24 Plan...',
    ],
    answer:
      'Synthesizing all sources — three priorities: (1) enterprise SDR team (Financial Report Q4 supports the ROI case), (2) content-led growth per Marketing Data channel analysis, (3) partner program aligned with Linear Sprint 24 roadmap.',
    sources: ['Google Drive (5 files)', 'Slack (3 channels)', 'Linear (4 issues)'],
    responseMs: 3120,
  },
] satisfies Array<{
  user: string;
  thinking: string[];
  answer: string;
  sources: string[];
  responseMs: number;
}>;

export const INIT_POS: Record<HeroCardId, { x: number; y: number }> = {
  hub: { x: 500, y: 15 },
  market: { x: 20, y: 120 },
  competitors: { x: 420, y: 120 },
  swot: { x: 850, y: 120 },
  metrics: { x: 10, y: 420 },
  channels: { x: 390, y: 420 },
  risks: { x: 830, y: 420 },
  recommendations: { x: 100, y: 680 },
  roadmap: { x: 580, y: 680 },
  summary: { x: 410, y: 930 },
};

export const NODE_W: Record<HeroCardId, number> = {
  hub: 280,
  market: 250,
  competitors: 270,
  swot: 270,
  metrics: 260,
  channels: 280,
  risks: 255,
  recommendations: 290,
  roadmap: 300,
  summary: 330,
};

export const NODE_H: Record<HeroCardId, number> = {
  hub: 44,
  market: 210,
  competitors: 200,
  swot: 230,
  metrics: 165,
  channels: 160,
  risks: 165,
  recommendations: 180,
  roadmap: 155,
  summary: 65,
};

export const EDGES: ReadonlyArray<readonly [HeroCardId, HeroCardId]> = [
  ['hub', 'market'],
  ['hub', 'competitors'],
  ['hub', 'swot'],
  ['market', 'metrics'],
  ['competitors', 'channels'],
  ['swot', 'risks'],
  ['metrics', 'recommendations'],
  ['channels', 'recommendations'],
  ['risks', 'roadmap'],
  ['recommendations', 'roadmap'],
  ['recommendations', 'summary'],
  ['roadmap', 'summary'],
] satisfies ReadonlyArray<readonly [HeroCardId, HeroCardId]>;

export const CURSOR_TARGETS: Record<HeroCardId, { x: number; y: number }> = {
  hub: { x: 630, y: 30 },
  market: { x: 145, y: 200 },
  competitors: { x: 545, y: 200 },
  swot: { x: 975, y: 200 },
  metrics: { x: 130, y: 500 },
  channels: { x: 520, y: 490 },
  risks: { x: 950, y: 500 },
  recommendations: { x: 235, y: 760 },
  roadmap: { x: 720, y: 750 },
  summary: { x: 570, y: 960 },
};

export const MARKET_BARS = [
  { label: 'TAM', value: '$47B', pct: 100 },
  { label: 'SAM', value: '$12B', pct: 26 },
  { label: 'SOM', value: '$3.2B', pct: 7 },
] satisfies Array<{ label: string; value: string; pct: number }>;

export const COMPETITORS = [
  { name: 'You', score: 87, pos: '2nd' },
  { name: 'Acme AI', score: 91, pos: '1st' },
  { name: 'DataCo', score: 72, pos: '3rd' },
  { name: 'InfoX', score: 64, pos: '4th' },
] satisfies Array<{ name: string; score: number; pos: string }>;

export const SWOT = {
  s: ['AI-first platform', 'Dev experience'],
  w: ['Enterprise sales', 'Brand awareness'],
  o: ['APAC expansion', 'Partner channel'],
  t: ['Big tech entry', 'Pricing pressure'],
} satisfies Record<string, string[]>;

export const METRICS_DATA = [
  { label: 'Revenue', value: '$9.6M', delta: '+23%' },
  { label: 'ARR', value: '$11.2M', delta: '+18%' },
  { label: 'NRR', value: '124%', delta: '+6%' },
] satisfies Array<{ label: string; value: string; delta: string }>;

export const CHANNEL_FLOW = ['Organic', 'Content', 'Trial', 'Convert'] as const;

export const RISKS = [
  { text: 'Sales cycle length', level: 'High' },
  { text: 'Churn in SMB tier', level: 'Med' },
  { text: 'Hiring pipeline', level: 'Low' },
] satisfies Array<{ text: string; level: string }>;

export const PRIORITIES = [
  { text: 'Enterprise SDR team', confidence: 92 },
  { text: 'Content-led growth', confidence: 87 },
  { text: 'Partner program', confidence: 78 },
] satisfies Array<{ text: string; confidence: number }>;

export const ROADMAP_ITEMS = [
  { q: 'W1-4', text: 'SDR hire + playbook' },
  { q: 'W5-8', text: 'Content engine 2.0' },
  { q: 'W9-12', text: 'Partner beta launch' },
] satisfies Array<{ q: string; text: string }>;

export const SUMMARY_STATS = [
  { label: 'Insights', value: '9' },
  { label: 'Priorities', value: '3' },
  { label: 'Timeline', value: '90d' },
] satisfies Array<{ label: string; value: string }>;

export const CARD_SOURCES: Partial<Record<HeroCardId, CardSource[]>> = {
  market: [
    { type: 'gdrive', label: 'Market Analysis 2024.pdf' },
    { type: 'slack', label: '#market-research' },
  ],
  competitors: [
    { type: 'gdrive', label: 'Competitor Data.xlsx' },
    { type: 'linear', label: 'PRD-142 Competitive Intel' },
  ],
  swot: [
    { type: 'slack', label: '#strategy-discussion' },
    { type: 'gdrive', label: 'Internal Review.docx' },
  ],
  metrics: [
    { type: 'gdrive', label: 'Financial Report Q4.pdf' },
    { type: 'linear', label: 'KPI-Dashboard' },
  ],
  channels: [
    { type: 'gdrive', label: 'Marketing Data.csv' },
    { type: 'slack', label: '#growth-team' },
  ],
  risks: [
    { type: 'linear', label: 'RISK-23 Sales Cycle' },
    { type: 'slack', label: '#ops-alerts' },
  ],
  recommendations: [
    { type: 'gdrive', label: '5 documents' },
    { type: 'slack', label: '3 channels' },
    { type: 'linear', label: '4 issues' },
  ],
  roadmap: [
    { type: 'linear', label: 'Sprint 24 Plan' },
    { type: 'gdrive', label: 'Internal Review.docx' },
  ],
};

export const CX = 630;
export const CY = 520;
