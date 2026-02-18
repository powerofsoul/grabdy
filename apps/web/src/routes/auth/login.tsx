import { useCallback, useEffect, useState } from 'react';

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { EnvelopeIcon, EyeIcon, EyeSlashIcon, LockIcon } from '@phosphor-icons/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { GoogleLogin } from '@react-oauth/google';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AuthLayout } from '@/components/ui/AuthLayout';
import { useAuth } from '@/context/AuthContext';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const Route = createFileRoute('/auth/login')({
  component: LoginPage,
});

function LoginPage() {
  const { login, googleAuth, isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [authInProgress, setAuthInProgress] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  });

  const getRedirectPath = useCallback(() => {
    if (!user) return '/dashboard';
    const membership = user.memberships[0];
    if (!membership) return '/dashboard';
    const hasAdmin = membership.roles.includes('OWNER') || membership.roles.includes('ADMIN');
    return hasAdmin ? '/dashboard' : '/app';
  }, [user]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      navigate({ to: getRedirectPath() });
    }
  }, [isLoading, isAuthenticated, user, navigate, getRedirectPath]);

  useEffect(() => {
    if (authInProgress && !isLoading && user) {
      navigate({ to: getRedirectPath() });
    }
  }, [authInProgress, isLoading, user, navigate, getRedirectPath]);

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) {
      setServerError('Google authentication failed');
      return;
    }

    setServerError('');

    try {
      setAuthInProgress(true);
      await googleAuth(credentialResponse.credential);
    } catch (err) {
      setAuthInProgress(false);
      setServerError(err instanceof Error ? err.message : 'Google authentication failed');
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    setServerError('');
    try {
      setAuthInProgress(true);
      await login(data.email, data.password);
    } catch (err) {
      setAuthInProgress(false);
      setServerError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const busy = isSubmitting || authInProgress;

  return (
    <AuthLayout title="Sign in" subtitle="Welcome back to Grabdy">
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => setServerError('Google authentication failed')}
          text="continue_with"
          shape="rectangular"
          width={400}
        />
      </Box>

      <Divider sx={{ mb: 3 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', px: 2 }}>
          or
        </Typography>
      </Divider>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {serverError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {serverError}
          </Alert>
        )}

        <TextField
          {...register('email')}
          label="Email"
          type="email"
          placeholder="you@example.com"
          fullWidth
          autoComplete="email"
          error={!!errors.email}
          helperText={errors.email?.message}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start" sx={{ color: 'text.disabled' }}>
                <EnvelopeIcon size={20} weight="light" color="currentColor" />
              </InputAdornment>
            ),
          }}
        />

        <TextField
          {...register('password')}
          label="Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Your password"
          fullWidth
          autoComplete="current-password"
          error={!!errors.password}
          helperText={errors.password?.message}
          sx={{ mb: 2 }}
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
                  {showPassword ? (
                    <EyeSlashIcon size={20} weight="light" color="currentColor" />
                  ) : (
                    <EyeIcon size={20} weight="light" color="currentColor" />
                  )}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
          <Link to="/auth/forgot-password" style={{ textDecoration: 'none' }}>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                fontSize: '0.875rem',
                '&:hover': { color: 'text.primary' },
              }}
            >
              Forgot password?
            </Typography>
          </Link>
        </Box>

        <Button type="submit" fullWidth variant="contained" disabled={busy} sx={{ py: 1.5, mb: 3 }}>
          {busy && <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />}
          Sign in
        </Button>

        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Don&apos;t have an account?{' '}
            <Link to="/auth/signup" style={{ textDecoration: 'none' }}>
              <Typography
                component="span"
                variant="body2"
                sx={{ color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
              >
                Sign up
              </Typography>
            </Link>
          </Typography>
        </Box>
      </form>
    </AuthLayout>
  );
}
