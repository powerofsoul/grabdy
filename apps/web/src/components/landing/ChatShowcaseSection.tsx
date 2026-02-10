import { useEffect, useRef, useState } from 'react';

import { alpha, Box, Chip, Container, Typography, useTheme } from '@mui/material';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Brain,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Circle,
  FileText,
  Send,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

// ─── Shared Components ──────────────────────────────────────────

function ThinkingBlock({ steps, defaultOpen = false }: { steps: string[]; defaultOpen?: boolean }) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Box sx={{ mb: 1.5 }}>
      <Box
        onClick={() => setOpen((v) => !v)}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          cursor: 'pointer',
          mb: open ? 0.75 : 0,
          px: 1.5,
          py: 0.5,
          borderRadius: 1.5,
          bgcolor: alpha(theme.palette.primary.main, 0.06),
          border: '1px solid',
          borderColor: alpha(theme.palette.primary.main, 0.12),
          transition: 'background-color 0.2s',
          '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) },
        }}
      >
        <Brain size={13} color={theme.palette.primary.main} />
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main', fontSize: '0.72rem' }}>
          Thinking
        </Typography>
        {open ? (
          <ChevronDown size={13} color={theme.palette.primary.main} />
        ) : (
          <ChevronRight size={13} color={theme.palette.primary.main} />
        )}
      </Box>
      {open && (
        <Box sx={{ ml: 1, pl: 1.5, borderLeft: '2px solid', borderColor: alpha(theme.palette.primary.main, 0.15) }}>
          {steps.map((step, i) => (
            <Typography key={i} variant="caption" sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.7, fontSize: '0.72rem' }}>
              {step}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}

function SourcesBar({ sources }: { sources: Array<{ name: string; score: number }> }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        px: 2,
        py: 1,
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: alpha(theme.palette.primary.main, 0.03),
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 0.75,
      }}
    >
      <Sparkles size={11} color={theme.palette.text.secondary} />
      {sources.map((src) => (
        <Chip
          key={src.name}
          icon={<FileText size={10} />}
          label={`${src.name} · ${src.score}`}
          size="small"
          variant="outlined"
          sx={{ height: 20, fontSize: '0.65rem', fontFamily: 'monospace', '& .MuiChip-icon': { ml: 0.5 } }}
        />
      ))}
    </Box>
  );
}

function UserMessage({ text }: { text: string }) {
  return (
    <Box sx={{ alignSelf: 'flex-end', maxWidth: '80%' }}>
      <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', px: 2, py: 1.25, borderRadius: 2, borderBottomRightRadius: 4 }}>
        <Typography variant="body2" sx={{ fontSize: '0.85rem', lineHeight: 1.6 }}>{text}</Typography>
      </Box>
    </Box>
  );
}

function ResponseCard({ children, sources }: { children: React.ReactNode; sources: Array<{ name: string; score: number }> }) {
  return (
    <Box
      sx={{
        bgcolor: 'background.default',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 2, py: 1.5 }}>{children}</Box>
      <SourcesBar sources={sources} />
    </Box>
  );
}

// ─── Exchange 1: Revenue Area Chart ─────────────────────────────

const REVENUE_DATA = [
  { month: 'Jul', value: 42 },
  { month: 'Aug', value: 48 },
  { month: 'Sep', value: 45 },
  { month: 'Oct', value: 61 },
  { month: 'Nov', value: 58 },
  { month: 'Dec', value: 74 },
];

function RevenueChart({ animate }: { animate: boolean }) {
  const theme = useTheme();
  const pathRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const dotsRef = useRef<SVGGElement>(null);
  const metricsRef = useRef<HTMLDivElement>(null);

  const W = 380;
  const H = 130;
  const padX = 30;
  const padY = 15;
  const maxVal = 80;

  const toX = (i: number) => padX + (i / (REVENUE_DATA.length - 1)) * (W - padX * 2);
  const toY = (v: number) => H - padY - ((v / maxVal) * (H - padY * 2));

  const linePoints = REVENUE_DATA.map((d, i) => `${toX(i)},${toY(d.value)}`).join(' ');
  const linePath = `M ${linePoints}`;
  const areaPath = `M ${padX},${H - padY} L ${linePoints} L ${toX(REVENUE_DATA.length - 1)},${H - padY} Z`;

  useEffect(() => {
    if (!animate || !pathRef.current || !areaRef.current || !dotsRef.current || !metricsRef.current) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const pathEl = pathRef.current;
    const length = pathEl.getTotalLength();

    gsap.set(pathEl, { strokeDasharray: length, strokeDashoffset: length });
    gsap.set(areaRef.current, { opacity: 0 });
    gsap.set(dotsRef.current.children, { scale: 0, transformOrigin: 'center' });
    gsap.set(metricsRef.current.children, { opacity: 0, y: 10 });

    const tl = gsap.timeline({ delay: 0.3 });
    tl.to(pathEl, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut' });
    tl.to(areaRef.current, { opacity: 1, duration: 0.6 }, '-=0.6');
    tl.to(dotsRef.current.children, { scale: 1, duration: 0.3, stagger: 0.08, ease: 'back.out(2)' }, '-=0.4');
    tl.to(metricsRef.current.children, { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 }, '-=0.3');
  }, [animate]);

  const gridColor = alpha(theme.palette.text.secondary, 0.1);
  const lineColor = theme.palette.primary.main;
  const fillColor = alpha(theme.palette.primary.main, 0.12);

  return (
    <Box>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={padX} x2={W - padX} y1={padY + f * (H - padY * 2)} y2={padY + f * (H - padY * 2)} stroke={gridColor} strokeWidth="0.5" />
        ))}
        {/* X axis labels */}
        {REVENUE_DATA.map((d, i) => (
          <text key={d.month} x={toX(i)} y={H - 2} textAnchor="middle" fill={theme.palette.text.secondary} fontSize="9" fontFamily="Inter, sans-serif">
            {d.month}
          </text>
        ))}
        {/* Area fill */}
        <path ref={areaRef} d={areaPath} fill={fillColor} />
        {/* Line */}
        <path ref={pathRef} d={linePath} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Data points */}
        <g ref={dotsRef}>
          {REVENUE_DATA.map((d, i) => (
            <circle key={i} cx={toX(i)} cy={toY(d.value)} r="4" fill={theme.palette.background.paper} stroke={lineColor} strokeWidth="2" />
          ))}
        </g>
      </svg>

      {/* Metrics row */}
      <Box ref={metricsRef} sx={{ display: 'flex', gap: 2, mt: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <TrendingUp size={13} color={theme.palette.success.main} />
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'success.main', fontSize: '0.74rem' }}>
            +76% growth
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
          $328K total
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
          Best: Dec ($74K)
        </Typography>
      </Box>
    </Box>
  );
}

function ChartExchange({ animate }: { animate: boolean }) {
  return (
    <>
      <UserMessage text="Show me revenue trends for the last 6 months" />
      <Box sx={{ alignSelf: 'flex-start', maxWidth: '95%' }}>
        <ThinkingBlock
          defaultOpen
          steps={[
            'Searching financial reports collection...',
            'Found monthly revenue data in sales-report-h2.csv',
            'Calculating growth rate and identifying trends...',
            'Generating area chart with key metrics',
          ]}
        />
        <ResponseCard sources={[{ name: 'sales-report-h2.csv', score: 0.97 }, { name: 'q4-summary.pdf', score: 0.89 }]}>
          <Typography variant="body2" sx={{ lineHeight: 1.6, mb: 1.5, fontSize: '0.85rem' }}>
            Revenue grew 76% over the last 6 months, with a strong acceleration in Q4:
          </Typography>
          <RevenueChart animate={animate} />
        </ResponseCard>
      </Box>
    </>
  );
}

// ─── Exchange 2: Product Performance Dashboard ──────────────────

const PRODUCTS = [
  { name: 'Pro Plan', revenue: '$48.2K', growth: '+24%', satisfaction: 92, churn: 2.1, trend: 'up' },
  { name: 'Starter Plan', revenue: '$31.7K', growth: '+8%', satisfaction: 87, churn: 4.3, trend: 'up' },
  { name: 'Enterprise', revenue: '$96.5K', growth: '+41%', satisfaction: 95, churn: 0.8, trend: 'up' },
];

function ProgressRing({ value, size = 40, strokeWidth = 3.5 }: { value: number; size?: number; strokeWidth?: number }) {
  const theme = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);

  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={alpha(theme.palette.primary.main, 0.1)} strokeWidth={strokeWidth} />
        <circle
          className="ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={theme.palette.primary.main}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: 'text.primary' }}>
          {value}%
        </Typography>
      </Box>
    </Box>
  );
}

function DashboardExchange({ animate }: { animate: boolean }) {
  const theme = useTheme();
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!animate || !cardsRef.current) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const cards = cardsRef.current.querySelectorAll('.product-card');
    gsap.set(cards, { opacity: 0, y: 15, scale: 0.96 });
    gsap.to(cards, { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.12, ease: 'power2.out', delay: 0.3 });
  }, [animate]);

  return (
    <>
      <UserMessage text="How are our plans performing this quarter?" />
      <Box sx={{ alignSelf: 'flex-start', maxWidth: '95%' }}>
        <ThinkingBlock
          steps={[
            'Querying product analytics and billing data...',
            'Cross-referencing with customer satisfaction surveys...',
            'Calculating churn rates per plan tier...',
            'Building performance dashboard cards',
          ]}
        />
        <ResponseCard sources={[{ name: 'analytics-q4.csv', score: 0.96 }, { name: 'nps-survey.pdf', score: 0.91 }, { name: 'churn-report.xlsx', score: 0.87 }]}>
          <Typography variant="body2" sx={{ lineHeight: 1.6, mb: 1.5, fontSize: '0.85rem' }}>
            Here&apos;s a breakdown of each plan&apos;s performance:
          </Typography>
          <Box ref={cardsRef} sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {PRODUCTS.map((p) => (
              <Box
                key={p.name}
                className="product-card"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  p: 1.5,
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                }}
              >
                <ProgressRing value={p.satisfaction} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.82rem' }}>
                      {p.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600, fontSize: '0.7rem' }}>
                      {p.growth}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      Revenue: <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>{p.revenue}</Box>
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      Churn: <Box component="span" sx={{ fontWeight: 600, color: p.churn < 2 ? 'success.main' : p.churn < 4 ? 'warning.main' : 'error.main' }}>{p.churn}%</Box>
                    </Typography>
                  </Box>
                </Box>
                <TrendingUp size={16} color={theme.palette.success.main} />
              </Box>
            ))}
          </Box>
          <Box
            sx={{
              mt: 1.5,
              p: 1.25,
              borderRadius: 1.5,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.1),
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.25, fontSize: '0.74rem' }}>
              Insight
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5, fontSize: '0.72rem' }}>
              Enterprise has the highest satisfaction (95%) and lowest churn (0.8%). Consider upselling Pro customers — their churn is 2x higher at similar satisfaction levels.
            </Typography>
          </Box>
        </ResponseCard>
      </Box>
    </>
  );
}

// ─── Exchange 3: Process Flow ───────────────────────────────────

const ONBOARDING_STEPS = [
  { label: 'Upload docs', desc: 'PDF, CSV, DOCX, TXT, JSON', status: 'done' },
  { label: 'Processing', desc: 'Parse → Chunk → Embed → Index', status: 'done' },
  { label: 'Configure', desc: 'Set collections, API keys, access', status: 'done' },
  { label: 'Go live', desc: 'Query via API or embed chat widget', status: 'active' },
];

function ProcessFlow({ animate }: { animate: boolean }) {
  const theme = useTheme();
  const stepsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!animate || !stepsRef.current) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const steps = stepsRef.current.querySelectorAll('.flow-step');
    const connectors = stepsRef.current.querySelectorAll('.flow-connector');
    gsap.set(steps, { opacity: 0, y: 12 });
    gsap.set(connectors, { scaleX: 0, transformOrigin: 'left center' });

    const tl = gsap.timeline({ delay: 0.3 });
    for (let i = 0; i < steps.length; i++) {
      tl.to(steps[i], { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
      if (i < connectors.length) {
        tl.to(connectors[i], { scaleX: 1, duration: 0.25, ease: 'power2.out' }, '-=0.1');
      }
    }
  }, [animate]);

  return (
    <Box ref={stepsRef} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflow: 'auto' }}>
      {ONBOARDING_STEPS.map((step, i) => (
        <Box key={step.label} sx={{ display: 'flex', alignItems: 'flex-start' }}>
          <Box
            className="flow-step"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: { xs: 100, md: 120 },
              textAlign: 'center',
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 0.75,
                bgcolor: step.status === 'done'
                  ? alpha(theme.palette.success.main, 0.12)
                  : alpha(theme.palette.primary.main, 0.12),
                color: step.status === 'done' ? 'success.main' : 'primary.main',
                border: '2px solid',
                borderColor: step.status === 'done' ? 'success.main' : 'primary.main',
              }}
            >
              {step.status === 'done' ? <CheckCircle size={16} /> : <Circle size={16} />}
            </Box>
            <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.72rem', lineHeight: 1.2, mb: 0.25 }}>
              {step.label}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.62rem', lineHeight: 1.3 }}>
              {step.desc}
            </Typography>
          </Box>
          {i < ONBOARDING_STEPS.length - 1 && (
            <Box
              className="flow-connector"
              sx={{
                width: { xs: 16, md: 24 },
                height: 2,
                bgcolor: step.status === 'done' ? 'success.main' : 'divider',
                mt: 1.9,
                flexShrink: 0,
                borderRadius: 1,
              }}
            />
          )}
        </Box>
      ))}
    </Box>
  );
}

function ProcessExchange({ animate }: { animate: boolean }) {
  return (
    <>
      <UserMessage text="What's the integration process for new customers?" />
      <Box sx={{ alignSelf: 'flex-start', maxWidth: '95%' }}>
        <ThinkingBlock
          steps={[
            'Searching onboarding and integration docs...',
            'Found 4-step process in quickstart-guide.md',
            'Mapping steps to current completion status...',
            'Generating visual workflow',
          ]}
        />
        <ResponseCard sources={[{ name: 'quickstart-guide.md', score: 0.94 }, { name: 'integration-docs.pdf', score: 0.88 }]}>
          <Typography variant="body2" sx={{ lineHeight: 1.6, mb: 2, fontSize: '0.85rem' }}>
            The integration process has 4 stages. Most customers go live within an afternoon:
          </Typography>
          <ProcessFlow animate={animate} />
        </ResponseCard>
      </Box>
    </>
  );
}

// ─── Main Section ───────────────────────────────────────────────

export function ChatShowcaseSection() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!prefersReducedMotion) {
        const tl = gsap.timeline({
          scrollTrigger: { trigger: sectionRef.current, start: 'top 75%' },
        });
        tl.from('.chat-showcase-title', { y: 30, opacity: 0, duration: 0.6 });
        tl.from('.chat-showcase-subtitle', { y: 20, opacity: 0, duration: 0.4 }, '-=0.3');
        tl.from('.chat-showcase-panel', { y: 40, opacity: 0, duration: 0.7, ease: 'power2.out' }, '-=0.2');
      }

      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top 60%',
        onEnter: () => setIsVisible(true),
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <Box ref={sectionRef} id="chat-showcase" sx={{ py: { xs: 8, md: 12 }, bgcolor: 'kindle.parchment' }}>
      <Container maxWidth="lg">
        <Typography
          className="chat-showcase-title"
          variant="h2"
          sx={{ textAlign: 'center', mb: 2, fontWeight: 800, fontSize: { xs: '2rem', md: '2.5rem' }, letterSpacing: '-0.02em' }}
        >
          Your AI chat.{' '}
          <Box component="span" sx={{ color: 'primary.main' }}>Their answers.</Box>
        </Typography>
        <Typography
          className="chat-showcase-subtitle"
          variant="body1"
          color="text.secondary"
          sx={{ textAlign: 'center', mb: 6, maxWidth: 620, mx: 'auto' }}
        >
          Embed our chat widget in your product. Your users ask questions,
          the AI searches your documents and renders rich answers — charts, dashboards, and workflows.
          Every answer cites its sources.
        </Typography>

        <Box
          className="chat-showcase-panel"
          sx={{
            maxWidth: 700,
            mx: 'auto',
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            bgcolor: 'background.paper',
            transition: 'box-shadow 0.3s, transform 0.3s',
            boxShadow: isDark
              ? `0 25px 70px ${alpha(theme.palette.common.black, 0.5)}, 0 0 60px ${alpha(theme.palette.primary.main, 0.06)}`
              : `0 25px 70px ${alpha(theme.palette.common.black, 0.08)}, 0 0 60px ${alpha(theme.palette.primary.main, 0.04)}`,
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: isDark
                ? `0 30px 80px ${alpha(theme.palette.common.black, 0.55)}, 0 0 70px ${alpha(theme.palette.primary.main, 0.08)}`
                : `0 30px 80px ${alpha(theme.palette.common.black, 0.1)}, 0 0 70px ${alpha(theme.palette.primary.main, 0.06)}`,
            },
          }}
        >
          {/* Header — macOS-style window chrome */}
          <Box
            sx={{
              px: 2,
              py: 1,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              {['error', 'warning', 'success'].map((color) => (
                <Box
                  key={color}
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: `${color}.main`,
                    opacity: 0.6,
                  }}
                />
              ))}
            </Box>
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.75,
              }}
            >
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: 'success.main',
                  boxShadow: `0 0 6px ${alpha(theme.palette.success.main, 0.5)}`,
                  animation: 'dotPulse 2s ease-in-out infinite',
                }}
              />
              <Typography
                sx={{
                  color: alpha(theme.palette.text.secondary, 0.6),
                  fontSize: '0.72rem',
                  fontWeight: 500,
                }}
              >
                grabdy chat — embedded in your product
              </Typography>
            </Box>
          </Box>

          {/* Chat conversation */}
          <Box
            sx={{
              p: { xs: 2, md: 2.5 },
              display: 'flex',
              flexDirection: 'column',
              gap: 3.5,
              maxHeight: { xs: 600, md: 760 },
              overflow: 'auto',
              '&::-webkit-scrollbar': { width: 6 },
              '&::-webkit-scrollbar-track': { background: 'transparent' },
              '&::-webkit-scrollbar-thumb': { borderRadius: 3, bgcolor: 'divider' },
            }}
          >
            <ChartExchange animate={isVisible} />
            <Box sx={{ height: 1, bgcolor: 'divider', mx: 2, opacity: 0.5 }} />
            <DashboardExchange animate={isVisible} />
            <Box sx={{ height: 1, bgcolor: 'divider', mx: 2, opacity: 0.5 }} />
            <ProcessExchange animate={isVisible} />
          </Box>

          {/* Input bar */}
          <Box sx={{ px: 2, py: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>
            <Box
              sx={{
                px: 1.5,
                py: 0.75,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.5, fontSize: '0.82rem' }}>
                Ask anything about your docs...
              </Typography>
              <Send size={14} color={alpha(theme.palette.text.secondary, 0.25)} />
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
