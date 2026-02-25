import { useState } from 'react';

import { alpha, Box, Typography, useTheme } from '@mui/material';
import { ArrowUpIcon, ChatCircleDotsIcon, XIcon } from '@phosphor-icons/react';

import { SAMPLE_MESSAGES } from '../constants';

export function MockWidget() {
  const theme = useTheme();
  const [open, setOpen] = useState(true);

  const textPrimary = theme.palette.text.primary;
  const primaryColor = theme.palette.primary.main;

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: { xs: 280, md: 320 },
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      {/* Chat popup */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 72,
          right: 16,
          width: { xs: 260, md: 300 },
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          boxShadow: `0 12px 40px ${alpha(theme.palette.common.black, 0.15)}`,
          zIndex: 2,
          pointerEvents: 'auto',
          transform: open ? 'scale(1) translateY(0)' : 'scale(0.9) translateY(10px)',
          opacity: open ? 1 : 0,
          transformOrigin: 'bottom right',
          transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 1.5,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            borderBottom: 1,
            borderColor: 'divider',
            minHeight: 44,
          }}
        >
          <Box
            sx={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              bgcolor: primaryColor,
              flexShrink: 0,
            }}
          />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            YourCompany
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Box
            onClick={() => setOpen(false)}
            sx={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: 'text.secondary',
              pointerEvents: 'auto',
              '&:hover': { color: 'text.primary' },
            }}
          >
            <XIcon size={18} weight="light" />
          </Box>
        </Box>

        {/* Messages */}
        <Box
          sx={{
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {SAMPLE_MESSAGES.map((msg, i) => (
            <Box
              key={i}
              sx={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'stretch',
              }}
            >
              {msg.role === 'user' ? (
                <Box
                  sx={{
                    maxWidth: '85%',
                    px: 2,
                    py: 1.25,
                    bgcolor: alpha(textPrimary, 0.06),
                  }}
                >
                  <Typography sx={{ fontSize: '0.75rem', lineHeight: 1.6 }}>{msg.text}</Typography>
                </Box>
              ) : (
                <Box
                  sx={{
                    width: '100%',
                    px: 2,
                    py: 1.25,
                    borderLeft: 2,
                    borderColor: primaryColor,
                  }}
                >
                  <Typography sx={{ fontSize: '0.75rem', lineHeight: 1.6 }}>{msg.text}</Typography>
                </Box>
              )}
            </Box>
          ))}
        </Box>

        {/* Input bar */}
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            borderBottom: `1px solid ${textPrimary}`,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Typography
            sx={{
              flex: 1,
              fontSize: '0.75rem',
              color: alpha(textPrimary, 0.3),
              lineHeight: 1.6,
            }}
          >
            Ask a question...
          </Typography>
          <Box
            sx={{
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(textPrimary, 0.06),
              color: alpha(textPrimary, 0.2),
            }}
          >
            <ArrowUpIcon size={14} weight="bold" />
          </Box>
        </Box>
      </Box>

      {/* Bubble button */}
      <Box
        onClick={() => setOpen((prev) => !prev)}
        sx={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          width: 48,
          height: 48,
          borderRadius: '50%',
          bgcolor: textPrimary,
          color: 'background.default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          pointerEvents: 'auto',
          boxShadow: `0 4px 16px ${alpha(textPrimary, 0.3)}`,
          zIndex: 2,
          transition: 'transform 0.2s ease',
          '&:hover': { transform: 'scale(1.08)' },
        }}
      >
        <ChatCircleDotsIcon size={24} weight="fill" />
      </Box>
    </Box>
  );
}
