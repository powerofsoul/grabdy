import { memo, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

import { Box } from '@mui/material';

import { FONT_MONO } from '@/theme';

const CHARS_PER_TICK = 3;
const TICK_MS = 12;

interface ThinkingBlockProps {
  text: string;
  animate: boolean;
}

export const ThinkingBlock = memo(function ThinkingBlock({ text, animate }: ThinkingBlockProps) {
  const [revealed, setRevealed] = useState(animate ? 0 : text.length);
  const [trackedText, setTrackedText] = useState(text);
  const [trackedAnimate, setTrackedAnimate] = useState(animate);

  // Reset revealed when text or animate changes
  if (text !== trackedText || animate !== trackedAnimate) {
    setTrackedText(text);
    setTrackedAnimate(animate);
    setRevealed(animate ? 0 : text.length);
  }

  // Tick to reveal characters
  useEffect(() => {
    if (!animate || revealed >= text.length) return;

    const timer = setTimeout(() => {
      setRevealed((prev) => Math.min(prev + CHARS_PER_TICK, text.length));
    }, TICK_MS);

    return () => clearTimeout(timer);
  }, [animate, revealed, text.length]);

  const displayed = text.slice(0, revealed);

  return (
    <Box
      sx={{
        fontSize: '0.75rem',
        color: 'text.secondary',
        lineHeight: 1.5,
        '& + &': { mt: 0.5 },
        '& p': { m: 0, fontSize: 'inherit', lineHeight: 'inherit' },
        '& p + p': { mt: 0.5 },
        '& code': {
          fontFamily: FONT_MONO,
          bgcolor: 'grey.100',
          px: 0.5,
          py: 0.25,
          borderRadius: 0.5,
          fontSize: 'inherit',
        },
      }}
    >
      <ReactMarkdown>{displayed}</ReactMarkdown>
    </Box>
  );
});
