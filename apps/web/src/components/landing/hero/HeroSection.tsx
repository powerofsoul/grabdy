import { useCallback, useEffect, useRef } from 'react';

import { alpha, Box, Button, Container, Typography, useTheme } from '@mui/material';
import { ArrowDownIcon, ArrowRightIcon, FileTextIcon, HashIcon } from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

import { DemoRequestDrawer } from '../DemoRequestDrawer';
import { BRAND_LOGOS, SlackLogo } from '../IntegrationLogos';

import { DEMO_MESSAGES, DEMO_SOURCES, SLACK_DEMO } from './constants';
import { HeroBackground } from './HeroBackground';
import { LinearIcon } from './LinearIcon';
import { SlackIcon } from './SlackIcon';
import type { DemoSource } from './types';

import botLogo from '@/assets/grabdy-logo.jpg';
import { ChatInput } from '@/components/chat/components/ChatInput';
import { MessageRow } from '@/components/chat/components/MessageRow';
import { useDrawer } from '@/context/DrawerContext';

const FONT_SLACK = '"Lato", "Helvetica Neue", Helvetica, sans-serif';

const SOURCE_ICONS: Record<DemoSource['type'], (size: number) => React.ReactNode> = {
  PDF: (size) => <FileTextIcon size={size} weight="light" />,
  SLACK: (size) => <SlackIcon size={size} />,
  LINEAR: (size) => <LinearIcon size={size} />,
};

const noop = () => {};

export function HeroSection() {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const demoRef = useRef<HTMLDivElement>(null);
  const ct = theme.palette.text.primary;

  const { pushDrawer } = useDrawer();

  const openDemoDrawer = useCallback(() => {
    pushDrawer((onClose) => <DemoRequestDrawer onClose={onClose} />, {
      title: 'Request a demo',
    });
  }, [pushDrawer]);

  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Hero entrance animations ──
  useEffect(() => {
    if (!containerRef.current || prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const headline = containerRef.current?.querySelector('.hero-headline');
      if (headline) {
        const text = headline.textContent ?? '';
        headline.innerHTML = '';
        text.split(' ').forEach((word, i) => {
          const wrapper = document.createElement('span');
          wrapper.style.display = 'inline-block';
          wrapper.style.overflow = 'hidden';
          wrapper.style.verticalAlign = 'top';
          if (i > 0) headline.appendChild(document.createTextNode(' '));

          const inner = document.createElement('span');
          inner.style.display = 'inline-block';
          inner.textContent = word;
          inner.className = 'hero-word';
          wrapper.appendChild(inner);
          headline.appendChild(wrapper);
        });
      }

      const tl = gsap.timeline({ delay: 0.2 });

      tl.from('.hero-word', {
        yPercent: 110,
        rotateX: 10,
        stagger: 0.06,
        duration: 0.7,
        ease: 'power3.out',
      });

      tl.from('.hero-subtitle', { y: 20, opacity: 0, duration: 0.5, ease: 'power2.out' }, '-=0.2');
      tl.from('.hero-ctas', { y: 15, opacity: 0, duration: 0.4, ease: 'power2.out' }, '-=0.2');
      tl.from('.hero-logos', { y: 10, opacity: 0, duration: 0.4, ease: 'power2.out' }, '-=0.2');
      tl.from(
        '.hero-scroll-indicator',
        { y: -10, opacity: 0, duration: 0.5, ease: 'power2.out' },
        '-=0.1'
      );
    }, containerRef);

    return () => ctx.revert();
  }, [prefersReducedMotion]);

  // ── Scroll-driven demo: pin + crossfade App → Slack ──
  useEffect(() => {
    if (!demoRef.current || prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      const appView = demoRef.current?.querySelector('.demo-app-view');
      const slackView = demoRef.current?.querySelector('.demo-slack-view');
      const labelApp = demoRef.current?.querySelector('.demo-label-app');
      const labelSlack = demoRef.current?.querySelector('.demo-label-slack');

      if (!appView || !slackView || !labelApp || !labelSlack) return;

      // Entrance animation
      gsap.from('.hero-demo-inner', {
        y: 40,
        opacity: 0,
        scale: 0.97,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: demoRef.current,
          start: 'top 80%',
        },
      });

      // Pin the demo section and crossfade on scroll
      const pinTl = gsap.timeline({
        scrollTrigger: {
          trigger: demoRef.current,
          start: 'top 10%',
          end: '+=60%',
          pin: true,
          scrub: 0.15,
        },
      });

      // Crossfade: App out, Slack in
      pinTl.to(appView, { opacity: 0, y: -12, duration: 0.8, ease: 'power2.inOut' });
      pinTl.fromTo(
        slackView,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power2.inOut' },
        '<'
      );

      // Labels: swap active state
      pinTl.to(labelApp, { opacity: 0.4, duration: 0.4 }, '<');
      pinTl.to(labelSlack, { opacity: 1, duration: 0.4 }, '<');

      // Brief hold so Slack is visible before unpin
      pinTl.to({}, { duration: 0.1 });
    }, demoRef);

    return () => ctx.revert();
  }, [prefersReducedMotion]);

  return (
    <Box
      ref={containerRef}
      sx={{
        bgcolor: 'background.default',
        position: 'relative',
        overflow: 'hidden',
        background:
          theme.palette.mode === 'dark'
            ? `radial-gradient(ellipse 80% 50% at 50% 0%, ${alpha(ct, 0.04)} 0%, transparent 70%)`
            : `radial-gradient(ellipse 80% 50% at 50% 0%, ${alpha(ct, 0.03)} 0%, transparent 70%)`,
      }}
    >
      {/* ── Full-screen hero (above the fold) ── */}
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden',
          px: 2,
        }}
      >
        <HeroBackground />
        <Box sx={{ textAlign: 'center', maxWidth: 720, position: 'relative', zIndex: 1 }}>
          <Typography
            className="hero-headline"
            variant="h1"
            sx={{
              fontSize: { xs: '2.75rem', sm: '3.5rem', md: '4rem' },
              fontWeight: 700,
              lineHeight: 1.1,
              mb: 2.5,
              letterSpacing: '-0.04em',
            }}
          >
            Your data has answers. Just ask.
          </Typography>

          <Typography
            className="hero-subtitle"
            sx={{
              color: 'text.secondary',
              fontWeight: 400,
              mb: 4,
              fontSize: { xs: '1.05rem', md: '1.2rem' },
              lineHeight: 1.6,
              maxWidth: 520,
              mx: 'auto',
            }}
          >
            Turn scattered files and conversations into a knowledge base you can talk to.
          </Typography>

          <Box
            className="hero-ctas"
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              mb: 4,
            }}
          >
            <Link to="/auth/signup" style={{ textDecoration: 'none' }}>
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowRightIcon size={18} weight="light" />}
                sx={{ px: 4, py: 1.5, fontSize: '1rem' }}
              >
                Start for free
              </Button>
            </Link>
            <Typography
              component="button"
              onClick={openDemoDrawer}
              sx={{
                fontSize: '0.9rem',
                fontWeight: 500,
                color: 'text.secondary',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                transition: 'color 0.15s',
                '&:hover': { color: 'text.primary' },
              }}
            >
              Request a demo
            </Typography>
          </Box>

          {/* Integration logos */}
          <Box
            className="hero-logos"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Typography
              sx={{
                fontSize: '0.7rem',
                color: alpha(ct, 0.3),
                fontWeight: 500,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              Works with
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, md: 3 } }}>
              {BRAND_LOGOS.map((brand) => (
                <Box
                  key={brand.name}
                  sx={{
                    opacity: 0.4,
                    transition: 'opacity 0.2s',
                    '&:hover': { opacity: 0.7 },
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <brand.Logo size={20} />
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        {/* Scroll indicator */}
        <Box
          className="hero-scroll-indicator"
          sx={{
            position: 'absolute',
            bottom: 32,
            zIndex: 1,
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            opacity: 0.4,
            animation: 'scrollBounce 2s ease-in-out infinite',
            '@keyframes scrollBounce': {
              '0%, 100%': { transform: 'translateY(0)' },
              '50%': { transform: 'translateY(6px)' },
            },
          }}
        >
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', fontWeight: 500 }}>
            See it in action
          </Typography>
          <ArrowDownIcon size={16} weight="light" />
        </Box>
      </Box>

      {/* ── Scroll-pinned product demo (hidden on mobile) ── */}
      <Box
        ref={demoRef}
        sx={{
          display: { xs: 'none', md: 'block' },
          position: 'relative',
          zIndex: 1,
          pb: 6,
        }}
      >
        <Container maxWidth="xl">
          <Box className="hero-demo-inner">
            {/* Slide labels */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                gap: 2,
                mb: 3,
                alignItems: 'center',
              }}
            >
              <Typography
                className="demo-label-app"
                sx={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'text.primary',
                  transition: 'opacity 0.2s',
                }}
              >
                Web App
              </Typography>
              <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: alpha(ct, 0.2) }} />
              <Typography
                className="demo-label-slack"
                sx={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'text.primary',
                  opacity: 0.4,
                  transition: 'opacity 0.2s',
                }}
              >
                Slack
              </Typography>
            </Box>

            {/* Demo viewport */}
            <Box sx={{ maxWidth: 1200, mx: 'auto', position: 'relative', height: 560 }}>
              {/* App view */}
              <Box className="demo-app-view" sx={{ position: 'absolute', inset: 0 }}>
                <AppDemoView ct={ct} />
              </Box>

              {/* Slack view */}
              <Box className="demo-slack-view" sx={{ position: 'absolute', inset: 0, opacity: 0 }}>
                <SlackDemoView />
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}

/* ── App Demo View ── */

function AppDemoView({ ct }: { ct: string }) {
  const theme = useTheme();

  return (
    <Box
      sx={{
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
          }}
        >
          <Typography sx={{ color: alpha(ct, 0.45), fontSize: '0.72rem', fontWeight: 600 }}>
            Chat
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: 520,
        }}
      >
        <Box
          sx={{
            flex: 1,
            p: 2.5,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            '&::-webkit-scrollbar': { width: 3 },
            '&::-webkit-scrollbar-thumb': { bgcolor: alpha(ct, 0.08), borderRadius: 2 },
          }}
        >
          {DEMO_MESSAGES.map((msg) => (
            <Box key={msg.id}>
              <MessageRow message={msg} />
              {msg.role === 'assistant' && (
                <Box
                  sx={{
                    mt: 0.75,
                    pl: 2,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1,
                    alignItems: 'center',
                  }}
                >
                  {DEMO_SOURCES.map((s) => (
                    <Box
                      key={s.name}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        px: 0.75,
                        py: 0.25,
                        borderRadius: 1,
                        bgcolor: alpha(ct, 0.04),
                      }}
                    >
                      {SOURCE_ICONS[s.type](11)}
                      <Typography
                        sx={{ fontSize: '0.65rem', color: 'text.secondary', lineHeight: 1.2 }}
                      >
                        {s.name}
                        {s.detail ? ` (${s.detail})` : ''}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          ))}
        </Box>

        <ChatInput
          onSend={noop}
          isStreaming={false}
          disabled
          placeholder="Ask anything about your documents..."
        />
      </Box>
    </Box>
  );
}

/* ── Slack Demo View ── */

function SlackDemoView() {
  const theme = useTheme();
  const codeText = theme.palette.kindle.codeBlockText;
  const syntaxKey = theme.palette.kindle.syntaxKey;
  const syntaxNumber = theme.palette.kindle.syntaxNumber;

  const border = alpha(codeText, 0.1);
  const borderSubtle = alpha(codeText, 0.06);
  const textDim = alpha(codeText, 0.5);
  const mentionBg = alpha(syntaxKey, 0.12);
  const mentionColor = syntaxKey;
  const linkColor = syntaxNumber;
  const channelBg = theme.palette.kindle.codeBlockBg;

  return (
    <Box
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: channelBg,
        border: '1px solid',
        borderColor: border,
        display: 'flex',
        flexDirection: 'row',
        boxShadow: theme.shadows[4],
      }}
    >
      {/* Sidebar */}
      <Box
        sx={{
          width: 200,
          flexShrink: 0,
          bgcolor: alpha(codeText, 0.06),
          borderRight: '1px solid',
          borderColor: borderSubtle,
          py: 1.5,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ px: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <SlackLogo size={20} />
          <Typography
            sx={{
              fontFamily: FONT_SLACK,
              fontSize: '0.9rem',
              fontWeight: 700,
              color: codeText,
            }}
          >
            Acme Inc
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <SlackChannel name="general" color={alpha(codeText, 0.45)} />
          <SlackChannel name={SLACK_DEMO.channel} color={codeText} active />
          <SlackChannel name="engineering" color={alpha(codeText, 0.45)} />
          <SlackChannel name="design" color={alpha(codeText, 0.45)} />
        </Box>
      </Box>

      {/* Main area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Channel header */}
        <Box
          sx={{
            px: 2.5,
            py: 1.25,
            borderBottom: '1px solid',
            borderColor: borderSubtle,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          <HashIcon size={16} weight="bold" color={codeText} />
          <Typography
            sx={{
              fontFamily: FONT_SLACK,
              fontSize: '0.9rem',
              fontWeight: 700,
              color: codeText,
            }}
          >
            {SLACK_DEMO.channel}
          </Typography>
        </Box>

        {/* Messages */}
        <Box sx={{ px: 2.5, py: 2, flex: 1 }}>
          {/* User message */}
          <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', mb: 2.5, py: 0.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '6px',
                bgcolor: alpha(syntaxNumber, 0.25),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Typography
                sx={{
                  fontFamily: FONT_SLACK,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: codeText,
                }}
              >
                {SLACK_DEMO.userInitials}
              </Typography>
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mb: 0.5 }}>
                <Typography
                  sx={{
                    fontFamily: FONT_SLACK,
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    color: codeText,
                  }}
                >
                  {SLACK_DEMO.userName}
                </Typography>
                <Typography sx={{ fontFamily: FONT_SLACK, fontSize: '0.72rem', color: textDim }}>
                  {SLACK_DEMO.time}
                </Typography>
              </Box>
              <Typography
                sx={{
                  fontFamily: FONT_SLACK,
                  fontSize: '0.9rem',
                  lineHeight: 1.65,
                  color: codeText,
                  wordBreak: 'break-word',
                }}
              >
                <Box
                  component="span"
                  sx={{
                    bgcolor: mentionBg,
                    color: mentionColor,
                    borderRadius: '3px',
                    px: 0.5,
                    py: 0.125,
                    fontWeight: 600,
                  }}
                >
                  @Grabdy
                </Box>{' '}
                {SLACK_DEMO.userMessage}
              </Typography>
            </Box>
          </Box>

          {/* Bot response */}
          <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', py: 0.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '6px',
                bgcolor: 'common.white',
                flexShrink: 0,
                overflow: 'hidden',
                p: '4px',
              }}
            >
              <Box
                component="img"
                src={botLogo}
                alt=""
                sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mb: 0.5 }}>
                <Typography
                  sx={{
                    fontFamily: FONT_SLACK,
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    color: codeText,
                  }}
                >
                  Grabdy
                </Typography>
                <Box
                  sx={{
                    px: 0.5,
                    py: 0.125,
                    borderRadius: '3px',
                    bgcolor: alpha(codeText, 0.12),
                    lineHeight: 1,
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: FONT_SLACK,
                      fontSize: '0.6rem',
                      fontWeight: 700,
                      color: textDim,
                      letterSpacing: '0.03em',
                    }}
                  >
                    APP
                  </Typography>
                </Box>
                <Typography sx={{ fontFamily: FONT_SLACK, fontSize: '0.72rem', color: textDim }}>
                  {SLACK_DEMO.time}
                </Typography>
              </Box>

              <Typography
                sx={{
                  fontFamily: FONT_SLACK,
                  fontSize: '0.9rem',
                  lineHeight: 1.65,
                  color: codeText,
                  wordBreak: 'break-word',
                  mb: 1.5,
                }}
              >
                {SLACK_DEMO.botResponse}
              </Typography>

              {/* Sources */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                {SLACK_DEMO.sources.map((s) => (
                  <Typography
                    key={s.name}
                    sx={{
                      fontFamily: FONT_SLACK,
                      fontSize: '0.85rem',
                      lineHeight: 1.5,
                      color: textDim,
                      wordBreak: 'break-word',
                    }}
                  >
                    {'— '}
                    <Box component="span" sx={{ color: linkColor }}>
                      {s.name}
                    </Box>{' '}
                    {s.detail}
                  </Typography>
                ))}
              </Box>

              <Typography
                sx={{
                  fontFamily: FONT_SLACK,
                  fontSize: '0.75rem',
                  color: linkColor,
                  mt: 1.5,
                  cursor: 'default',
                }}
              >
                2 replies
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/* ── Slack sidebar channel ── */

function SlackChannel({ name, color, active }: { name: string; color: string; active?: boolean }) {
  const theme = useTheme();
  const codeText = theme.palette.kindle.codeBlockText;

  return (
    <Box
      sx={{
        px: 2,
        py: 0.5,
        bgcolor: active ? alpha(codeText, 0.1) : 'transparent',
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
      }}
    >
      <Typography
        sx={{
          fontFamily: FONT_SLACK,
          fontSize: '0.82rem',
          color,
          fontWeight: active ? 700 : 400,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        # {name}
      </Typography>
    </Box>
  );
}
