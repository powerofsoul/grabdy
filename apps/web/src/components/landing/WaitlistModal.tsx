import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';

import {
  alpha,
  Box,
  Button,
  CircularProgress,
  Dialog,
  IconButton,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { CheckCircle, Sparkle, X } from '@phosphor-icons/react';



const SLACK_WEBHOOK_URL =
  'https://hooks.slack.com/services/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';

interface WaitlistContextType {
  open: () => void;
}

const WaitlistContext = createContext<WaitlistContextType | null>(null);

export function useWaitlist() {
  const ctx = useContext(WaitlistContext);
  if (!ctx) throw new Error('useWaitlist must be used within WaitlistProvider');
  return ctx;
}

export function WaitlistProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <WaitlistContext.Provider value={{ open }}>
      {children}
      <WaitlistDialog open={isOpen} onClose={close} />
    </WaitlistContext.Provider>
  );
}

function WaitlistDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    onClose();
    // Reset after animation
    setTimeout(() => {
      setName('');
      setEmail('');
      setSubmitted(false);
      setError('');
    }, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setIsSubmitting(true);
    setError('');

    try {
      await fetch(SLACK_WEBHOOK_URL, {
        method: 'POST',
        body: JSON.stringify({
          text: `New waitlist signup:\n*Name:* ${name.trim()}\n*Email:* ${email.trim()}`,
        }),
      });
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          overflow: 'hidden',
          bgcolor: 'background.paper',
        },
      }}
    >
      {/* Close button */}
      <IconButton
        onClick={handleClose}
        sx={{
          position: 'absolute',
          top: 12,
          right: 12,
          color: 'text.secondary',
          zIndex: 1,
        }}
      >
        <X size={18} weight="light" color="currentColor" />
      </IconButton>

      {submitted ? (
        /* Success state */
        <Box sx={{ px: 4, py: 6, textAlign: 'center' }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 1,
              bgcolor: alpha(primary, 0.08),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2.5,
            }}
          >
            <CheckCircle size={28} color={primary} weight="light" />
          </Box>
          <Typography variant="h4" sx={{ mb: 1 }}>
            You&apos;re on the list
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem', lineHeight: 1.6, mb: 3 }}>
            We&apos;ll reach out soon with early access details. Keep an eye on your inbox.
          </Typography>
          <Button
            variant="outlined"
            onClick={handleClose}
            sx={{ px: 4 }}
          >
            Done
          </Button>
        </Box>
      ) : (
        /* Form state */
        <Box sx={{ px: 4, py: 4 }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 3.5 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: alpha(primary, 0.08),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
              }}
            >
              <Sparkle size={24} color={primary} weight="light" />
            </Box>
            <Typography variant="h4" sx={{ mb: 0.75 }}>
              Join the Waitlist
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.88rem', lineHeight: 1.6 }}>
              Get early access to Grabdy. We&apos;re onboarding teams in batches.
            </Typography>
          </Box>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <TextField
              label="Name"
              placeholder="Your full name"
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              sx={{ mb: 2 }}
              autoFocus
            />
            <TextField
              label="Email"
              type="email"
              placeholder="you@company.com"
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              sx={{ mb: 3 }}
            />

            {error && (
              <Typography
                sx={{ color: 'error.main', fontSize: '0.82rem', mb: 2, textAlign: 'center' }}
              >
                {error}
              </Typography>
            )}

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={isSubmitting || !name.trim() || !email.trim()}
              sx={{
                py: 1.5,
                fontSize: '0.95rem',
              }}
            >
              {isSubmitting ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                'Join Waitlist'
              )}
            </Button>

            <Typography
              sx={{
                textAlign: 'center',
                mt: 2,
                fontSize: '0.75rem',
                color: 'text.disabled',
              }}
            >
              No spam. We&apos;ll only email you about access.
            </Typography>
          </form>
        </Box>
      )}
    </Dialog>
  );
}
