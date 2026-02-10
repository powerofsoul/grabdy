import { useCallback, useEffect, useRef, useState } from 'react';

import { alpha, Box, Button, Container, IconButton, Typography, useTheme } from '@mui/material';
import { Link } from '@tanstack/react-router';
import gsap from 'gsap';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Brain,
  ChevronRight,
  Clock,
  FileText,
  Lightbulb,
  Minus,
  Plus,
  Rocket,
  Send,
  Share2,
  Shield,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';

// ── Brand icons (SVG paths from simple-icons) ──

function SlackIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A" />
      <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0" />
      <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D" />
      <path d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" fill="#ECB22E" />
    </svg>
  );
}

function GoogleDriveIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12.01 1.485c-2.082 0-3.754.02-3.743.047.01.02 1.708 3.001 3.774 6.62l3.76 6.574h3.76c2.081 0 3.753-.02 3.742-.047-.005-.02-1.708-3.001-3.775-6.62l-3.76-6.574z" fill="#4688F4" />
      <path d="M7.25 3.214a789.828 789.861 0 0 0-3.63 6.319L0 15.868l1.89 3.298 1.885 3.297 3.62-6.335 3.618-6.33-1.88-3.287C8.1 4.704 7.255 3.22 7.25 3.214z" fill="#1FA463" />
      <path d="M9.509 16.468l-.203.348c-.114.198-.96 1.672-1.88 3.287a423.93 423.948 0 0 1-1.698 2.97c-.01.026 3.24.042 7.222.042h7.244l1.796-3.157c.992-1.734 1.85-3.23 1.906-3.323l.104-.167h-7.249z" fill="#FFD04B" />
    </svg>
  );
}

function LinearIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z" fill="#5E6AD2" />
    </svg>
  );
}

type SourceType = 'slack' | 'gdrive' | 'linear' | 'file';

interface CardSource {
  type: SourceType;
  label: string;
}

// ── Conversation ──

const TURNS = [
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
];

// ── Canvas nodes ──

const INIT_POS: Record<string, { x: number; y: number }> = {
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

const NODE_W: Record<string, number> = {
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

const NODE_H: Record<string, number> = {
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

const EDGES: ReadonlyArray<readonly [string, string]> = [
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
] satisfies ReadonlyArray<readonly [string, string]>;

const CURSOR_TARGETS: Record<string, { x: number; y: number }> = {
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

// Card content data
const MARKET_BARS = [
  { label: 'TAM', value: '$47B', pct: 100 },
  { label: 'SAM', value: '$12B', pct: 26 },
  { label: 'SOM', value: '$3.2B', pct: 7 },
];

const COMPETITORS = [
  { name: 'You', score: 87, pos: '2nd' },
  { name: 'Acme AI', score: 91, pos: '1st' },
  { name: 'DataCo', score: 72, pos: '3rd' },
  { name: 'InfoX', score: 64, pos: '4th' },
];

const SWOT = {
  s: ['AI-first platform', 'Dev experience'],
  w: ['Enterprise sales', 'Brand awareness'],
  o: ['APAC expansion', 'Partner channel'],
  t: ['Big tech entry', 'Pricing pressure'],
};

const METRICS_DATA = [
  { label: 'Revenue', value: '$9.6M', delta: '+23%' },
  { label: 'ARR', value: '$11.2M', delta: '+18%' },
  { label: 'NRR', value: '124%', delta: '+6%' },
];

const CHANNEL_FLOW = ['Organic', 'Content', 'Trial', 'Convert'];

const RISKS = [
  { text: 'Sales cycle length', level: 'High' },
  { text: 'Churn in SMB tier', level: 'Med' },
  { text: 'Hiring pipeline', level: 'Low' },
];

const PRIORITIES = [
  { text: 'Enterprise SDR team', confidence: 92 },
  { text: 'Content-led growth', confidence: 87 },
  { text: 'Partner program', confidence: 78 },
];

const ROADMAP_ITEMS = [
  { q: 'W1-4', text: 'SDR hire + playbook' },
  { q: 'W5-8', text: 'Content engine 2.0' },
  { q: 'W9-12', text: 'Partner beta launch' },
];

const SUMMARY_STATS = [
  { label: 'Insights', value: '9' },
  { label: 'Priorities', value: '3' },
  { label: 'Timeline', value: '90d' },
];

// Source integrations shown on each card
const CARD_SOURCES: Record<string, CardSource[]> = {
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

// Canvas center for pan calculations
const CX = 630;
const CY = 520;


interface ChatMsg {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  sources?: string[];
  responseMs?: number;
}

// ── Smart bezier: picks exit/entry side based on node centers ──
function edgePath(
  pos: Record<string, { x: number; y: number }>,
  from: string,
  to: string,
): string {
  const f = pos[from];
  const t = pos[to];
  if (!f || !t) return '';

  const fw = NODE_W[from], fh = NODE_H[from];
  const tw = NODE_W[to], th = NODE_H[to];

  // Centers
  const fcx = f.x + fw / 2, fcy = f.y + fh / 2;
  const tcx = t.x + tw / 2, tcy = t.y + th / 2;
  const dx = tcx - fcx, dy = tcy - fcy;

  let x0: number, y0: number, x1: number, y1: number;
  let cx0: number, cy0: number, cx1: number, cy1: number;

  if (Math.abs(dy) > Math.abs(dx) * 0.6) {
    // Mostly vertical — exit bottom, enter top
    x0 = f.x + fw / 2;
    y0 = f.y + fh;
    x1 = t.x + tw / 2;
    y1 = t.y;
    const offset = Math.abs(y1 - y0) * 0.45;
    cx0 = x0; cy0 = y0 + offset;
    cx1 = x1; cy1 = y1 - offset;
  } else {
    // Mostly horizontal — exit right/left side, enter opposite side
    if (dx > 0) {
      // Target is to the right
      x0 = f.x + fw; y0 = fcy;
      x1 = t.x;     y1 = tcy;
    } else {
      // Target is to the left
      x0 = f.x;     y0 = fcy;
      x1 = t.x + tw; y1 = tcy;
    }
    const offset = Math.abs(x1 - x0) * 0.4;
    cx0 = dx > 0 ? x0 + offset : x0 - offset;
    cy0 = y0;
    cx1 = dx > 0 ? x1 - offset : x1 + offset;
    cy1 = y1;
  }

  return `M ${x0},${y0} C ${cx0},${cy0} ${cx1},${cy1} ${x1},${y1}`;
}

// Get connection endpoint for SVG dots
function edgeEndpoints(
  pos: Record<string, { x: number; y: number }>,
  from: string,
  to: string,
): { x0: number; y0: number; x1: number; y1: number } | null {
  const f = pos[from];
  const t = pos[to];
  if (!f || !t) return null;

  const fw = NODE_W[from], fh = NODE_H[from];
  const tw = NODE_W[to], th = NODE_H[to];
  const fcx = f.x + fw / 2, fcy = f.y + fh / 2;
  const tcx = t.x + tw / 2, tcy = t.y + th / 2;
  const dx = tcx - fcx, dy = tcy - fcy;

  if (Math.abs(dy) > Math.abs(dx) * 0.6) {
    return { x0: f.x + fw / 2, y0: f.y + fh, x1: t.x + tw / 2, y1: t.y };
  }
  if (dx > 0) {
    return { x0: f.x + fw, y0: fcy, x1: t.x, y1: tcy };
  }
  return { x0: f.x, y0: fcy, x1: t.x + tw, y1: tcy };
}

export function HeroSection() {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const showcaseRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const animStarted = useRef(false);
  const cleanupRef = useRef<{ timeouts: ReturnType<typeof setTimeout>[]; intervals: ReturnType<typeof setInterval>[] }>({
    timeouts: [],
    intervals: [],
  });
  const isDark = theme.palette.mode === 'dark';

  // Chat
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [thinkActive, setThinkActive] = useState(false);
  const [thinkSteps, setThinkSteps] = useState<string[]>([]);
  const [thinkStep, setThinkStep] = useState(-1);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [inputText, setInputText] = useState('');
  const [inputActive, setInputActive] = useState(false);
  const [inView, setInView] = useState(false);

  // Canvas
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    const p: Record<string, { x: number; y: number }> = {};
    for (const k of Object.keys(INIT_POS)) p[k] = { ...INIT_POS[k] };
    return p;
  });
  const [visibleNodes, setVisibleNodes] = useState<Set<string>>(new Set());
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [cursorVisible, setCursorVisible] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showEdges, setShowEdges] = useState(false);
  const [flashNode, setFlashNode] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState(false);
  const [smoothTx, setSmoothTx] = useState(true);
  const [isPanning, setIsPanning] = useState(false);
  const [draggingCard, setDraggingCard] = useState<string | null>(null);

  const userInteracted = useRef(false);
  const panRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const isPanningRef = useRef(false);
  const dragRef = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const zoomRef = useRef(1);
  const posRef = useRef(positions);
  const wheelTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { posRef.current = positions; }, [positions]);

  const showNode = (id: string) => setVisibleNodes((p) => new Set([...p, id]));

  // Scroll chat panel only
  useEffect(() => {
    const el = chatPanelRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, thinkActive, typedAnswer]);

  // Wheel zoom
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!userInteracted.current) return; // allow page scroll until user clicks canvas
      // If zooming out past 50%, let page scroll instead
      if (e.deltaY > 0 && zoomRef.current <= 0.5) return;
      e.preventDefault();
      setSmoothTx(false);
      clearTimeout(wheelTimer.current);
      wheelTimer.current = setTimeout(() => setSmoothTx(true), 100);
      setZoom((z) => Math.min(2, Math.max(0.25, +(z * (e.deltaY > 0 ? 0.95 : 1.05)).toFixed(3))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      clearTimeout(wheelTimer.current);
    };
  }, []);

  // Unified pointer handlers: card drag vs canvas pan
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target;
    if (target instanceof HTMLElement && target.closest('[data-toolbar]')) return;

    // Check for card drag
    if (target instanceof HTMLElement) {
      const cardEl = target.closest('[data-card]');
      if (cardEl instanceof HTMLElement) {
        const id = cardEl.getAttribute('data-card') ?? '';
        const p = posRef.current[id];
        if (id && p) {
          dragRef.current = { id, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y };
          setDraggingCard(id);
          setSmoothTx(false);
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        }
      }
    }

    // Canvas pan
    userInteracted.current = true;
    isPanningRef.current = true;
    setIsPanning(true);
    setSmoothTx(false);
    panStartRef.current = { x: e.clientX, y: e.clientY, px: panRef.current.x, py: panRef.current.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      const d = dragRef.current;
      const z = zoomRef.current;
      const dx = (e.clientX - d.sx) / z;
      const dy = (e.clientY - d.sy) / z;
      setPositions((prev) => ({ ...prev, [d.id]: { x: d.ox + dx, y: d.oy + dy } }));
      return;
    }
    if (isPanningRef.current) {
      setPan({
        x: panStartRef.current.px + (e.clientX - panStartRef.current.x),
        y: panStartRef.current.py + (e.clientY - panStartRef.current.y),
      });
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    setDraggingCard(null);
    isPanningRef.current = false;
    setIsPanning(false);
    setSmoothTx(true);
  }, []);

  const zoomBtn = (delta: number) => {
    userInteracted.current = true;
    setSmoothTx(true);
    setZoom((z) => Math.min(2, Math.max(0.25, +(z + delta).toFixed(2))));
  };

  // ── Orchestrator ──
  useEffect(() => {
    if (!containerRef.current) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      const allMsgs: ChatMsg[] = [];
      let id = 0;
      for (const turn of TURNS) {
        allMsgs.push({ id: id++, role: 'user', text: turn.user });
        allMsgs.push({ id: id++, role: 'assistant', text: turn.answer, sources: turn.sources, responseMs: turn.responseMs });
      }
      setMessages(allMsgs);
      setVisibleNodes(new Set(Object.keys(INIT_POS)));
      setZoom(0.48);
      setShowEdges(true);
      return;
    }

    const c = cleanupRef.current;
    const sched = (fn: () => void, delay: number) => {
      c.timeouts.push(setTimeout(fn, delay));
    };

    // Type text into the input bar, then "send" it as a user message
    function typeInput(text: string, onSent: () => void) {
      setInputActive(true);
      setInputText('');
      let idx = 0;
      const iv = setInterval(() => {
        idx += 2;
        if (idx >= text.length) {
          clearInterval(iv);
          setInputText(text);
          // Brief pause then "send"
          c.timeouts.push(
            setTimeout(() => {
              setInputText('');
              setInputActive(false);
              setMessages((p) => [...p, { id: Date.now(), role: 'user', text }]);
              onSent();
            }, 250),
          );
          return;
        }
        setInputText(text.slice(0, idx));
      }, 18);
      c.intervals.push(iv);
    }

    function typeAnswer(text: string, sources: string[], responseMs: number, onDone: () => void) {
      setIsTyping(true);
      setTypedAnswer('');
      let idx = 0;
      const iv = setInterval(() => {
        idx += 3;
        if (idx >= text.length) {
          clearInterval(iv);
          setMessages((p) => [...p, { id: Date.now(), role: 'assistant', text, sources, responseMs }]);
          setIsTyping(false);
          setTypedAnswer('');
          onDone();
          return;
        }
        setTypedAnswer(text.slice(0, idx));
      }, 12);
      c.intervals.push(iv);
    }

    // Pan + zoom the camera to center on a point in canvas space
    function autoView(cx: number, cy: number, z: number) {
      if (userInteracted.current) return;
      setSmoothTx(true);
      setZoom(z);
      setPan({ x: (CX - cx) * z, y: (CY - cy) * z });
    }

    function run() {
      let t = 0;

      for (let ti = 0; ti < TURNS.length; ti++) {
        const turn = TURNS[ti];

        // Type into input bar → send → thinking → answer
        const inputDur = Math.ceil(turn.user.length / 2) * 18 + 250 + 100;
        sched(() => typeInput(turn.user, () => {}), t);
        t += inputDur;

        const steps = turn.thinking;
        sched(() => {
          setThinkActive(true);
          setThinkSteps(steps);
          setThinkStep(0);
        }, t);
        for (let s = 1; s < steps.length; s++) {
          t += 350;
          const si = s;
          sched(() => setThinkStep(si), t);
        }
        t += 350;

        const answer = turn.answer;
        const turnSources = turn.sources;
        const turnMs = turn.responseMs;
        sched(() => {
          setThinkActive(false);
          typeAnswer(answer, turnSources, turnMs, () => {});
        }, t);
        t += Math.ceil(answer.length / 3) * 12 + 400;

        // Canvas placement — camera follows cursor, zooms in on each card, pulls back after each turn
        if (ti === 0) {
          // Row 1: hub → market → competitors → swot → pull back
          sched(() => {
            setCursorVisible(true);
            setCursorPos(CURSOR_TARGETS.hub);
            autoView(630, 30, 0.9);
          }, t);
          t += 500;
          sched(() => showNode('hub'), t);
          t += 400;
          sched(() => {
            setCursorPos(CURSOR_TARGETS.market);
            autoView(145, 200, 0.85);
          }, t);
          t += 550;
          sched(() => showNode('market'), t);
          t += 400;
          sched(() => {
            setCursorPos(CURSOR_TARGETS.competitors);
            autoView(545, 200, 0.8);
          }, t);
          t += 550;
          sched(() => showNode('competitors'), t);
          t += 400;
          sched(() => {
            setCursorPos(CURSOR_TARGETS.swot);
            autoView(975, 200, 0.75);
          }, t);
          t += 550;
          sched(() => showNode('swot'), t);
          t += 400;
          sched(() => {
            setCursorVisible(false);
            autoView(550, 180, 0.6);
          }, t);
        } else if (ti === 1) {
          // Flash source → metrics → channels → risks → pull back
          sched(() => {
            setCursorVisible(true);
            setCursorPos(CURSOR_TARGETS.market);
            autoView(145, 200, 0.8);
          }, t);
          t += 350;
          sched(() => setFlashNode('market'), t);
          t += 400;
          sched(() => {
            setFlashNode(null);
            setCursorPos(CURSOR_TARGETS.metrics);
            autoView(130, 500, 0.8);
          }, t);
          t += 550;
          sched(() => showNode('metrics'), t);
          t += 400;
          sched(() => {
            setCursorPos(CURSOR_TARGETS.channels);
            autoView(520, 490, 0.75);
          }, t);
          t += 550;
          sched(() => showNode('channels'), t);
          t += 400;
          sched(() => {
            setCursorPos(CURSOR_TARGETS.risks);
            autoView(950, 500, 0.7);
          }, t);
          t += 550;
          sched(() => showNode('risks'), t);
          t += 400;
          sched(() => {
            setCursorVisible(false);
            autoView(550, 350, 0.42);
          }, t);
        } else if (ti === 2) {
          // Recommendations → roadmap → summary → edges → full zoom out
          sched(() => {
            setCursorVisible(true);
            setCursorPos(CURSOR_TARGETS.recommendations);
            autoView(235, 760, 0.65);
          }, t);
          t += 550;
          sched(() => showNode('recommendations'), t);
          t += 400;
          sched(() => {
            setCursorPos(CURSOR_TARGETS.roadmap);
            autoView(720, 750, 0.6);
          }, t);
          t += 550;
          sched(() => showNode('roadmap'), t);
          t += 400;
          sched(() => {
            setCursorPos(CURSOR_TARGETS.summary);
            autoView(570, 960, 0.55);
          }, t);
          t += 550;
          sched(() => showNode('summary'), t);
          t += 400;
          sched(() => setShowEdges(true), t);
          t += 300;
          sched(() => {
            setCursorVisible(false);
            autoView(CX, CY, 0.48);
          }, t);
        }

        t += 600;
        if (ti < TURNS.length - 1) t += 1200;
      }
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.15 });
      tl.from('.hero-headline', { y: 30, opacity: 0, duration: 0.7, ease: 'power3.out' });
      tl.from('.hero-subtitle', { y: 20, opacity: 0, duration: 0.5, ease: 'power2.out' }, '-=0.3');
      tl.from('.hero-ctas', { y: 15, opacity: 0, duration: 0.4 }, '-=0.2');
      tl.from('.hero-showcase', { y: 50, opacity: 0, scale: 0.97, duration: 0.8, ease: 'power3.out' }, '-=0.2');
    }, containerRef);

    // Only start the chat + canvas animation when the showcase scrolls into view
    const showcaseEl = showcaseRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !animStarted.current) {
          animStarted.current = true;
          setInView(true);
          run();
          observer.disconnect();
        }
      },
      { threshold: 0.8 },
    );
    if (showcaseEl) observer.observe(showcaseEl);

    return () => {
      observer.disconnect();
      c.timeouts.forEach(clearTimeout);
      c.intervals.forEach(clearInterval);
      ctx.revert();
    };
  }, []);

  const ct = alpha(theme.palette.kindle.codeBlockText, 1);
  const p = theme.palette;

  // ── Card style helper ──
  const cardSx = (color: string, vis: boolean, flash: boolean, nodeId: string) => ({
    position: 'absolute' as const,
    left: positions[nodeId]?.x ?? 0,
    top: positions[nodeId]?.y ?? 0,
    width: NODE_W[nodeId],
    p: nodeId === 'hub' ? 0.75 : 1.5,
    borderRadius: nodeId === 'hub' ? '17px' : '10px',
    bgcolor: alpha(color, isDark ? 0.1 : 0.06),
    border: `${flash ? 2 : 1.5}px solid ${alpha(color, flash ? 0.5 : isDark ? 0.25 : 0.18)}`,
    boxShadow: draggingCard === nodeId
      ? `0 8px 24px ${alpha(color, 0.25)}, 0 0 0 2px ${alpha(color, 0.3)}`
      : `3px 3px 0 ${alpha(color, isDark ? 0.1 : 0.07)}`,
    opacity: vis ? 1 : 0,
    transform: vis ? 'scale(1)' : 'scale(0.85)',
    transition: 'opacity 0.5s cubic-bezier(0.4,0,0.2,1), transform 0.5s cubic-bezier(0.4,0,0.2,1), border-color 0.3s, box-shadow 0.3s',
    cursor: vis ? (draggingCard === nodeId ? 'grabbing' : 'grab') : 'default',
    userSelect: 'none' as const,
    zIndex: draggingCard === nodeId ? 8 : 1,
    '&:hover': vis
      ? { boxShadow: `0 6px 20px ${alpha(color, 0.2)}, 0 0 0 1px ${alpha(color, 0.2)}` }
      : {},
  });

  const labelRow = (color: string, Icon: typeof Brain, text: string) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
      <Box
        sx={{
          width: 22,
          height: 22,
          borderRadius: '6px',
          bgcolor: alpha(color, isDark ? 0.15 : 0.1),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={12} color={alpha(color, isDark ? 0.85 : 0.75)} />
      </Box>
      <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: alpha(color, isDark ? 0.85 : 0.7) }}>
        {text}
      </Typography>
    </Box>
  );

  const riskColor = (level: string) =>
    level === 'High' ? p.error.main : level === 'Med' ? p.warning.main : p.success.main;

  const sourceIcon = (type: SourceType) => {
    switch (type) {
      case 'slack': return <SlackIcon size={14} />;
      case 'gdrive': return <GoogleDriveIcon size={14} />;
      case 'linear': return <LinearIcon size={14} />;
      default: return <FileText size={12} color={alpha(ct, 0.3)} />;
    }
  };

  const sourceRow = (nodeId: string) => {
    const srcs = CARD_SOURCES[nodeId];
    if (!srcs) return null;
    return (
      <Box sx={{ mt: 1.25, pt: 1, borderTop: '1px solid', borderColor: alpha(ct, 0.06), display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
        {srcs.map((s) => (
          <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {sourceIcon(s.type)}
            <Typography sx={{ fontSize: '0.75rem', color: alpha(ct, 0.5), lineHeight: 1 }}>{s.label}</Typography>
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Box
      ref={containerRef}
      sx={{
        bgcolor: 'background.default',
        pt: { xs: 10, md: 12 },
        pb: { xs: 10, md: 14 },
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: '35%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '140%',
          height: '80%',
          background: `radial-gradient(ellipse at center, ${alpha(p.primary.main, 0.03)} 0%, transparent 65%)`,
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ textAlign: 'center', maxWidth: 800, mx: 'auto' }}>
          <Typography
            className="hero-headline"
            variant="h1"
            sx={{
              fontSize: { xs: '2.5rem', sm: '3rem', md: '3.75rem' },
              fontWeight: 800,
              lineHeight: 1.1,
              mb: 3,
              letterSpacing: '-0.03em',
            }}
          >
            Every answer your
            <br />
            team{' '}
            <Box
              component="span"
              sx={{
                color: 'primary.main',
                position: 'relative',
                display: 'inline-block',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  left: '-4%',
                  bottom: 2,
                  width: '108%',
                  height: 6,
                  background: `linear-gradient(90deg, ${alpha(p.primary.main, 0.05)}, ${alpha(p.primary.main, 0.25)}, ${alpha(p.primary.main, 0.05)})`,
                  borderRadius: 3,
                },
              }}
            >
              needs
            </Box>
            . One place.
          </Typography>

          <Typography
            className="hero-subtitle"
            variant="h5"
            sx={{
              color: 'text.secondary',
              fontWeight: 400,
              mb: 4,
              fontSize: { xs: '1rem', md: '1.2rem' },
              lineHeight: 1.6,
              maxWidth: 580,
              mx: 'auto',
            }}
          >
            Not just another chatbot. Ask a question and get a full breakdown — analysis, comparisons, and next steps — laid out on an interactive canvas you can explore.
          </Typography>

          <Box
            className="hero-ctas"
            sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mb: { xs: 5, md: 6 } }}
          >
            <Link to="/auth/register" style={{ textDecoration: 'none' }}>
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowRight size={18} />}
                sx={{
                  px: 4,
                  py: 1.5,
                  fontSize: '1rem',
                  fontWeight: 700,
                  boxShadow: `0 4px 20px ${alpha(p.primary.main, 0.25)}`,
                  '&:hover': { boxShadow: `0 6px 28px ${alpha(p.primary.main, 0.35)}` },
                }}
              >
                Get Started Free
              </Button>
            </Link>
            <Link to="/auth/login" style={{ textDecoration: 'none' }}>
              <Button
                variant="outlined"
                size="large"
                sx={{
                  px: 4,
                  py: 1.5,
                  fontSize: '1rem',
                  borderColor: alpha(p.primary.main, 0.3),
                  '&:hover': { borderColor: 'primary.main', bgcolor: alpha(p.primary.main, 0.04) },
                }}
              >
                Login
              </Button>
            </Link>
          </Box>
        </Box>

        {/* ── Showcase ── */}
        <Box
          ref={showcaseRef}
          className="hero-showcase"
          sx={{
            maxWidth: { xs: 700, md: 1200 },
            mx: 'auto',
            borderRadius: 2.5,
            overflow: 'hidden',
            bgcolor: 'kindle.codeBlockBg',
            border: '1px solid',
            borderColor: alpha(ct, 0.1),
            transition: 'box-shadow 0.3s, transform 0.3s',
            boxShadow: isDark
              ? `0 25px 70px ${alpha(p.common.black, 0.55)}, 0 0 60px ${alpha(p.primary.main, 0.08)}`
              : `0 25px 70px ${alpha(p.common.black, 0.1)}, 0 0 60px ${alpha(p.primary.main, 0.06)}`,
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: isDark
                ? `0 30px 80px ${alpha(p.common.black, 0.6)}, 0 0 70px ${alpha(p.primary.main, 0.1)}`
                : `0 30px 80px ${alpha(p.common.black, 0.12)}, 0 0 70px ${alpha(p.primary.main, 0.08)}`,
            },
          }}
        >
          {/* Title bar */}
          <Box
            sx={{
              px: 2,
              py: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              borderBottom: '1px solid',
              borderColor: alpha(ct, 0.08),
            }}
          >
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              {['error', 'warning', 'success'].map((c) => (
                <Box key={c} sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: `${c}.main`, opacity: 0.6 }} />
              ))}
            </Box>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <Typography sx={{ color: alpha(ct, 0.45), fontSize: '0.72rem', fontWeight: 600 }}>Chat</Typography>
              <Box sx={{ width: '1px', height: 12, bgcolor: alpha(ct, 0.1) }} />
              <Typography sx={{ color: alpha(ct, 0.25), fontSize: '0.72rem', fontWeight: 500 }}>Canvas</Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'stretch' }}>
            {/* ── Chat Panel ── */}
            <Box
              ref={chatPanelRef}
              sx={{
                flex: { md: '1 1 38%' },
                p: { xs: 2, md: 2.5 },
                height: { md: 680 },
                overflowY: 'auto',
                overscrollBehavior: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                '&::-webkit-scrollbar': { width: 3 },
                '&::-webkit-scrollbar-thumb': { bgcolor: alpha(ct, 0.08), borderRadius: 2 },
              }}
            >
              {messages.map((msg) => (
                <Box key={msg.id} sx={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <Box sx={{ maxWidth: '85%' }}>
                    <Box
                      sx={{
                        px: 2,
                        py: 1.25,
                        borderRadius: 2,
                        ...(msg.role === 'user'
                          ? { bgcolor: 'primary.main', color: 'primary.contrastText', borderBottomRightRadius: 4 }
                          : {
                              bgcolor: alpha(ct, 0.06),
                              border: '1px solid',
                              borderColor: alpha(ct, 0.08),
                              borderBottomLeftRadius: 4,
                            }),
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: '0.82rem',
                          lineHeight: 1.6,
                          color: msg.role === 'user' ? 'inherit' : 'kindle.codeBlockText',
                        }}
                      >
                        {msg.text}
                      </Typography>
                    </Box>
                    {msg.role === 'assistant' && msg.sources && (
                      <Box sx={{ mt: 0.75, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, px: 0.5 }}>
                        {msg.sources.map((s) => {
                          const icon = s.startsWith('Google Drive') ? <GoogleDriveIcon size={11} />
                            : s.startsWith('Slack') ? <SlackIcon size={11} />
                            : s.startsWith('Linear') ? <LinearIcon size={11} />
                            : <FileText size={10} color={alpha(ct, 0.35)} />;
                          return (
                            <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                              {icon}
                              <Typography sx={{ fontSize: '0.65rem', color: alpha(ct, 0.4) }}>{s}</Typography>
                            </Box>
                          );
                        })}
                        {msg.responseMs && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, ml: 'auto' }}>
                            <Clock size={9} color={alpha(ct, 0.3)} />
                            <Typography sx={{ fontSize: '0.6rem', color: alpha(ct, 0.3) }}>
                              {(msg.responseMs / 1000).toFixed(1)}s
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    )}
                  </Box>
                </Box>
              ))}

              {thinkActive && (
                <Box sx={{ maxWidth: '90%' }}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.75,
                      mb: 0.5,
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 1.5,
                      bgcolor: alpha(p.primary.main, 0.08),
                      border: '1px solid',
                      borderColor: alpha(p.primary.main, 0.15),
                    }}
                  >
                    <Brain size={12} color={p.primary.main} />
                    <Typography sx={{ color: 'primary.main', fontSize: '0.7rem', fontWeight: 600 }}>
                      Thinking
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      ml: 1,
                      pl: 1.5,
                      borderLeft: '2px solid',
                      borderColor: alpha(p.primary.main, 0.15),
                    }}
                  >
                    {thinkSteps.slice(0, thinkStep + 1).map((step, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            color: i === thinkStep ? alpha(ct, 0.9) : alpha(ct, 0.4),
                            fontSize: '0.68rem',
                            fontWeight: i === thinkStep ? 600 : 400,
                            lineHeight: 1.7,
                          }}
                        >
                          {step}
                        </Typography>
                        {i === thinkStep && (
                          <Box sx={{ display: 'flex', gap: 0.3, ml: 0.25 }}>
                            {[0, 1, 2].map((d) => (
                              <Box
                                key={d}
                                sx={{
                                  width: 3,
                                  height: 3,
                                  borderRadius: '50%',
                                  bgcolor: 'primary.main',
                                  animation: `dotPulse 1.2s ease-in-out ${d * 0.2}s infinite`,
                                }}
                              />
                            ))}
                          </Box>
                        )}
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              {isTyping && typedAnswer && (
                <Box sx={{ maxWidth: '85%' }}>
                  <Box
                    sx={{
                      px: 2,
                      py: 1.25,
                      borderRadius: 2,
                      borderBottomLeftRadius: 4,
                      bgcolor: alpha(ct, 0.06),
                      border: '1px solid',
                      borderColor: alpha(ct, 0.08),
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ color: 'kindle.codeBlockText', fontSize: '0.82rem', lineHeight: 1.6 }}
                    >
                      {typedAnswer}
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-block',
                          width: 2,
                          height: '1em',
                          bgcolor: 'primary.main',
                          ml: 0.25,
                          verticalAlign: 'text-bottom',
                          animation: 'cursorBlink 0.8s step-end infinite',
                        }}
                      />
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>

            {/* ── Canvas Panel ── */}
            <Box
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              sx={{
                flex: { md: '1 1 62%' },
                position: 'relative',
                borderTop: { xs: '1px solid', md: 'none' },
                borderLeft: { xs: 'none', md: '1px solid' },
                borderColor: alpha(ct, 0.08),
                bgcolor: alpha(ct, 0.01),
                backgroundImage: `linear-gradient(${alpha(ct, 0.035)} 1px, transparent 1px), linear-gradient(90deg, ${alpha(ct, 0.035)} 1px, transparent 1px)`,
                backgroundSize: '24px 24px',
                minHeight: { xs: 380, md: 680 },
                overflow: 'hidden',
                cursor: draggingCard ? 'grabbing' : isPanning ? 'grabbing' : 'grab',
                touchAction: 'none',
              }}
            >
              {/* Transform container for pan/zoom */}
              <Box
                sx={{
                  position: 'absolute',
                  width: 1260,
                  height: 1060,
                  left: '50%',
                  top: '50%',
                  transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: smoothTx ? 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                  pointerEvents: 'none',
                }}
              >
                {/* SVG edges layer */}
                <Box
                  component="svg"
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    overflow: 'visible',
                  }}
                >
                  {EDGES.map(([from, to]) => {
                    const bothVisible = visibleNodes.has(from) && visibleNodes.has(to);
                    return (
                      <path
                        key={`${from}-${to}`}
                        d={edgePath(positions, from, to)}
                        fill="none"
                        stroke={alpha(ct, 0.18)}
                        strokeWidth={2}
                        strokeDasharray="8 5"
                        opacity={showEdges && bothVisible ? 1 : 0}
                        style={{ transition: 'opacity 0.6s ease' }}
                      />
                    );
                  })}
                  {/* Small dots at connection endpoints */}
                  {showEdges &&
                    EDGES.map(([from, to]) => {
                      if (!visibleNodes.has(from) || !visibleNodes.has(to)) return null;
                      const ep = edgeEndpoints(positions, from, to);
                      if (!ep) return null;
                      return (
                        <g key={`dots-${from}-${to}`}>
                          <circle cx={ep.x0} cy={ep.y0} r={3.5} fill={alpha(ct, 0.25)} />
                          <circle cx={ep.x1} cy={ep.y1} r={3.5} fill={alpha(ct, 0.25)} />
                        </g>
                      );
                    })}
                </Box>

                {/* AI Cursor */}
                {cursorVisible && cursorPos && (
                  <Box
                    sx={{
                      position: 'absolute',
                      left: cursorPos.x,
                      top: cursorPos.y,
                      transition: 'left 0.5s cubic-bezier(0.4,0,0.2,1), top 0.5s cubic-bezier(0.4,0,0.2,1)',
                      zIndex: 10,
                      pointerEvents: 'none',
                    }}
                  >
                    <Box
                      component="svg"
                      width={16}
                      height={20}
                      viewBox="0 0 16 20"
                      sx={{ display: 'block', filter: `drop-shadow(0 1px 2px ${alpha(p.common.black, 0.3)})` }}
                    >
                      <path
                        d="M1 1 L1 16 L5 12 L8 19 L10 18 L7 11 L13 10.5 Z"
                        fill={p.primary.main}
                        stroke={isDark ? p.common.white : p.common.black}
                        strokeWidth={0.6}
                        strokeOpacity={0.4}
                      />
                    </Box>
                    <Box
                      sx={{
                        display: 'inline-block',
                        px: 0.75,
                        py: 0.2,
                        bgcolor: 'primary.main',
                        borderRadius: '4px',
                        mt: -0.5,
                        ml: 1.5,
                      }}
                    >
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'primary.contrastText', lineHeight: 1.2 }}>
                        AI
                      </Typography>
                    </Box>
                  </Box>
                )}

                {/* ── Hub node ── */}
                <Box
                  data-card="hub"
                  sx={{
                    ...cardSx(p.primary.main, visibleNodes.has('hub'), false, 'hub'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    pointerEvents: visibleNodes.has('hub') ? 'auto' : 'none',
                  }}
                >
                  <Brain size={15} color={alpha(p.primary.main, 0.8)} />
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: alpha(ct, 0.85) }}>
                    Market Research Analysis
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.75, ml: 0.5 }}>
                    <SlackIcon size={14} />
                    <GoogleDriveIcon size={14} />
                    <LinearIcon size={14} />
                  </Box>
                </Box>

                {/* ── Market Size ── */}
                <Box
                  data-card="market"
                  sx={{
                    ...cardSx(p.info.main, visibleNodes.has('market'), flashNode === 'market', 'market'),
                    pointerEvents: visibleNodes.has('market') ? 'auto' : 'none',
                  }}
                >
                  {labelRow(p.info.main, BarChart3, 'Market Size')}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                    {MARKET_BARS.map((d) => (
                      <Box key={d.label}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
                          <Typography sx={{ fontSize: '0.72rem', color: alpha(ct, 0.55) }}>{d.label}</Typography>
                          <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: alpha(ct, 0.8) }}>
                            {d.value}
                          </Typography>
                        </Box>
                        <Box sx={{ height: 7, bgcolor: alpha(ct, 0.06), borderRadius: 1, overflow: 'hidden' }}>
                          <Box
                            sx={{
                              height: '100%',
                              width: `${d.pct}%`,
                              bgcolor: alpha(p.info.main, 0.45),
                              borderRadius: 1,
                            }}
                          />
                        </Box>
                      </Box>
                    ))}
                  </Box>
                  {sourceRow('market')}
                </Box>

                {/* ── Competitive Landscape ── */}
                <Box
                  data-card="competitors"
                  sx={{
                    ...cardSx(p.warning.main, visibleNodes.has('competitors'), false, 'competitors'),
                    pointerEvents: visibleNodes.has('competitors') ? 'auto' : 'none',
                  }}
                >
                  {labelRow(p.warning.main, Target, 'Competitive Landscape')}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                    {COMPETITORS.map((c) => (
                      <Box
                        key={c.name}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          py: 0.25,
                          borderBottom: '1px solid',
                          borderColor: alpha(ct, 0.05),
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Typography
                            sx={{
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              color: c.name === 'You' ? alpha(p.primary.main, 0.9) : alpha(ct, 0.4),
                              minWidth: 18,
                            }}
                          >
                            {c.pos}
                          </Typography>
                          <Typography
                            sx={{
                              fontSize: '0.75rem',
                              fontWeight: c.name === 'You' ? 700 : 400,
                              color: c.name === 'You' ? alpha(ct, 0.9) : alpha(ct, 0.6),
                            }}
                          >
                            {c.name}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            px: 0.75,
                            py: 0.15,
                            borderRadius: '3px',
                            bgcolor: alpha(c.name === 'You' ? p.primary.main : p.warning.main, 0.12),
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              color: alpha(c.name === 'You' ? p.primary.main : p.warning.main, 0.8),
                            }}
                          >
                            {c.score}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                  {sourceRow('competitors')}
                </Box>

                {/* ── SWOT Analysis ── */}
                <Box
                  data-card="swot"
                  sx={{
                    ...cardSx(p.secondary.main, visibleNodes.has('swot'), false, 'swot'),
                    pointerEvents: visibleNodes.has('swot') ? 'auto' : 'none',
                  }}
                >
                  {labelRow(p.secondary.main, Shield, 'SWOT Analysis')}
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
                    {(
                      [
                        { key: 'S', items: SWOT.s, color: p.success.main },
                        { key: 'W', items: SWOT.w, color: p.error.main },
                        { key: 'O', items: SWOT.o, color: p.info.main },
                        { key: 'T', items: SWOT.t, color: p.warning.main },
                      ] satisfies Array<{ key: string; items: string[]; color: string }>
                    ).map((q) => (
                      <Box
                        key={q.key}
                        sx={{
                          p: 0.6,
                          borderRadius: '4px',
                          bgcolor: alpha(q.color, isDark ? 0.06 : 0.04),
                          border: `1px solid ${alpha(q.color, 0.1)}`,
                        }}
                      >
                        <Typography
                          sx={{ fontSize: '0.75rem', fontWeight: 700, color: alpha(q.color, 0.75), mb: 0.25 }}
                        >
                          {q.key}
                        </Typography>
                        {q.items.map((item) => (
                          <Typography key={item} sx={{ fontSize: '0.78rem', color: alpha(ct, 0.6), lineHeight: 1.5 }}>
                            {item}
                          </Typography>
                        ))}
                      </Box>
                    ))}
                  </Box>
                  {sourceRow('swot')}
                </Box>

                {/* ── Key Metrics ── */}
                <Box
                  data-card="metrics"
                  sx={{
                    ...cardSx(p.success.main, visibleNodes.has('metrics'), false, 'metrics'),
                    pointerEvents: visibleNodes.has('metrics') ? 'auto' : 'none',
                  }}
                >
                  {labelRow(p.success.main, TrendingUp, 'Key Metrics')}
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    {METRICS_DATA.map((m) => (
                      <Box key={m.label} sx={{ textAlign: 'center', flex: 1 }}>
                        <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: alpha(ct, 0.9) }}>
                          {m.value}
                        </Typography>
                        <Typography sx={{ fontSize: '0.78rem', color: alpha(ct, 0.45), mb: 0.15 }}>
                          {m.label}
                        </Typography>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: alpha(p.success.main, 0.8) }}>
                          {m.delta}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                  {sourceRow('metrics')}
                </Box>

                {/* ── Growth Channels (flow diagram) ── */}
                <Box
                  data-card="channels"
                  sx={{
                    ...cardSx(p.info.main, visibleNodes.has('channels'), false, 'channels'),
                    pointerEvents: visibleNodes.has('channels') ? 'auto' : 'none',
                  }}
                >
                  {labelRow(p.info.main, Zap, 'Growth Channels')}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                    {CHANNEL_FLOW.map((step, i) => (
                      <Box key={step} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box
                          sx={{
                            px: 1,
                            py: 0.4,
                            borderRadius: '5px',
                            bgcolor: alpha(p.info.main, 0.08 + i * 0.05),
                            border: `1px solid ${alpha(p.info.main, 0.15 + i * 0.05)}`,
                          }}
                        >
                          <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: alpha(p.info.main, 0.85) }}>
                            {step}
                          </Typography>
                        </Box>
                        {i < CHANNEL_FLOW.length - 1 && (
                          <ChevronRight size={10} color={alpha(ct, 0.25)} />
                        )}
                      </Box>
                    ))}
                  </Box>
                  <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ height: 4, flex: 1, borderRadius: 2, bgcolor: alpha(p.info.main, 0.12) }}>
                      <Box sx={{ height: '100%', width: '45%', borderRadius: 2, bgcolor: alpha(p.info.main, 0.5) }} />
                    </Box>
                    <Typography sx={{ fontSize: '0.75rem', color: alpha(ct, 0.5), fontWeight: 600 }}>
                      45% of ARR
                    </Typography>
                  </Box>
                  {sourceRow('channels')}
                </Box>

                {/* ── Risk Assessment ── */}
                <Box
                  data-card="risks"
                  sx={{
                    ...cardSx(p.error.main, visibleNodes.has('risks'), false, 'risks'),
                    pointerEvents: visibleNodes.has('risks') ? 'auto' : 'none',
                  }}
                >
                  {labelRow(p.error.main, AlertTriangle, 'Risk Assessment')}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                    {RISKS.map((r) => (
                      <Box key={r.text} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography sx={{ fontSize: '0.72rem', color: alpha(ct, 0.65) }}>{r.text}</Typography>
                        <Box
                          sx={{
                            px: 0.6,
                            py: 0.15,
                            borderRadius: '3px',
                            bgcolor: alpha(riskColor(r.level), 0.12),
                          }}
                        >
                          <Typography
                            sx={{ fontSize: '0.75rem', fontWeight: 700, color: alpha(riskColor(r.level), 0.85) }}
                          >
                            {r.level}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                  {sourceRow('risks')}
                </Box>

                {/* ── Strategic Recommendations ── */}
                <Box
                  data-card="recommendations"
                  sx={{
                    ...cardSx(p.primary.main, visibleNodes.has('recommendations'), false, 'recommendations'),
                    pointerEvents: visibleNodes.has('recommendations') ? 'auto' : 'none',
                  }}
                >
                  {labelRow(p.primary.main, Lightbulb, 'Strategic Priorities')}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {PRIORITIES.map((pr, i) => (
                      <Box key={pr.text} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Box
                          sx={{
                            minWidth: 16,
                            height: 16,
                            borderRadius: '50%',
                            bgcolor: alpha(p.primary.main, 0.15),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: alpha(p.primary.main, 0.8) }}>
                            {i + 1}
                          </Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontSize: '0.72rem', color: alpha(ct, 0.7), lineHeight: 1.3 }}>
                            {pr.text}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
                            <Box sx={{ height: 3, flex: 1, bgcolor: alpha(ct, 0.06), borderRadius: 1 }}>
                              <Box
                                sx={{
                                  height: '100%',
                                  width: `${pr.confidence}%`,
                                  bgcolor: alpha(p.primary.main, 0.4),
                                  borderRadius: 1,
                                }}
                              />
                            </Box>
                            <Typography
                              sx={{ fontSize: '0.45rem', fontWeight: 600, color: alpha(p.primary.main, 0.6) }}
                            >
                              {pr.confidence}%
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                  {sourceRow('recommendations')}
                </Box>

                {/* ── 90-Day Roadmap ── */}
                <Box
                  data-card="roadmap"
                  sx={{
                    ...cardSx(p.success.main, visibleNodes.has('roadmap'), false, 'roadmap'),
                    pointerEvents: visibleNodes.has('roadmap') ? 'auto' : 'none',
                  }}
                >
                  {labelRow(p.success.main, Rocket, '90-Day Roadmap')}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, position: 'relative' }}>
                    {/* Timeline line */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 8,
                        left: 16,
                        right: 16,
                        height: 2,
                        bgcolor: alpha(p.success.main, 0.15),
                        borderRadius: 1,
                      }}
                    />
                    {ROADMAP_ITEMS.map((item, i) => (
                      <Box key={item.q} sx={{ flex: 1, textAlign: 'center', position: 'relative', zIndex: 1 }}>
                        <Box
                          sx={{
                            width: 14,
                            height: 14,
                            borderRadius: '50%',
                            bgcolor: alpha(p.success.main, 0.2 + i * 0.12),
                            border: `1.5px solid ${alpha(p.success.main, 0.4)}`,
                            mx: 'auto',
                            mb: 0.4,
                          }}
                        />
                        <Typography
                          sx={{ fontSize: '0.78rem', fontWeight: 700, color: alpha(p.success.main, 0.75), mb: 0.15 }}
                        >
                          {item.q}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: alpha(ct, 0.55), lineHeight: 1.3 }}>
                          {item.text}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                  {sourceRow('roadmap')}
                </Box>

                {/* ── Executive Summary ── */}
                <Box
                  data-card="summary"
                  sx={{
                    ...cardSx(p.primary.main, visibleNodes.has('summary'), false, 'summary'),
                    pointerEvents: visibleNodes.has('summary') ? 'auto' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '8px',
                      bgcolor: alpha(p.primary.main, isDark ? 0.15 : 0.1),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Brain size={15} color={alpha(p.primary.main, 0.85)} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: alpha(ct, 0.85), mb: 0.25 }}>
                      Executive Summary
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                      {SUMMARY_STATS.map((s) => (
                        <Box key={s.label} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.4 }}>
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: alpha(p.primary.main, 0.85) }}>
                            {s.value}
                          </Typography>
                          <Typography sx={{ fontSize: '0.45rem', color: alpha(ct, 0.45) }}>
                            {s.label}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Box>
              </Box>

              {/* Toolbar */}
              <Box
                data-toolbar
                sx={{
                  position: 'absolute',
                  bottom: 10,
                  right: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.25,
                  bgcolor: alpha(isDark ? p.common.black : p.common.white, 0.6),
                  backdropFilter: 'blur(8px)',
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: alpha(ct, 0.1),
                  px: 0.5,
                  py: 0.25,
                  zIndex: 5,
                }}
              >
                <IconButton size="small" sx={{ p: 0.4 }} onClick={() => zoomBtn(-0.1)}>
                  <Minus size={12} color={alpha(ct, 0.5)} />
                </IconButton>
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    color: alpha(ct, 0.5),
                    minWidth: 30,
                    textAlign: 'center',
                    fontWeight: 600,
                    userSelect: 'none',
                  }}
                >
                  {Math.round(zoom * 100)}%
                </Typography>
                <IconButton
                  size="small"
                  sx={{
                    p: 0.4,
                    position: 'relative',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      inset: -2,
                      borderRadius: '50%',
                      border: '1.5px solid',
                      borderColor: alpha(p.primary.main, 0.4),
                      animation: inView ? 'plusPulse 2s ease-in-out infinite' : 'none',
                      opacity: inView ? undefined : 0,
                    },
                    '@keyframes plusPulse': {
                      '0%, 100%': { opacity: 0, transform: 'scale(0.8)' },
                      '50%': { opacity: 1, transform: 'scale(1.2)' },
                    },
                  }}
                  onClick={() => zoomBtn(0.1)}
                >
                  <Plus size={12} color={alpha(p.primary.main, 0.7)} />
                </IconButton>
                <Box sx={{ width: '1px', height: 14, bgcolor: alpha(ct, 0.1), mx: 0.25 }} />
                <Box sx={{ position: 'relative' }}>
                  <IconButton
                    size="small"
                    sx={{ p: 0.4 }}
                    onClick={() => {
                      setShareToast(true);
                      setTimeout(() => setShareToast(false), 1500);
                    }}
                  >
                    <Share2 size={12} color={alpha(ct, 0.5)} />
                  </IconButton>
                  {shareToast && (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        px: 1,
                        py: 0.3,
                        bgcolor: 'text.primary',
                        color: 'background.default',
                        borderRadius: 1,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        mb: 0.5,
                      }}
                    >
                      Link copied!
                    </Box>
                  )}
                </Box>
              </Box>

              {/* Node count badge */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 10,
                  right: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 1,
                  py: 0.4,
                  bgcolor: alpha(isDark ? p.common.black : p.common.white, 0.5),
                  backdropFilter: 'blur(6px)',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: alpha(ct, 0.08),
                  zIndex: 5,
                  opacity: visibleNodes.size > 0 ? 1 : 0,
                  transition: 'opacity 0.3s',
                }}
              >
                <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: alpha(p.success.main, 0.7) }} />
                <Typography sx={{ fontSize: '0.7rem', color: alpha(ct, 0.45), fontWeight: 600 }}>
                  {visibleNodes.size} nodes
                  {showEdges ? ` \u00B7 ${EDGES.length} connections` : ''}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Input bar */}
          <Box sx={{ px: { xs: 2, md: 3 }, pb: 2, pt: 1, borderTop: '1px solid', borderColor: alpha(ct, 0.06) }}>
            <Box
              sx={{
                px: 2,
                py: 1,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: inputActive ? alpha(p.primary.main, 0.3) : alpha(ct, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'border-color 0.2s',
              }}
            >
              {inputText ? (
                <Typography sx={{ color: 'kindle.codeBlockText', fontSize: '0.82rem' }}>
                  {inputText}
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-block',
                      width: 2,
                      height: '1em',
                      bgcolor: 'primary.main',
                      ml: 0.25,
                      verticalAlign: 'text-bottom',
                      animation: 'cursorBlink 0.8s step-end infinite',
                    }}
                  />
                </Typography>
              ) : (
                <Typography sx={{ color: alpha(ct, 0.25), fontSize: '0.82rem' }}>
                  Ask anything about your documents...
                </Typography>
              )}
              <Send size={14} color={inputText ? p.primary.main : alpha(ct, 0.15)} />
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
