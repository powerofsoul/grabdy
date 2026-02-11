import { useCallback, useEffect, useRef, useState } from 'react';

import { alpha, Box, IconButton, useTheme } from '@mui/material';
import { ArrowUp } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void | Promise<void>;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  elevated?: boolean;
}

export function ChatInput({
  onSend,
  isStreaming,
  disabled = false,
  placeholder = 'Ask anything about your documents...',
  elevated = false,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  useEffect(() => {
    if (!isStreaming && !disabled) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, disabled]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  const handleSend = useCallback(async () => {
    const messageToSend = input.trim();
    if (!messageToSend || isStreaming || disabled) return;

    setInput('');

    try {
      await Promise.resolve(onSend(messageToSend));
    } catch (err) {
      setInput((current) => current || messageToSend);
      console.error('Failed to send message:', err);
    }
  }, [input, isStreaming, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const hasInput = input.trim().length > 0;

  return (
    <Box
      sx={{
        px: { xs: 2, md: 3 },
        pb: elevated ? 0 : 2,
        pt: elevated ? 0 : 1,
        ...(elevated ? {} : {
          borderTop: '1px solid',
          borderColor: alpha(ct, 0.06),
        }),
        flexShrink: 0,
      }}
    >
      <Box
        sx={{
          maxWidth: 720,
          mx: 'auto',
          width: '100%',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 1,
            px: 2.5,
            py: 1.5,
            borderRadius: elevated ? 3 : 2,
            border: '1px solid',
            borderColor: focused ? alpha(ct, 0.15) : alpha(ct, 0.08),
            bgcolor: elevated ? 'background.paper' : 'transparent',
            boxShadow: elevated
              ? `0 2px 12px ${alpha(ct, 0.06)}, 0 0 0 1px ${alpha(ct, focused ? 0.12 : 0.04)}`
              : 'none',
            transition: 'border-color 150ms ease, box-shadow 150ms ease',
          }}
        >
          <Box
            component="textarea"
            ref={inputRef}
            value={input}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={isStreaming || disabled}
            placeholder={placeholder}
            rows={1}
            sx={{
              flex: 1,
              border: 'none',
              outline: 'none',
              resize: 'none',
              bgcolor: 'transparent',
              color: 'text.primary',
              fontSize: elevated ? '0.9rem' : '0.85rem',
              lineHeight: 1.6,
              p: 0,
              fontFamily: 'inherit',
              '&::placeholder': {
                color: alpha(ct, 0.3),
              },
              '&:disabled': {
                opacity: 0.5,
              },
            }}
          />
          <IconButton
            onClick={handleSend}
            disabled={!hasInput || isStreaming || disabled}
            size="small"
            sx={{
              width: 28,
              height: 28,
              borderRadius: '8px',
              bgcolor: hasInput ? 'text.primary' : alpha(ct, 0.06),
              color: hasInput ? 'background.default' : alpha(ct, 0.2),
              transition: 'all 150ms ease',
              '&:hover': {
                bgcolor: hasInput ? alpha(ct, 0.85) : alpha(ct, 0.1),
              },
              '&.Mui-disabled': {
                bgcolor: alpha(ct, 0.06),
                color: alpha(ct, 0.2),
              },
            }}
          >
            <ArrowUp size={16} strokeWidth={2.5} />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}
