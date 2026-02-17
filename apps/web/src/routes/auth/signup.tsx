import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { workEmailSchema } from '@grabdy/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { EnvelopeIcon, EyeIcon, EyeSlashIcon, LockIcon, UserIcon } from '@phosphor-icons/react';
import { GoogleLogin } from '@react-oauth/google';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';

import { AuthLayout } from '@/components/ui/AuthLayout';
import { useAuth } from '@/context/AuthContext';

const signupSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    email: workEmailSchema,
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignupFormData = z.infer<typeof signupSchema>;

export const Route = createFileRoute('/auth/signup')({
  component: SignupPage,
});

function SignupPage() {
  const { signup, googleAuth, isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [authInProgress, setAuthInProgress] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
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

  const onSubmit = async (data: SignupFormData) => {
    setServerError('');
    try {
      setAuthInProgress(true);
      await signup(data.email, data.password, data.name);
    } catch (err) {
      setAuthInProgress(false);
      setServerError(err instanceof Error ? err.message : 'Signup failed');
    }
  };

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

  const busy = isSubmitting || authInProgress;

  return (
    <AuthLayout title="Create an account" subtitle="Start your free trial">
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
          {...register('name')}
          label="Name"
          type="text"
          placeholder="Your name"
          fullWidth
          autoComplete="name"
          error={!!errors.name}
          helperText={errors.name?.message}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start" sx={{ color: 'text.disabled' }}>
                <UserIcon size={20} weight="light" color="currentColor" />
              </InputAdornment>
            ),
          }}
        />

        <TextField
          {...register('email')}
          label="Work Email"
          type="email"
          placeholder="you@company.com"
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
          placeholder="Min. 8 characters"
          fullWidth
          autoComplete="new-password"
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

        <TextField
          {...register('confirmPassword')}
          label="Confirm Password"
          type={showConfirmPassword ? 'text' : 'password'}
          placeholder="Confirm your password"
          fullWidth
          autoComplete="new-password"
          error={!!errors.confirmPassword}
          helperText={errors.confirmPassword?.message}
          sx={{ mb: 3 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start" sx={{ color: 'text.disabled' }}>
                <LockIcon size={20} weight="light" color="currentColor" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  edge="end"
                  size="small"
                  tabIndex={-1}
                  sx={{ color: 'text.disabled' }}
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon size={20} weight="light" color="currentColor" />
                  ) : (
                    <EyeIcon size={20} weight="light" color="currentColor" />
                  )}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Button type="submit" fullWidth variant="contained" disabled={busy} sx={{ py: 1.5, mb: 3 }}>
          {busy && <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />}
          Create account
        </Button>

        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Already have an account?{' '}
            <Link to="/auth/login" style={{ textDecoration: 'none' }}>
              <Typography
                component="span"
                variant="body2"
                sx={{ color: 'primary.main', '&:hover': { textDecoration: 'underline' } }}
              >
                Sign in
              </Typography>
            </Link>
          </Typography>
        </Box>
      </form>
    </AuthLayout>
  );
}
