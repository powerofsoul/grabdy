import { useEffect, useState } from 'react';

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { Eye, EyeOff, Lock } from 'lucide-react';

import { AuthLayout } from '@/components/ui/AuthLayout';
import { api } from '@/lib/api';

interface SearchParams {
  token?: string;
}

export const Route = createFileRoute('/auth/complete-account')({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  component: CompleteAccountPage,
});

function CompleteAccountPage() {
  const navigate = useNavigate();
  const { token } = useSearch({ from: '/auth/complete-account' });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [isVerifying, setIsVerifying] = useState(true);
  const [inviteData, setInviteData] = useState<{
    email: string;
    name: string;
    orgName: string;
  } | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link');
      setIsVerifying(false);
      return;
    }

    const verify = async () => {
      try {
        const res = await api.auth.verifySetupToken({ body: { token } });
        if (res.status === 200) {
          setInviteData(res.body.data);
        } else if (res.status === 400) {
          setError(res.body.error);
        }
      } catch {
        setError('Invalid or expired invitation');
      } finally {
        setIsVerifying(false);
      }
    };

    verify();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !password) return;

    setIsSubmitting(true);
    setError('');

    try {
      const res = await api.auth.completeAccount({
        body: { token, password },
      });

      if (res.status === 200) {
        navigate({ to: '/dashboard' });
      } else if (res.status === 400) {
        setError(res.body.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete account setup');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isVerifying) {
    return (
      <AuthLayout title="Setting up..." showBack={false}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </AuthLayout>
    );
  }

  if (!inviteData) {
    return (
      <AuthLayout title="Invalid Invitation" showBack={false}>
        <Alert severity="error">{error || 'This invitation link is invalid or has expired.'}</Alert>
        <Button
          variant="text"
          onClick={() => navigate({ to: '/auth/login' })}
          sx={{ mt: 2 }}
        >
          Go to login
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Complete your account"
      subtitle={`You've been invited to join ${inviteData.orgName}`}
      showBack={false}
    >
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Setting up account for <strong>{inviteData.email}</strong>
        </Typography>
      </Box>

      <form onSubmit={handleSubmit}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <TextField
          label="Your Name"
          fullWidth
          value={inviteData.name}
          disabled
          sx={{ mb: 2 }}
        />

        <TextField
          label="Email"
          fullWidth
          value={inviteData.email}
          disabled
          sx={{ mb: 2 }}
        />

        <TextField
          label="Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Minimum 8 characters"
          fullWidth
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          sx={{ mb: 3 }}
          required
          helperText="Minimum 8 characters"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start" sx={{ color: 'text.disabled' }}>
                <Lock size={20} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                  size="small"
                  tabIndex={-1}
                  sx={{ color: 'text.disabled' }}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={isSubmitting || password.length < 8}
          sx={{ py: 1.5 }}
        >
          {isSubmitting && <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />}
          Create Account & Join
        </Button>
      </form>
    </AuthLayout>
  );
}
