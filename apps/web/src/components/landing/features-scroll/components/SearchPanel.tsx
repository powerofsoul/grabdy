import { alpha, Box, Typography, useTheme } from '@mui/material';

import { GoogleDriveLogo, NotionLogo } from '../../IntegrationLogos';

const QUERY = "What's the indemnification cap in the Acme MSA?";
const ANSWER =
  'Mutual indemnification capped at 2x annual fees per Section 9.3. Carve-outs for IP infringement and data breach are uncapped.';
const SOURCES = [
  { Logo: GoogleDriveLogo, name: 'acme-msa-2023.pdf' },
  { Logo: NotionLogo, name: 'Vendor Tracker' },
] as const;

export function SearchPanel() {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  return (
    <Box
      sx={{
        maxWidth: 520,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {/* User message */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Box
          sx={{
            maxWidth: '80%',
            px: 2.5,
            py: 1.5,
            borderRadius: '18px 18px 4px 18px',
            bgcolor: alpha(ct, 0.08),
          }}
        >
          <Typography sx={{ fontSize: '0.95rem', lineHeight: 1.5, color: 'text.primary' }}>
            {QUERY}
          </Typography>
        </Box>
      </Box>

      {/* Assistant response */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
        <Box sx={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box
            sx={{
              px: 2.5,
              py: 1.5,
              borderRadius: '18px 18px 18px 4px',
              bgcolor: alpha(ct, 0.04),
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary', lineHeight: 1.7 }}>
              {ANSWER}
            </Typography>
          </Box>

          {/* Source pills */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 1 }}>
            {SOURCES.map((src) => (
              <Box
                key={src.name}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1,
                  py: 0.25,
                  borderRadius: 1,
                  bgcolor: alpha(ct, 0.04),
                }}
              >
                <src.Logo size={14} />
                <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                  {src.name}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
