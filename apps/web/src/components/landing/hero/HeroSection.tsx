import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { alpha, Box, Button, Container, IconButton, Typography, useTheme } from '@mui/material';
import {
  ArrowRightIcon,
  BrainIcon,
  CaretRightIcon,
  ChartBarIcon,
  ClockIcon,
  CrosshairIcon,
  FileTextIcon,
  LightbulbIcon,
  LightningIcon,
  MinusIcon,
  PaperPlaneTiltIcon,
  PlusIcon,
  RocketIcon,
  ShareNetworkIcon,
  ShieldIcon,
  TrendUpIcon,
  WarningDiamondIcon,
} from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';
import gsap from 'gsap';

import {
  CARD_SOURCES,
  CHANNEL_FLOW,
  COMPETITORS,
  EDGES,
  INIT_POS,
  MARKET_BARS,
  METRICS_DATA,
  NODE_W,
  PRIORITIES,
  RISKS,
  ROADMAP_ITEMS,
  SUMMARY_STATS,
  SWOT,
  TURNS,
} from './constants';
import { GoogleDriveIcon } from './GoogleDriveIcon';
import { edgeEndpoints, edgePath } from './helpers';
import { LinearIcon } from './LinearIcon';
import { SlackIcon } from './SlackIcon';
import type { ChatMsg, HeroCardId, SourceType } from './types';

import heroClouds from '@/assets/hero-clouds-light.svg';

export function HeroSection() {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const isDark = theme.palette.mode === 'dark';

  // Chat
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inView, setInView] = useState(false);

  // Canvas
  const [positions, setPositions] = useState<Record<HeroCardId, { x: number; y: number }>>(() => {
    // Deep copy so state mutations don't affect the constant
    return Object.fromEntries(Object.entries(INIT_POS).map(([k, v]) => [k, { ...v }])) as Record<
      HeroCardId,
      { x: number; y: number }
    >;
  });
  const [visibleNodes, setVisibleNodes] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showEdges, setShowEdges] = useState(false);
  const [smoothTx, setSmoothTx] = useState(true);
  const [measuredH, setMeasuredH] = useState<Partial<Record<HeroCardId, number>>>({});
  const [isPanning, setIsPanning] = useState(false);
  const [draggingCard, setDraggingCard] = useState<string | null>(null);

  const userInteracted = useRef(false);
  const panRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const isPanningRef = useRef(false);
  const dragRef = useRef<{ id: HeroCardId; sx: number; sy: number; ox: number; oy: number } | null>(
    null
  );
  const zoomRef = useRef(1);
  const posRef = useRef(positions);
  const wheelTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    posRef.current = positions;
  }, [positions]);

  // Measure real card heights from DOM
  useEffect(() => {
    const container = canvasRef.current;
    if (!container) return;
    const cards = container.querySelectorAll<HTMLElement>('[data-card]');
    const next: Partial<Record<HeroCardId, number>> = {};
    cards.forEach((el) => {
      const id = el.dataset.card;
      if (id && id in INIT_POS) next[id as HeroCardId] = el.offsetHeight;
    });
    queueMicrotask(() => {
      setMeasuredH((prev) => {
        const prevLookup: Partial<Record<string, number>> = prev;
        const nextLookup: Partial<Record<string, number>> = next;
        const changed = Object.keys(next).some((k) => prevLookup[k] !== nextLookup[k]);
        return changed ? { ...prev, ...next } : prev;
      });
    });
  }, [visibleNodes]);

  // Scroll chat panel to bottom when messages are set
  useEffect(() => {
    const el = chatPanelRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

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

    // CheckIcon for card drag
    if (target instanceof HTMLElement) {
      const cardEl = target.closest('[data-card]');
      if (cardEl instanceof HTMLElement) {
        const id = cardEl.getAttribute('data-card') ?? '';
        if (id && id in INIT_POS) {
          const cardId = id as HeroCardId;
          const p = posRef.current[cardId];
          dragRef.current = { id: cardId, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y };
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
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      px: panRef.current.x,
      py: panRef.current.y,
    };
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

  // ── Set final state for chat + canvas immediately ──
  useEffect(() => {
    const allMsgs: ChatMsg[] = [];
    let id = 0;
    for (const turn of TURNS) {
      allMsgs.push({ id: id++, role: 'user', text: turn.user });
      allMsgs.push({
        id: id++,
        role: 'assistant',
        text: turn.answer,
        sources: turn.sources,
        responseMs: turn.responseMs,
      });
    }
    queueMicrotask(() => {
      setMessages(allMsgs);
      setVisibleNodes(new Set(Object.keys(INIT_POS)));
      setZoom(0.48);
      setShowEdges(true);
      setInView(true);
    });
  }, []);

  // ── Hero entrance animations ──
  useEffect(() => {
    if (!containerRef.current) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.15 });
      tl.from('.hero-headline', { y: 30, opacity: 0, duration: 0.7, ease: 'power3.out' });
      tl.from('.hero-subtitle', { y: 20, opacity: 0, duration: 0.5, ease: 'power2.out' }, '-=0.3');
      tl.from('.hero-ctas', { y: 15, opacity: 0, duration: 0.4 }, '-=0.2');
      tl.from(
        '.hero-showcase',
        { y: 50, opacity: 0, scale: 0.97, duration: 0.8, ease: 'power3.out' },
        '-=0.2'
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const ct = theme.palette.text.primary;
  const p = theme.palette;

  // ── Card style helper ──
  const cardSx = (color: string, vis: boolean, flash: boolean, nodeId: HeroCardId) => ({
    position: 'absolute' as const,
    left: positions[nodeId]?.x ?? 0,
    top: positions[nodeId]?.y ?? 0,
    width: NODE_W[nodeId],
    p: nodeId === 'hub' ? 0.75 : 1.5,
    borderRadius: nodeId === 'hub' ? '17px' : '10px',
    bgcolor: alpha(color, isDark ? 0.1 : 0.06),
    border: `${flash ? 2 : 1.5}px solid ${alpha(color, flash ? 0.5 : isDark ? 0.25 : 0.18)}`,
    boxShadow:
      draggingCard === nodeId
        ? `0 8px 24px ${alpha(color, 0.25)}, 0 0 0 2px ${alpha(color, 0.3)}`
        : `3px 3px 0 ${alpha(color, isDark ? 0.1 : 0.07)}`,
    opacity: vis ? 1 : 0,
    transform: vis ? 'scale(1)' : 'scale(0.85)',
    transition:
      'opacity 0.5s cubic-bezier(0.4,0,0.2,1), transform 0.5s cubic-bezier(0.4,0,0.2,1), border-color 0.3s, box-shadow 0.3s',
    cursor: vis ? (draggingCard === nodeId ? 'grabbing' : 'grab') : 'default',
    userSelect: 'none' as const,
    zIndex: draggingCard === nodeId ? 8 : 1,
    '&:hover': vis
      ? { boxShadow: `0 6px 20px ${alpha(color, 0.2)}, 0 0 0 1px ${alpha(color, 0.2)}` }
      : {},
  });

  const labelRow = (color: string, Icon: typeof BrainIcon, text: string) => (
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
        <Icon size={12} weight="light" color={alpha(color, isDark ? 0.85 : 0.75)} />
      </Box>
      <Typography
        sx={{ fontSize: '0.8rem', fontWeight: 700, color: alpha(color, isDark ? 0.85 : 0.7) }}
      >
        {text}
      </Typography>
    </Box>
  );

  const riskColor = (level: string) =>
    level === 'High' ? p.error.main : level === 'Med' ? p.warning.main : p.success.main;

  const SOURCE_ICON: Record<SourceType, ReactNode> = {
    slack: <SlackIcon size={14} />,
    gdrive: <GoogleDriveIcon size={14} />,
    linear: <LinearIcon size={14} />,
    file: <FileTextIcon size={12} weight="light" color={alpha(ct, 0.3)} />,
  };
  const sourceIcon = (type: SourceType) => SOURCE_ICON[type];

  const sourceRow = (nodeId: HeroCardId) => {
    const srcs = CARD_SOURCES[nodeId];
    if (!srcs) return null;
    return (
      <Box
        sx={{
          mt: 1.25,
          pt: 1,
          borderTop: '1px solid',
          borderColor: alpha(ct, 0.06),
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.25,
        }}
      >
        {srcs.map((s) => (
          <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {sourceIcon(s.type)}
            <Typography sx={{ fontSize: '0.75rem', color: alpha(ct, 0.5), lineHeight: 1 }}>
              {s.label}
            </Typography>
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
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${heroClouds})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          pointerEvents: 'none',
          filter: isDark ? 'invert(1)' : 'none',
        },
      }}
    >
      <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1 }}>
        <Box sx={{ textAlign: 'center', maxWidth: 800, mx: 'auto' }}>
          <Typography
            className="hero-headline"
            variant="h1"
            sx={{
              fontSize: { xs: '2.5rem', sm: '3rem', md: '3.75rem' },
              fontWeight: 400,
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
              fontSize: { xs: '1rem', md: '1.125rem' },
              lineHeight: 1.6,
              maxWidth: 580,
              mx: 'auto',
            }}
          >
            Answers pulled from Slack, Docs, Notion, and every tool your team uses. structured,
            cited, and ready to act on.
          </Typography>

          <Typography
            className="hero-subtitle"
            sx={{
              fontSize: '0.85rem',
              color: 'text.secondary',
              mb: 4,
            }}
          >
            For product, ops, and support teams drowning in documents.
          </Typography>

          <Box
            className="hero-ctas"
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              mb: { xs: 5, md: 6 },
            }}
          >
            <Link to="/auth/signup" style={{ textDecoration: 'none' }}>
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowRightIcon size={18} weight="light" />}
                sx={{
                  px: 4,
                  py: 1.5,
                  fontSize: '1rem',
                }}
              >
                Get Started
              </Button>
            </Link>
          </Box>
        </Box>

        {/* ── Showcase (hidden on mobile) ── */}
        <Box

          className="hero-showcase"
          sx={{
            display: { xs: 'none', md: 'block' },
            maxWidth: 1200,
            mx: 'auto',
            borderRadius: 2.5,
            overflow: 'hidden',
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: theme.shadows[4],
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
                <Box
                  key={c}
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: `${c}.main`,
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
                gap: 2,
              }}
            >
              <Typography sx={{ color: alpha(ct, 0.45), fontSize: '0.72rem', fontWeight: 600 }}>
                Chat
              </Typography>
              <Box sx={{ width: '1px', height: 12, bgcolor: alpha(ct, 0.1) }} />
              <Typography sx={{ color: alpha(ct, 0.25), fontSize: '0.72rem', fontWeight: 500 }}>
                Canvas
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: 'stretch',
            }}
          >
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
                <Box
                  key={msg.id}
                  sx={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <Box sx={{ maxWidth: '85%' }}>
                    <Box
                      sx={{
                        px: 2,
                        py: 1.25,
                        borderRadius: 2,
                        ...(msg.role === 'user'
                          ? {
                              bgcolor: 'primary.main',
                              color: 'primary.contrastText',
                              borderBottomRightRadius: 4,
                            }
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
                          color: msg.role === 'user' ? 'inherit' : 'text.primary',
                        }}
                      >
                        {msg.text}
                      </Typography>
                    </Box>
                    {msg.role === 'assistant' && msg.sources && (
                      <Box
                        sx={{
                          mt: 0.75,
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: 1,
                          px: 0.5,
                        }}
                      >
                        {msg.sources.map((s) => {
                          const icon = s.startsWith('Google Drive') ? (
                            <GoogleDriveIcon size={11} />
                          ) : s.startsWith('Slack') ? (
                            <SlackIcon size={11} />
                          ) : s.startsWith('Linear') ? (
                            <LinearIcon size={11} />
                          ) : (
                            <FileTextIcon size={10} weight="light" color={alpha(ct, 0.35)} />
                          );
                          return (
                            <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                              {icon}
                              <Typography sx={{ fontSize: '0.65rem', color: alpha(ct, 0.4) }}>
                                {s}
                              </Typography>
                            </Box>
                          );
                        })}
                        {msg.responseMs && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, ml: 'auto' }}>
                            <ClockIcon size={9} weight="light" color={alpha(ct, 0.3)} />
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
                        d={edgePath(positions, from, to, measuredH)}
                        fill="none"
                        stroke={alpha(ct, 0.18)}
                        strokeWidth={2}
                        strokeLinecap="round"
                        opacity={showEdges && bothVisible ? 1 : 0}
                        style={{ transition: 'opacity 0.6s ease' }}
                      />
                    );
                  })}
                  {/* Small dots at connection endpoints */}
                  {showEdges &&
                    EDGES.map(([from, to]) => {
                      if (!visibleNodes.has(from) || !visibleNodes.has(to)) return null;
                      const ep = edgeEndpoints(positions, from, to, measuredH);
                      if (!ep) return null;
                      return (
                        <g key={`dots-${from}-${to}`}>
                          <circle cx={ep.x0} cy={ep.y0} r={3.5} fill={alpha(ct, 0.25)} />
                          <circle cx={ep.x1} cy={ep.y1} r={3.5} fill={alpha(ct, 0.25)} />
                        </g>
                      );
                    })}
                </Box>

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
                  <BrainIcon size={15} weight="light" color={alpha(p.primary.main, 0.8)} />
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
                    ...cardSx(
                      p.info.main,
                      visibleNodes.has('market'),
                      false,
                      'market'
                    ),
                    pointerEvents: visibleNodes.has('market') ? 'auto' : 'none',
                  }}
                >
                  {labelRow(p.info.main, ChartBarIcon, 'Market Size')}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                    {MARKET_BARS.map((d) => (
                      <Box key={d.label}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
                          <Typography sx={{ fontSize: '0.72rem', color: alpha(ct, 0.55) }}>
                            {d.label}
                          </Typography>
                          <Typography
                            sx={{ fontSize: '0.72rem', fontWeight: 600, color: alpha(ct, 0.8) }}
                          >
                            {d.value}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            height: 7,
                            bgcolor: alpha(ct, 0.06),
                            borderRadius: 1,
                            overflow: 'hidden',
                          }}
                        >
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
                    ...cardSx(
                      p.warning.main,
                      visibleNodes.has('competitors'),
                      false,
                      'competitors'
                    ),
                    pointerEvents: visibleNodes.has('competitors') ? 'auto' : 'none',
                  }}
                >
                  {labelRow(p.warning.main, CrosshairIcon, 'Competitive Landscape')}
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
                            bgcolor: alpha(
                              c.name === 'You' ? p.primary.main : p.warning.main,
                              0.12
                            ),
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
                  {labelRow(p.secondary.main, ShieldIcon, 'SWOT Analysis')}
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
                          sx={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: alpha(q.color, 0.75),
                            mb: 0.25,
                          }}
                        >
                          {q.key}
                        </Typography>
                        {q.items.map((item) => (
                          <Typography
                            key={item}
                            sx={{ fontSize: '0.78rem', color: alpha(ct, 0.6), lineHeight: 1.5 }}
                          >
                            {item}
                          </Typography>
                        ))}
                      </Box>
                    ))}
                  </Box>
                  {sourceRow('swot')}
                </Box>

                {/* ── KeyIcon Metrics ── */}
                <Box
                  data-card="metrics"
                  sx={{
                    ...cardSx(p.success.main, visibleNodes.has('metrics'), false, 'metrics'),
                    pointerEvents: visibleNodes.has('metrics') ? 'auto' : 'none',
                  }}
                >
                  {labelRow(p.success.main, TrendUpIcon, 'KeyIcon Metrics')}
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    {METRICS_DATA.map((m) => (
                      <Box key={m.label} sx={{ textAlign: 'center', flex: 1 }}>
                        <Typography
                          sx={{ fontSize: '1rem', fontWeight: 800, color: alpha(ct, 0.9) }}
                        >
                          {m.value}
                        </Typography>
                        <Typography sx={{ fontSize: '0.78rem', color: alpha(ct, 0.45), mb: 0.15 }}>
                          {m.label}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: alpha(p.success.main, 0.8),
                          }}
                        >
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
                  {labelRow(p.info.main, LightningIcon, 'Growth Channels')}
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
                          <Typography
                            sx={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              color: alpha(p.info.main, 0.85),
                            }}
                          >
                            {step}
                          </Typography>
                        </Box>
                        {i < CHANNEL_FLOW.length - 1 && (
                          <CaretRightIcon size={10} weight="light" color={alpha(ct, 0.25)} />
                        )}
                      </Box>
                    ))}
                  </Box>
                  <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box
                      sx={{
                        height: 4,
                        flex: 1,
                        borderRadius: 2,
                        bgcolor: alpha(p.info.main, 0.12),
                      }}
                    >
                      <Box
                        sx={{
                          height: '100%',
                          width: '45%',
                          borderRadius: 2,
                          bgcolor: alpha(p.info.main, 0.5),
                        }}
                      />
                    </Box>
                    <Typography
                      sx={{ fontSize: '0.75rem', color: alpha(ct, 0.5), fontWeight: 600 }}
                    >
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
                  {labelRow(p.error.main, WarningDiamondIcon, 'Risk Assessment')}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                    {RISKS.map((r) => (
                      <Box
                        key={r.text}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Typography sx={{ fontSize: '0.72rem', color: alpha(ct, 0.65) }}>
                          {r.text}
                        </Typography>
                        <Box
                          sx={{
                            px: 0.6,
                            py: 0.15,
                            borderRadius: '3px',
                            bgcolor: alpha(riskColor(r.level), 0.12),
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: alpha(riskColor(r.level), 0.85),
                            }}
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
                    ...cardSx(
                      p.primary.main,
                      visibleNodes.has('recommendations'),
                      false,
                      'recommendations'
                    ),
                    pointerEvents: visibleNodes.has('recommendations') ? 'auto' : 'none',
                  }}
                >
                  {labelRow(p.primary.main, LightbulbIcon, 'Strategic Priorities')}
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
                          <Typography
                            sx={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              color: alpha(p.primary.main, 0.8),
                            }}
                          >
                            {i + 1}
                          </Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography
                            sx={{ fontSize: '0.72rem', color: alpha(ct, 0.7), lineHeight: 1.3 }}
                          >
                            {pr.text}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.2 }}>
                            <Box
                              sx={{ height: 3, flex: 1, bgcolor: alpha(ct, 0.06), borderRadius: 1 }}
                            >
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
                              sx={{
                                fontSize: '0.45rem',
                                fontWeight: 600,
                                color: alpha(p.primary.main, 0.6),
                              }}
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
                  {labelRow(p.success.main, RocketIcon, '90-Day Roadmap')}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 0.5,
                      position: 'relative',
                    }}
                  >
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
                      <Box
                        key={item.q}
                        sx={{ flex: 1, textAlign: 'center', position: 'relative', zIndex: 1 }}
                      >
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
                          sx={{
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            color: alpha(p.success.main, 0.75),
                            mb: 0.15,
                          }}
                        >
                          {item.q}
                        </Typography>
                        <Typography
                          sx={{ fontSize: '0.75rem', color: alpha(ct, 0.55), lineHeight: 1.3 }}
                        >
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
                    <BrainIcon size={15} weight="light" color={alpha(p.primary.main, 0.85)} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      sx={{
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: alpha(ct, 0.85),
                        mb: 0.25,
                      }}
                    >
                      Executive Summary
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                      {SUMMARY_STATS.map((s) => (
                        <Box
                          key={s.label}
                          sx={{ display: 'flex', alignItems: 'baseline', gap: 0.4 }}
                        >
                          <Typography
                            sx={{
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              color: alpha(p.primary.main, 0.85),
                            }}
                          >
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
                  <MinusIcon size={12} weight="light" color={alpha(ct, 0.5)} />
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
                  <PlusIcon size={12} weight="light" color={alpha(p.primary.main, 0.7)} />
                </IconButton>
                <Box sx={{ width: '1px', height: 14, bgcolor: alpha(ct, 0.1), mx: 0.25 }} />
                <IconButton size="small" sx={{ p: 0.4 }}>
                  <ShareNetworkIcon size={12} weight="light" color={alpha(ct, 0.5)} />
                </IconButton>
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
                <Box
                  sx={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    bgcolor: alpha(p.success.main, 0.7),
                  }}
                />
                <Typography sx={{ fontSize: '0.7rem', color: alpha(ct, 0.45), fontWeight: 600 }}>
                  {visibleNodes.size} nodes
                  {showEdges ? ` \u00B7 ${EDGES.length} connections` : ''}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Input bar */}
          <Box
            sx={{
              px: { xs: 2, md: 3 },
              pb: 2,
              pt: 1,
              borderTop: '1px solid',
              borderColor: alpha(ct, 0.06),
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: alpha(ct, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'border-color 0.2s',
              }}
            >
              <Typography sx={{ color: alpha(ct, 0.25), fontSize: '0.82rem' }}>
                Ask anything about your documents...
              </Typography>
              <PaperPlaneTiltIcon
                size={14}
                weight="light"
                color={alpha(ct, 0.15)}
              />
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
