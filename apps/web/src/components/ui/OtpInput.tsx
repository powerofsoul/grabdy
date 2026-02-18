import { useCallback, useRef } from 'react';

import { Box } from '@mui/material';

const DIGIT_COUNT = 6;

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  autoFocus?: boolean;
}

export function OtpInput({ value, onChange, error, autoFocus }: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const getDigits = useCallback((): string[] => {
    const chars = value.split('');
    return Array.from({ length: DIGIT_COUNT }, (_, i) => chars[i] ?? '');
  }, [value]);

  const focusInput = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, DIGIT_COUNT - 1));
    inputRefs.current[clamped]?.focus();
  }, []);

  const setDigits = useCallback(
    (next: string[]) => {
      onChange(next.join(''));
    },
    [onChange]
  );

  const handleInput = useCallback(
    (index: number, e: React.FormEvent<HTMLInputElement>) => {
      const inputValue = e.currentTarget.value.replace(/\D/g, '');
      if (!inputValue) return;

      const digits = getDigits();

      if (inputValue.length > 1) {
        const pasted = inputValue.slice(0, DIGIT_COUNT - index);
        const next = [...digits];
        for (let i = 0; i < pasted.length; i++) {
          next[index + i] = pasted[i];
        }
        setDigits(next);
        focusInput(index + pasted.length);
        return;
      }

      const next = [...digits];
      next[index] = inputValue[0];
      setDigits(next);
      focusInput(index + 1);
    },
    [getDigits, setDigits, focusInput]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      const digits = getDigits();

      if (e.key === 'Backspace') {
        e.preventDefault();
        const next = [...digits];
        if (digits[index]) {
          next[index] = '';
          setDigits(next);
        } else if (index > 0) {
          next[index - 1] = '';
          setDigits(next);
          focusInput(index - 1);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        focusInput(index - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        focusInput(index + 1);
      }
    },
    [getDigits, setDigits, focusInput]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, DIGIT_COUNT);
      if (pasted) {
        onChange(pasted);
        focusInput(Math.min(pasted.length, DIGIT_COUNT - 1));
      }
    },
    [onChange, focusInput]
  );

  const digits = getDigits();

  return (
    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
      {digits.map((digit, i) => (
        <Box
          key={i}
          component="input"
          ref={(el: HTMLInputElement | null) => {
            inputRefs.current[i] = el;
          }}
          value={digit}
          onInput={(e: React.FormEvent<HTMLInputElement>) => handleInput(i, e)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.target.select()}
          autoFocus={autoFocus && i === 0}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label={`Digit ${i + 1}`}
          maxLength={2}
          sx={{
            width: 48,
            height: 56,
            border: '1px solid',
            borderColor: error ? 'error.main' : 'grey.700',
            borderRadius: 2,
            bgcolor: 'transparent',
            color: 'text.primary',
            fontSize: '1.5rem',
            fontWeight: 600,
            textAlign: 'center',
            outline: 'none',
            caretColor: 'primary.main',
            fontFamily: 'inherit',
            '&:focus': {
              borderColor: error ? 'error.main' : 'primary.main',
              borderWidth: 2,
            },
          }}
        />
      ))}
    </Box>
  );
}
