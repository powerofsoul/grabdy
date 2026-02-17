import { useEffect, useRef } from 'react';

import { alpha, Box, Container, Typography, useTheme } from '@mui/material';
import { HashIcon } from '@phosphor-icons/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import botLogo from '@/assets/grabdy-logo.jpg';
import { SlackLogo } from '@/components/landing/IntegrationLogos';

gsap.registerPlugin(ScrollTrigger);

const FONT_SLACK = '"Lato", "Helvetica Neue", Helvetica, sans-serif';

export function SlackBotSection() {
  const theme = useTheme();
  const sectionRef = useRef<HTMLDivElement>(null);

  const codeText = theme.palette.kindle.codeBlockText;
  const syntaxKey = theme.palette.kindle.syntaxKey;
  const syntaxNumber = theme.palette.kindle.syntaxNumber;

  const border = alpha(codeText, 0.1);
  const borderSubtle = alpha(codeText, 0.06);
  const textDim = alpha(codeText, 0.5);
  const mentionBg = alpha(syntaxKey, 0.12);
  const mentionColor = syntaxKey;
  const linkColor = syntaxNumber;

  // The whole Slack window is always dark (codeBlockBg).
  // Sidebar is a slightly lighter shade layered on top.
  const channelBg = theme.palette.kindle.codeBlockBg;

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: sectionRef.current, start: 'top 80%' },
      });
      tl.from('.slack-heading', { y: 30, opacity: 0, duration: 0.6, ease: 'power2.out' });
      tl.from('.slack-window', { y: 30, opacity: 0, duration: 0.5, ease: 'power2.out' }, '-=0.3');
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <Box
      ref={sectionRef}
      sx={{ py: { xs: 8, md: 10 }, bgcolor: 'background.default' }}
    >
      <Container maxWidth="lg">
        {/* Heading */}
        <Box className="slack-heading" sx={{ mb: { xs: 4, md: 5 }, maxWidth: 560 }}>
          <Typography
            variant="overline"
            sx={{ color: 'text.secondary', mb: 1.5, display: 'block' }}
          >
            Slack Integration
          </Typography>
          <Typography
            variant="h3"
            sx={{
              fontSize: { xs: '1.5rem', md: '1.75rem' },
              mb: 2,
              color: 'text.primary',
            }}
          >
            Your knowledge base, right where your team works.
          </Typography>
          <Typography
            sx={{
              color: 'text.secondary',
              fontSize: '0.95rem',
              lineHeight: 1.7,
            }}
          >
            Your team already lives in Slack. @mention Grabdy in any channel and
            get cited answers from every source you&apos;ve connected. No
            tab-switching, no context lost.
          </Typography>
        </Box>

        {/* Slack window — always dark regardless of site theme */}
        <Box
          className="slack-window"
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: channelBg,
            border: '1px solid',
            borderColor: border,
            display: 'flex',
            flexDirection: 'row',
          }}
        >
          {/* Sidebar */}
          <Box
            sx={{
              width: { xs: 52, md: 200 },
              flexShrink: 0,
              bgcolor: alpha(codeText, 0.06),
              borderRight: '1px solid',
              borderColor: borderSubtle,
              py: 1.5,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Workspace name */}
            <Box sx={{ px: { xs: 1, md: 2 }, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <SlackLogo size={20} />
              <Typography
                sx={{
                  fontFamily: FONT_SLACK,
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  color: codeText,
                  display: { xs: 'none', md: 'block' },
                }}
              >
                Acme Inc
              </Typography>
            </Box>

            {/* Channel list */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              <SidebarChannel name="general" textColor={alpha(codeText, 0.45)} />
              <SidebarChannel name="product-team" textColor={codeText} activeBg={alpha(codeText, 0.1)} active />
              <SidebarChannel name="engineering" textColor={alpha(codeText, 0.45)} />
              <SidebarChannel name="design" textColor={alpha(codeText, 0.45)} />
            </Box>
          </Box>

          {/* Main channel area */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Channel header */}
            <Box
              sx={{
                px: { xs: 2, md: 2.5 },
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
                product-team
              </Typography>
            </Box>

            {/* Messages */}
            <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2, flex: 1 }}>
              {/* User message */}
              <Box
                sx={{
                  display: 'flex',
                  gap: 1.25,
                  alignItems: 'flex-start',
                  mb: 2.5,
                  py: 0.5,
                }}
              >
                {/* User avatar */}
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
                    SC
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
                      Sarah Chen
                    </Typography>
                    <Typography
                      sx={{
                        fontFamily: FONT_SLACK,
                        fontSize: '0.72rem',
                        color: textDim,
                      }}
                    >
                      2:42 PM
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
                    </Box>
                    {' '}What was decided about the Q2 pricing changes for enterprise tier?
                  </Typography>
                </Box>
              </Box>

              {/* Bot message */}
              <Box
                sx={{
                  display: 'flex',
                  gap: 1.25,
                  alignItems: 'flex-start',
                  py: 0.5,
                }}
              >
                {/* Bot avatar — svg-1 logo */}
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
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                    }}
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
                    <Typography
                      sx={{
                        fontFamily: FONT_SLACK,
                        fontSize: '0.72rem',
                        color: textDim,
                      }}
                    >
                      2:42 PM
                    </Typography>
                  </Box>

                  {/* Bot response */}
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
                    Based on the Q2 Pricing Review and the discussion in #pricing-team:
                    enterprise tier pricing will increase from $89/seat to $99/seat,
                    effective July 1st. Existing annual contracts are grandfathered at
                    the current rate through renewal. A 15% volume discount now applies
                    to teams over 200 seats.
                  </Typography>

                  {/* Sources */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    {[
                      { name: 'Q2-pricing-review.pdf', detail: 'page 3' },
                      { name: '#pricing-team', detail: 'discussion (Apr 2)' },
                      { name: 'PROD-892', detail: 'Linear' },
                    ].map((s) => (
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
                        <Box component="span" sx={{ color: linkColor }}>{s.name}</Box>
                        {' '}{s.detail}
                      </Typography>
                    ))}
                  </Box>

                  {/* Thread indicator */}
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
      </Container>
    </Box>
  );
}

/* ── Sidebar channel item ── */

function SidebarChannel({
  name,
  textColor,
  activeBg,
  active,
}: {
  name: string;
  textColor: string;
  activeBg?: string;
  active?: boolean;
}) {
  return (
    <Box
      sx={{
        px: { xs: 1, md: 2 },
        py: 0.5,
        bgcolor: active ? activeBg : 'transparent',
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
      }}
    >
      <Typography
        sx={{
          fontFamily: FONT_SLACK,
          fontSize: '0.82rem',
          color: textColor,
          fontWeight: active ? 700 : 400,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: { xs: 'none', md: 'block' },
        }}
      >
        # {name}
      </Typography>
      <Typography
        sx={{
          fontFamily: FONT_SLACK,
          fontSize: '0.72rem',
          color: textColor,
          fontWeight: active ? 700 : 400,
          display: { xs: 'block', md: 'none' },
        }}
      >
        #
      </Typography>
    </Box>
  );
}
