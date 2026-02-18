import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { contract } from '@grabdy/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
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
import {
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  KeyIcon,
} from '@phosphor-icons/react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';

import { OtpInput } from '@/components/ui/OtpInput';
import { AuthLayout } from '@/components/ui/AuthLayout';
import { useAuth } from '@/context/AuthContext';

const emailSchema = contract.auth.forgotPassword.body;
type EmailFormData = z.infer<typeof emailSchema>;

const resetSchema = contract.auth.resetPassword.body
  .pick({ otp: true, newPassword: true })
  .extend({
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type ResetFormData = z.infer<typeof resetSchema>;

export const Route = createFileRoute('/auth/forgot-password')({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { forgotPassword, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [message, setMessage] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    mode: 'onBlur',
  });

  const resetForm = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    mode: 'onBlur',
    defaultValues: { otp: '' },
  });

  const handleSendOTP = async (data: EmailFormData) => {
    try {
      await forgotPassword(data.email);
      setSubmittedEmail(data.email);
      setMessage('If an account exists, you will receive a reset code.');
      setStep('reset');
    } catch {
      emailForm.setError('root', { message: 'Failed to send reset code' });
    }
  };

  const handleReset = async (data: ResetFormData) => {
    try {
      await resetPassword(submittedEmail, data.otp, data.newPassword);
      setMessage('Password reset successfully. Redirecting to sign in...');
      setTimeout(() => navigate({ to: '/auth/login' }), 1500);
    } catch (err) {
      resetForm.setError('root', {
        message: err instanceof Error ? err.message : 'Failed to reset password',
      });
    }
  };

  return (
    <AuthLayout title="Reset password" subtitle="We'll send you a code to reset it">
      {message && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {message}
        </Alert>
      )}

      {step === 'email' ? (
        <form onSubmit={emailForm.handleSubmit(handleSendOTP)} noValidate>
          {emailForm.formState.errors.root && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {emailForm.formState.errors.root.message}
            </Alert>
          )}
          <TextField
            {...emailForm.register('email')}
            label="Email"
            type="email"
            placeholder="you@example.com"
            fullWidth
            autoComplete="email"
            error={!!emailForm.formState.errors.email}
            helperText={emailForm.formState.errors.email?.message}
            sx={{ mb: 3 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" sx={{ color: 'text.disabled' }}>
                  <EnvelopeIcon size={20} weight="light" color="currentColor" />
                </InputAdornment>
              ),
            }}
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={emailForm.formState.isSubmitting}
            sx={{ py: 1.5, mb: 3 }}
          >
            {emailForm.formState.isSubmitting && (
              <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />
            )}
            Send reset code
          </Button>
        </form>
      ) : (
        <form onSubmit={resetForm.handleSubmit(handleReset)} noValidate autoComplete="off">
          {resetForm.formState.errors.root && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {resetForm.formState.errors.root.message}
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
              control={resetForm.control}
              render={({ field }) => (
                <OtpInput
                  value={field.value}
                  onChange={field.onChange}
                  error={!!resetForm.formState.errors.otp}
                  autoFocus
                />
              )}
            />
            {resetForm.formState.errors.otp && (
              <Typography
                variant="caption"
                sx={{ color: 'error.main', textAlign: 'center', display: 'block', mt: 1 }}
              >
                {resetForm.formState.errors.otp.message}
              </Typography>
            )}
          </Box>

          <TextField
            {...resetForm.register('newPassword')}
            label="New password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Minimum 8 characters"
            fullWidth
            autoComplete="new-password"
            error={!!resetForm.formState.errors.newPassword}
            helperText={resetForm.formState.errors.newPassword?.message}
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" sx={{ color: 'text.disabled' }}>
                  <KeyIcon size={20} weight="light" color="currentColor" />
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
            {...resetForm.register('confirmPassword')}
            label="Confirm password"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Confirm your new password"
            fullWidth
            autoComplete="new-password"
            error={!!resetForm.formState.errors.confirmPassword}
            helperText={resetForm.formState.errors.confirmPassword?.message}
            sx={{ mb: 3 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" sx={{ color: 'text.disabled' }}>
                  <KeyIcon size={20} weight="light" color="currentColor" />
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
            variant="contained"
            fullWidth
            disabled={resetForm.formState.isSubmitting}
            sx={{ py: 1.5, mb: 3 }}
          >
            {resetForm.formState.isSubmitting && (
              <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />
            )}
            Reset password
          </Button>
        </form>
      )}

      <Link to="/auth/login" style={{ textDecoration: 'none' }}>
        <Typography
          variant="body2"
          sx={{
            textAlign: 'center',
            color: 'text.secondary',
            '&:hover': { color: 'text.primary' },
          }}
        >
          Back to sign in
        </Typography>
      </Link>
    </AuthLayout>
  );
}
