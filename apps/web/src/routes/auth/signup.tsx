import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { contract, workEmailSchema } from '@grabdy/contracts';
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
import {
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  LockIcon,
  UserIcon,
} from '@phosphor-icons/react';
import { GoogleLogin } from '@react-oauth/google';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';

import { AuthLayout } from '@/components/ui/AuthLayout';
import { OtpInput } from '@/components/ui/OtpInput';
import { useAuth } from '@/context/AuthContext';

const signupSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: workEmailSchema,
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignupFormData = z.infer<typeof signupSchema>;

const verifySchema = contract.auth.verifyEmail.body.pick({ otp: true });
type VerifyFormData = z.infer<typeof verifySchema>;

export const Route = createFileRoute('/auth/signup')({
  component: SignupPage,
});

function SignupPage() {
  const { signup, verifyEmail, resendVerification, googleAuth, isAuthenticated, isLoading, user } =
    useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'signup' | 'verify'>('signup');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [authInProgress, setAuthInProgress] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: 'onBlur',
  });

  const verifyForm = useForm<VerifyFormData>({
    resolver: zodResolver(verifySchema),
    mode: 'onBlur',
    defaultValues: { otp: '' },
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

  const onSignup = async (data: SignupFormData) => {
    try {
      const email = await signup(data.email, data.password, data.firstName, data.lastName);
      setSubmittedEmail(email);
      setStep('verify');
    } catch (err) {
      signupForm.setError('root', {
        message: err instanceof Error ? err.message : 'Signup failed',
      });
    }
  };

  const onVerify = async (data: VerifyFormData) => {
    try {
      setAuthInProgress(true);
      await verifyEmail(submittedEmail, data.otp);
    } catch (err) {
      setAuthInProgress(false);
      verifyForm.setError('root', {
        message: err instanceof Error ? err.message : 'Verification failed',
      });
    }
  };

  const handleResend = async () => {
    setResendMessage('');
    verifyForm.clearErrors('root');
    try {
      await resendVerification(submittedEmail);
      setResendMessage('A new verification code has been sent.');
    } catch (err) {
      verifyForm.setError('root', {
        message: err instanceof Error ? err.message : 'Failed to resend code',
      });
    }
  };

  const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) {
      signupForm.setError('root', { message: 'Google authentication failed' });
      return;
    }

    try {
      setAuthInProgress(true);
      await googleAuth(credentialResponse.credential);
    } catch (err) {
      setAuthInProgress(false);
      signupForm.setError('root', {
        message: err instanceof Error ? err.message : 'Google authentication failed',
      });
    }
  };

  if (step === 'verify') {
    const verifyBusy = verifyForm.formState.isSubmitting || authInProgress;

    return (
      <AuthLayout title="Verify your email" subtitle={`We sent a code to ${submittedEmail}`}>
        {resendMessage && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {resendMessage}
          </Alert>
        )}

        <form onSubmit={verifyForm.handleSubmit(onVerify)} noValidate autoComplete="off">
          {verifyForm.formState.errors.root && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {verifyForm.formState.errors.root.message}
            </Alert>
          )}

          <Box sx={{ mb: 3 }}>
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', textAlign: 'center', mb: 1.5 }}
            >
              Enter the 6-digit code
            </Typography>
            <Controller
              name="otp"
              control={verifyForm.control}
              render={({ field }) => (
                <OtpInput
                  value={field.value}
                  onChange={field.onChange}
                  error={!!verifyForm.formState.errors.otp}
                  autoFocus
                />
              )}
            />
            {verifyForm.formState.errors.otp && (
              <Typography
                variant="caption"
                sx={{ color: 'error.main', textAlign: 'center', display: 'block', mt: 1 }}
              >
                {verifyForm.formState.errors.otp.message}
              </Typography>
            )}
          </Box>

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={verifyBusy}
            sx={{ py: 1.5, mb: 3 }}
          >
            {verifyBusy && <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />}
            Verify email
          </Button>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Didn&apos;t receive the code?{' '}
              <Typography
                component="span"
                variant="body2"
                onClick={handleResend}
                sx={{
                  color: 'primary.main',
                  cursor: 'pointer',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                Resend code
              </Typography>
            </Typography>
          </Box>
        </form>
      </AuthLayout>
    );
  }

  const signupBusy = signupForm.formState.isSubmitting || authInProgress;

  return (
    <AuthLayout title="Create an account" subtitle="Start your free trial">
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => signupForm.setError('root', { message: 'Google authentication failed' })}
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

      <form onSubmit={signupForm.handleSubmit(onSignup)} noValidate>
        {signupForm.formState.errors.root && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {signupForm.formState.errors.root.message}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            {...signupForm.register('firstName')}
            label="First Name"
            type="text"
            placeholder="First name"
            fullWidth
            autoComplete="given-name"
            error={!!signupForm.formState.errors.firstName}
            helperText={signupForm.formState.errors.firstName?.message}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" sx={{ color: 'text.disabled' }}>
                  <UserIcon size={20} weight="light" color="currentColor" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            {...signupForm.register('lastName')}
            label="Last Name"
            type="text"
            placeholder="Last name"
            fullWidth
            autoComplete="family-name"
            error={!!signupForm.formState.errors.lastName}
            helperText={signupForm.formState.errors.lastName?.message}
          />
        </Box>

        <TextField
          {...signupForm.register('email')}
          label="Work Email"
          type="email"
          placeholder="you@company.com"
          fullWidth
          autoComplete="email"
          error={!!signupForm.formState.errors.email}
          helperText={signupForm.formState.errors.email?.message}
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
          {...signupForm.register('password')}
          label="Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Min. 8 characters"
          fullWidth
          autoComplete="new-password"
          error={!!signupForm.formState.errors.password}
          helperText={signupForm.formState.errors.password?.message}
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
          {...signupForm.register('confirmPassword')}
          label="Confirm Password"
          type={showConfirmPassword ? 'text' : 'password'}
          placeholder="Confirm your password"
          fullWidth
          autoComplete="new-password"
          error={!!signupForm.formState.errors.confirmPassword}
          helperText={signupForm.formState.errors.confirmPassword?.message}
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

        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={signupBusy}
          sx={{ py: 1.5, mb: 3 }}
        >
          {signupBusy && <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />}
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
