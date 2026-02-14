import { useCallback, useEffect, useState } from 'react';

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
import { EnvelopeIcon, EyeIcon, EyeSlashIcon, LockIcon } from '@phosphor-icons/react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';

import { AuthLayout } from '@/components/ui/AuthLayout';
import { useAuth } from '@/context/AuthContext';

export const Route = createFileRoute('/auth/login')({
  component: LoginPage,
});

function LoginPage() {
  const { login, isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginInProgress, setLoginInProgress] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const getRedirectPath = useCallback(() => {
    if (!user) return '/dashboard';
    const membership = user.memberships[0];
    if (!membership) return '/dashboard';
    const hasAdmin = membership.roles.includes('OWNER') || membership.roles.includes('ADMIN');
    return hasAdmin ? '/dashboard' : '/app';
  }, [user]);

  // Redirect when auth state updates (fixes race condition with setUser batching)
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      navigate({ to: getRedirectPath() });
    }
  }, [isLoading, isAuthenticated, user, navigate, getRedirectPath]);

  useEffect(() => {
    if (loginInProgress && !isLoading && user) {
      navigate({ to: getRedirectPath() });
    }
  }, [loginInProgress, isLoading, user, navigate, getRedirectPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      setLoginInProgress(true);
      await login(email, password);
    } catch (err) {
      setLoginInProgress(false);
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Sign in" subtitle="Welcome back to Grabdy">
      <form onSubmit={handleSubmit}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <TextField
          label="Email"
          type="email"
          placeholder="you@example.com"
          fullWidth
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          sx={{ mb: 2 }}
          required
          InputProps={{
            startAdornment: (
              <InputAdornment position="start" sx={{ color: 'text.disabled' }}>
                <EnvelopeIcon size={20} weight="light" color="currentColor" />
              </InputAdornment>
            ),
          }}
        />

        <TextField
          label="Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Your password"
          fullWidth
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          sx={{ mb: 2 }}
          required
          InputProps={{
            startAdornment: (
              <InputAdornment position="start" sx={{ color: 'text.disabled' }}>
                <LockIcon size={20} weight="light" color="currentColor" />
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
                  {showPassword ? <EyeSlashIcon size={20} weight="light" color="currentColor" /> : <EyeIcon size={20} weight="light" color="currentColor" />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
          <Link to="/auth/forgot-password" style={{ textDecoration: 'none' }}>
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', fontSize: '0.875rem', '&:hover': { color: 'text.primary' } }}
            >
              Forgot password?
            </Typography>
          </Link>
        </Box>

        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={isSubmitting || loginInProgress}
          sx={{ py: 1.5, mb: 3 }}
        >
          {(isSubmitting || loginInProgress) && (
            <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />
          )}
          Sign in
        </Button>

      </form>
    </AuthLayout>
  );
}
