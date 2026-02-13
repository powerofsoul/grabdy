import { alpha, Box, Typography, useTheme } from '@mui/material';
import { BookOpen, Question, Sparkle } from '@phosphor-icons/react';

import svg3 from '@/assets/watermarks/svg-3.svg';
const STARTER_PROMPTS = [
  { label: 'What do I have in my library?', icon: <BookOpen size={14} weight="light" color="currentColor" /> },
  { label: 'Summarize my latest uploads', icon: <Sparkle size={14} weight="light" color="currentColor" /> },
  { label: 'Help me find a needle in the haystack', icon: <Question size={14} weight="light" color="currentColor" /> },
];

interface ChatEmptyStateProps {
  onPromptClick: (prompt: string) => void;
}

export function ChatEmptyState({ onPromptClick }: ChatEmptyStateProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
        position: 'relative',
      }}
    >
      {/* Watermark SVG */}
      <Box
        component="img"
        src={svg3}
        alt=""
        sx={{
          width: 200,
          height: 200,
          opacity: theme.palette.mode === 'dark' ? 0.05 : 0.08,
          mixBlendMode: theme.palette.mode === 'dark' ? 'screen' : 'multiply',
          filter: theme.palette.mode === 'dark' ? 'invert(1)' : 'none',
          mb: 1,
          pointerEvents: 'none',
        }}
      />

      <Typography
        variant="h4"
      >
        Your documents await
      </Typography>
      <Typography
        sx={{ color: alpha(ct, 0.4), fontSize: 14, mb: 1.5 }}
      >
        Ask anything — they don&apos;t bite.
      </Typography>

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 1,
        }}
      >
        {STARTER_PROMPTS.map((prompt, index) => (
          <Box
            key={index}
            onClick={() => onPromptClick(prompt.label)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.5,
              py: 0.75,
              border: '1px solid',
              borderColor: alpha(ct, 0.12),
              cursor: 'pointer',
              transition: 'all 120ms ease',
              '&:hover': {
                borderColor: ct,
                bgcolor: alpha(ct, 0.02),
              },
            }}
          >
            <Box sx={{ display: 'flex', color: alpha(ct, 0.35) }}>
              {prompt.icon}
            </Box>
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
              {prompt.label}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
