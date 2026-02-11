import { alpha, Box, Typography, useTheme } from '@mui/material';
import { BookOpen, HelpCircle, Sparkles } from 'lucide-react';

const STARTER_PROMPTS = [
  { label: 'What do I have in my library?', icon: <BookOpen size={14} /> },
  { label: 'Summarize my latest uploads', icon: <Sparkles size={14} /> },
  { label: 'Help me find a needle in the haystack', icon: <HelpCircle size={14} /> },
];

interface ChatEmptyStateProps {
  onPromptClick: (prompt: string) => void;
}

function SketchIllustration() {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  return (
    <Box sx={{ width: 120, height: 100, color: alpha(ct, 0.12), mb: 1 }}>
      <svg viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Stack of papers / documents */}
        <path
          d="M30 75 Q28 74 29 30 Q29.5 28 32 27 L72 25 Q75 24.5 76 27 L77 72 Q77.5 75 75 76 Z"
          fill="currentColor"
          opacity="0.4"
        />
        <path
          d="M35 72 Q33 71 34 28 Q34.5 26 37 25 L77 23 Q80 22.5 81 25 L82 69 Q82.5 72 80 73 Z"
          fill="currentColor"
          opacity="0.6"
        />
        <path
          d="M40 70 Q38 69 39 24 Q39.5 22 42 21 L82 19 Q85 18.5 86 21 L87 67 Q87.5 70 85 71 Z"
          fill="currentColor"
          opacity="0.9"
          stroke="currentColor"
          strokeWidth="0.5"
        />
        {/* Lines on top page */}
        <line x1="48" y1="32" x2="78" y2="31" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
        <line x1="48" y1="39" x2="74" y2="38" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        <line x1="48" y1="46" x2="70" y2="45.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
        {/* Magnifying glass */}
        <circle cx="28" cy="38" r="11" stroke="currentColor" strokeWidth="2" opacity="0.7" />
        <line x1="36" y1="46" x2="44" y2="55" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
        {/* Little sparkle */}
        <path d="M90 14 L91 10 L92 14 L96 15 L92 16 L91 20 L90 16 L86 15 Z" fill="currentColor" opacity="0.5" />
        <path d="M18 60 L19 57 L20 60 L23 61 L20 62 L19 65 L18 62 L15 61 Z" fill="currentColor" opacity="0.35" />
      </svg>
    </Box>
  );
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
      }}
    >
      <SketchIllustration />

      <Typography
        variant="h5"
        className="font-serif"
        sx={{ color: 'text.primary', fontWeight: 600, fontSize: '1.5rem' }}
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
              borderRadius: 2,
              border: '1px solid',
              borderColor: alpha(ct, 0.08),
              cursor: 'pointer',
              transition: 'all 120ms ease',
              '&:hover': {
                borderColor: alpha(ct, 0.15),
                bgcolor: alpha(ct, 0.03),
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
