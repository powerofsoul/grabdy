import { alpha, Box, Typography, useTheme } from '@mui/material';
import { EnvelopeSimpleIcon } from '@phosphor-icons/react';

import { GmailLogo } from '../../IntegrationLogos';

import botLogo from '@/assets/grabdy-logo.jpg';

const FONT_PANEL = '"Lato", "Helvetica Neue", Helvetica, sans-serif';

const QUESTION = 'Which contracts auto-renew in the next 90 days?';

const APP_ANSWER =
  'Three contracts auto-renew before June 30: Acme MSA (May 15, 90-day notice), Contoso SaaS Agreement (June 1, 60-day notice), and Northwind NDA (June 28, 30-day notice).';

const EMAIL_ANSWER =
  'Renewal alert: Acme MSA auto-renews on May 15. 90-day written notice required to terminate. Current annual value is $240,000. Action needed by Feb 14.';

const SOURCES = [
  { icon: '\uD83D\uDCC4', name: 'acme-msa-2023.pdf', detail: 'Section 12.1' },
  { icon: '\uD83D\uDCC5', name: 'contoso-agreement.pdf', detail: 'Section 8.4' },
  { icon: '\uD83D\uDCC4', name: 'northwind-nda.pdf', detail: 'Section 5.2' },
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
      {/* Dashboard view */}
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
          Dashboard
        </Typography>
        <AppView />
      </Box>

      {/* Email alert view */}
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
          Email alert
        </Typography>
        <EmailAlertView />
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
            Contract Search
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

function EmailAlertView() {
  const theme = useTheme();
  const codeText = theme.palette.kindle.codeBlockText;
  const syntaxKey = theme.palette.kindle.syntaxKey;
  const syntaxNumber = theme.palette.kindle.syntaxNumber;

  const border = alpha(codeText, 0.1);
  const borderSubtle = alpha(codeText, 0.06);
  const textDim = alpha(codeText, 0.5);
  const linkColor = syntaxNumber;
  const emailBg = theme.palette.kindle.codeBlockBg;

  return (
    <Box
      sx={{
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: emailBg,
        border: '1px solid',
        borderColor: border,
        boxShadow: theme.shadows[2],
      }}
    >
      {/* Email header */}
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
        <GmailLogo size={14} />
        <EnvelopeSimpleIcon size={12} weight="bold" color={codeText} />
        <Typography
          sx={{
            fontFamily: FONT_PANEL,
            fontSize: '0.72rem',
            fontWeight: 700,
            color: codeText,
          }}
        >
          Renewal Alert
        </Typography>
      </Box>

      <Box sx={{ px: 1.5, py: 1.5 }}>
        {/* Email metadata */}
        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start', mb: 1.5 }}>
          <Box
            sx={{
              width: 24,
              height: 24,
              borderRadius: '4px',
              bgcolor: alpha(syntaxKey, 0.25),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Box
              component="img"
              src={botLogo}
              alt="Grabdy"
              sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.4, mb: 0.2 }}>
              <Typography
                sx={{
                  fontFamily: FONT_PANEL,
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: codeText,
                }}
              >
                Grabdy Alerts
              </Typography>
              <Typography sx={{ fontFamily: FONT_PANEL, fontSize: '0.58rem', color: textDim }}>
                8:00 AM
              </Typography>
            </Box>
            <Typography
              sx={{
                fontFamily: FONT_PANEL,
                fontSize: '0.62rem',
                lineHeight: 1.4,
                color: textDim,
                mb: 0.5,
              }}
            >
              To: legal@yourcompany.com
            </Typography>
          </Box>
        </Box>

        {/* Email body */}
        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start' }}>
          <Box sx={{ width: 24, flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontFamily: FONT_PANEL,
                fontSize: '0.7rem',
                fontWeight: 700,
                color: codeText,
                mb: 0.5,
              }}
            >
              Upcoming auto-renewal: Acme MSA
            </Typography>
            <Typography
              sx={{
                fontFamily: FONT_PANEL,
                fontSize: '0.7rem',
                lineHeight: 1.6,
                color: codeText,
                mb: 0.75,
              }}
            >
              {EMAIL_ANSWER}
            </Typography>
            {SOURCES.map((s) => (
              <Typography
                key={s.name}
                sx={{
                  fontFamily: FONT_PANEL,
                  fontSize: '0.62rem',
                  lineHeight: 1.5,
                  color: textDim,
                }}
              >
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
