import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { contract } from '@grabdy/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  CircularProgress,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { EnvelopeIcon, KeyIcon, ShieldCheckIcon } from '@phosphor-icons/react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { z } from 'zod';

import { AuthLayout } from '@/components/ui/AuthLayout';
import { useAuth } from '@/context/AuthContext';

const emailSchema = contract.auth.forgotPassword.body;
type EmailFormData = z.infer<typeof emailSchema>;

const resetSchema = contract.auth.resetPassword.body.pick({ otp: true, newPassword: true });
type ResetFormData = z.infer<typeof resetSchema>;

export const Route = createFileRoute('/auth/forgot-password')({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { forgotPassword, resetPassword } = useAuth();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [message, setMessage] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    mode: 'onBlur',
  });

  const resetForm = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    mode: 'onBlur',
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
      setMessage('Password reset successfully. You can now sign in.');
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
        <form onSubmit={resetForm.handleSubmit(handleReset)} noValidate>
          {resetForm.formState.errors.root && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {resetForm.formState.errors.root.message}
            </Alert>
          )}
          <TextField
            {...resetForm.register('otp')}
            label="Reset code"
            placeholder="Enter the code from your email"
            fullWidth
            error={!!resetForm.formState.errors.otp}
            helperText={resetForm.formState.errors.otp?.message}
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" sx={{ color: 'text.disabled' }}>
                  <ShieldCheckIcon size={20} weight="light" color="currentColor" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            {...resetForm.register('newPassword')}
            label="New password"
            type="password"
            placeholder="Minimum 8 characters"
            fullWidth
            autoComplete="new-password"
            error={!!resetForm.formState.errors.newPassword}
            helperText={resetForm.formState.errors.newPassword?.message}
            sx={{ mb: 3 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" sx={{ color: 'text.disabled' }}>
                  <KeyIcon size={20} weight="light" color="currentColor" />
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
