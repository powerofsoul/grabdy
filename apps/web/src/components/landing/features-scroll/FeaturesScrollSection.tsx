import { useEffect, useRef, useState } from 'react';

import { alpha, Box, Container, Typography, useMediaQuery, useTheme } from '@mui/material';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { Link } from '@tanstack/react-router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { ApiPanel } from './components/ApiPanel';
import { IntegrationsPanel } from './components/IntegrationsPanel';
import { InterfacePanel } from './components/InterfacePanel';
import { McpPanel } from './components/McpPanel';
import { SearchPanel } from './components/SearchPanel';
import { WidgetPanel } from './components/WidgetPanel';
import { FEATURE_TABS } from './constants';

gsap.registerPlugin(ScrollTrigger);

const PANELS = [
  SearchPanel,
  InterfacePanel,
  IntegrationsPanel,
  WidgetPanel,
  ApiPanel,
  McpPanel,
] as const;

export function FeaturesScrollSection() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const sectionRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const ct = theme.palette.text.primary;

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!sectionRef.current || prefersReducedMotion || !isDesktop) return;

    const ctx = gsap.context(() => {
      // Track which card is active based on scroll position
      cardRefs.current.forEach((card, i) => {
        if (!card) return;
        ScrollTrigger.create({
          trigger: card,
          start: 'top 40%',
          end: 'bottom 40%',
          onEnter: () => setActiveIndex(i),
          onEnterBack: () => setActiveIndex(i),
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [isDesktop]);

  return (
    <Box
      ref={sectionRef}
      id="features"
      sx={{ bgcolor: 'background.default', py: { xs: 8, md: 12 } }}
    >
      <Container maxWidth="lg">
        {isDesktop ? (
          <Box sx={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {/* Left: pinned nav */}
            <Box
              sx={{
                flex: '0 0 240px',
                alignSelf: 'stretch',
                position: 'relative',
              }}
            >
              <Box
                ref={navRef}
                sx={{
                  position: 'sticky',
                  top: 'calc(50dvh - 150px)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5,
                }}
              >
                {FEATURE_TABS.map((tab, i) => {
                  const isActive = i === activeIndex;
                  return (
                    <Box
                      key={tab.number}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        py: 1.5,
                        px: 2,
                        borderLeft: '2px solid',
                        borderColor: isActive ? 'primary.main' : 'transparent',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: alpha(ct, 0.02) },
                        borderRadius: '0 8px 8px 0',
                      }}
                      onClick={() => {
                        const card = cardRefs.current[i];
                        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                    >
                      <Typography
                        sx={{
                          fontWeight: 500,
                          fontSize: '0.75rem',
                          color: isActive ? 'primary.main' : alpha(ct, 0.3),
                          transition: 'color 0.3s ease',
                          flexShrink: 0,
                        }}
                      >
                        {tab.number}
                      </Typography>
                      <Typography
                        sx={{
                          fontWeight: isActive ? 600 : 400,
                          fontSize: '0.95rem',
                          color: isActive ? 'text.primary' : alpha(ct, 0.4),
                          transition: 'all 0.3s ease',
                        }}
                      >
                        {tab.title}
                      </Typography>
                    </Box>
                  );
                })}

                <Box sx={{ mt: 3, pl: 2 }}>
                  <Link to="/auth/signup" style={{ textDecoration: 'none' }}>
                    <Box
                      component="button"
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 3,
                        py: 1,
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        border: 'none',
                        borderRadius: 1.5,
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'opacity 0.2s',
                        '&:hover': { opacity: 0.9 },
                      }}
                    >
                      Get started
                      <ArrowRightIcon size={16} weight="light" />
                    </Box>
                  </Link>
                </Box>
              </Box>
            </Box>

            {/* Right: scrolling feature cards */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {FEATURE_TABS.map((tab, i) => {
                const Panel = PANELS[i];
                return (
                  <Box
                    key={tab.number}
                    ref={(el: HTMLDivElement | null) => {
                      cardRefs.current[i] = el;
                    }}
                    sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
                  >
                    <Box>
                      <Typography
                        sx={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: 'primary.main',
                          mb: 0.75,
                        }}
                      >
                        {tab.number}
                      </Typography>
                      <Typography
                        variant="h3"
                        sx={{ fontSize: '1.75rem', fontWeight: 600, color: 'text.primary', mb: 1 }}
                      >
                        {tab.heading}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: '0.92rem',
                          color: 'text.secondary',
                          lineHeight: 1.7,
                          maxWidth: 500,
                        }}
                      >
                        {tab.description}
                      </Typography>
                    </Box>
                    <Panel />
                  </Box>
                );
              })}
            </Box>
          </Box>
        ) : (
          // Mobile: stacked
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {FEATURE_TABS.map((tab, i) => {
              const Panel = PANELS[i];
              return (
                <Box key={tab.number} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  <Box>
                    <Typography
                      component="span"
                      sx={{ fontSize: '0.72rem', fontWeight: 500, color: 'primary.main', mr: 1 }}
                    >
                      {tab.number}
                    </Typography>
                    <Typography
                      variant="h4"
                      component="span"
                      sx={{ fontSize: '1.25rem', fontWeight: 600, color: 'text.primary' }}
                    >
                      {tab.heading}
                    </Typography>
                    <Typography
                      sx={{ mt: 1, fontSize: '0.88rem', color: 'text.secondary', lineHeight: 1.7 }}
                    >
                      {tab.description}
                    </Typography>
                  </Box>
                  <Box sx={{ overflow: 'hidden' }}>
                    <Panel />
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Container>
    </Box>
  );
}
