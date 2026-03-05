import { alpha, Box, Typography, useTheme } from '@mui/material';
import { HashIcon } from '@phosphor-icons/react';

import { SlackLogo } from '../../IntegrationLogos';

import botLogo from '@/assets/grabdy-logo.jpg';

const FONT_SLACK = '"Lato", "Helvetica Neue", Helvetica, sans-serif';

const QUESTION = 'What was decided about the Q2 pricing changes?';

const APP_ANSWER =
  'Enterprise tier pricing increases from $89/seat to $99/seat effective July 1st. Existing annual contracts are grandfathered. A 15% volume discount now applies to teams over 200 seats.';

const SLACK_ANSWER =
  'Based on the Q2 Pricing Review: enterprise tier pricing will increase from $89/seat to $99/seat, effective July 1st. Annual contracts are grandfathered.';

const SOURCES = [
  { icon: '\uD83D\uDCC4', name: 'Q2-pricing-review.pdf', detail: 'page 3' },
  { icon: '\uD83D\uDCAC', name: '#pricing-team', detail: 'discussion' },
  { icon: '\uD83D\uDCCB', name: 'PROD-892', detail: 'Linear' },
] as const;

export function InterfacePanel() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        gap: 2,
        alignItems: 'flex-start',
      }}
    >
      {/* Web App view */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: '0.7rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'text.secondary',
            mb: 1,
          }}
        >
          Web App
        </Typography>
        <AppView />
      </Box>

      {/* Slack view */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: '0.7rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'text.secondary',
            mb: 1,
          }}
        >
          Slack
        </Typography>
        <SlackView />
      </Box>
    </Box>
  );
}

function AppView() {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  return (
    <Box
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: theme.shadows[2],
      }}
    >
      {/* Title bar */}
      <Box
        sx={{
          px: 1.5,
          py: 0.75,
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          borderBottom: '1px solid',
          borderColor: alpha(ct, 0.08),
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: alpha(ct, 0.12) }}
            />
          ))}
        </Box>
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <Typography sx={{ color: alpha(ct, 0.4), fontSize: '0.65rem', fontWeight: 600 }}>
            Chat
          </Typography>
        </Box>
      </Box>

      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {/* User message */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Box
            sx={{
              maxWidth: '85%',
              px: 1.5,
              py: 1,
              borderRadius: '12px 12px 4px 12px',
              bgcolor: alpha(ct, 0.07),
            }}
          >
            <Typography sx={{ fontSize: '0.75rem', lineHeight: 1.5 }}>{QUESTION}</Typography>
          </Box>
        </Box>

        {/* Assistant response */}
        <Box
          sx={{
            px: 1.5,
            py: 1,
            borderRadius: '12px 12px 12px 4px',
            bgcolor: alpha(ct, 0.03),
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', lineHeight: 1.7 }}>
            {APP_ANSWER}
          </Typography>
        </Box>

        {/* Sources */}
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {SOURCES.map((s) => (
            <Box
              key={s.name}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.4,
                px: 0.6,
                py: 0.2,
                borderRadius: 0.75,
                bgcolor: alpha(ct, 0.04),
              }}
            >
              <Typography sx={{ fontSize: '0.58rem' }}>{s.icon}</Typography>
              <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>{s.name}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function SlackView() {
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
        boxShadow: theme.shadows[2],
      }}
    >
      {/* Channel header */}
      <Box
        sx={{
          px: 1.5,
          py: 0.75,
          borderBottom: '1px solid',
          borderColor: borderSubtle,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        <SlackLogo size={14} />
        <HashIcon size={12} weight="bold" color={codeText} />
        <Typography
          sx={{
            fontFamily: FONT_SLACK,
            fontSize: '0.72rem',
            fontWeight: 700,
            color: codeText,
          }}
        >
          product-team
        </Typography>
      </Box>

      <Box sx={{ px: 1.5, py: 1.5 }}>
        {/* User message */}
        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start', mb: 1.5 }}>
          <Box
            sx={{
              width: 24,
              height: 24,
              borderRadius: '4px',
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
                fontSize: '0.52rem',
                fontWeight: 700,
                color: codeText,
              }}
            >
              SC
            </Typography>
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.4, mb: 0.2 }}>
              <Typography
                sx={{
                  fontFamily: FONT_SLACK,
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: codeText,
                }}
              >
                Sarah Chen
              </Typography>
              <Typography sx={{ fontFamily: FONT_SLACK, fontSize: '0.58rem', color: textDim }}>
                2:42 PM
              </Typography>
            </Box>
            <Typography
              sx={{
                fontFamily: FONT_SLACK,
                fontSize: '0.7rem',
                lineHeight: 1.6,
                color: codeText,
              }}
            >
              <Box
                component="span"
                sx={{
                  bgcolor: mentionBg,
                  color: mentionColor,
                  borderRadius: '3px',
                  px: 0.3,
                  fontWeight: 600,
                }}
              >
                @Grabdy
              </Box>{' '}
              {QUESTION}
            </Typography>
          </Box>
        </Box>

        {/* Bot response */}
        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start' }}>
          <Box
            sx={{
              width: 24,
              height: 24,
              borderRadius: '4px',
              bgcolor: 'common.white',
              flexShrink: 0,
              overflow: 'hidden',
              p: '2px',
            }}
          >
            <Box
              component="img"
              src={botLogo}
              alt="Grabdy bot"
              sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.4, mb: 0.2 }}>
              <Typography
                sx={{
                  fontFamily: FONT_SLACK,
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: codeText,
                }}
              >
                Grabdy
              </Typography>
              <Box
                sx={{
                  px: 0.3,
                  py: 0.1,
                  borderRadius: '3px',
                  bgcolor: alpha(codeText, 0.12),
                  lineHeight: 1,
                }}
              >
                <Typography
                  sx={{
                    fontFamily: FONT_SLACK,
                    fontSize: '0.48rem',
                    fontWeight: 700,
                    color: textDim,
                    letterSpacing: '0.03em',
                  }}
                >
                  APP
                </Typography>
              </Box>
            </Box>
            <Typography
              sx={{
                fontFamily: FONT_SLACK,
                fontSize: '0.7rem',
                lineHeight: 1.6,
                color: codeText,
                mb: 0.75,
              }}
            >
              {SLACK_ANSWER}
            </Typography>
            {SOURCES.map((s) => (
              <Typography
                key={s.name}
                sx={{
                  fontFamily: FONT_SLACK,
                  fontSize: '0.62rem',
                  lineHeight: 1.5,
                  color: textDim,
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
        </Box>
      </Box>
    </Box>
  );
}
