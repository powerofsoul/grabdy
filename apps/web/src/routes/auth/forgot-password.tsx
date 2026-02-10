import { useState } from 'react';

import {
  Alert,
  Button,
  CircularProgress,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { createFileRoute, Link } from '@tanstack/react-router';
import { KeyRound, Mail, ShieldCheck } from 'lucide-react';

import { AuthLayout } from '@/components/ui/AuthLayout';
import { useAuth } from '@/context/AuthContext';

export const Route = createFileRoute('/auth/forgot-password')({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { forgotPassword, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await forgotPassword(email);
      setMessage('If an account exists, you will receive a reset code.');
      setStep('reset');
    } catch {
      setError('Failed to send reset code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await resetPassword(email, otp, newPassword);
      setMessage('Password reset successfully. You can now sign in.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Reset password" subtitle="We'll send you a code to reset it">
      {message && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {message}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {step === 'email' ? (
        <form onSubmit={handleSendOTP}>
          <TextField
            label="Email"
            type="email"
            placeholder="you@example.com"
            fullWidth
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={{ mb: 3 }}
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" sx={{ color: 'text.disabled' }}>
                  <Mail size={20} />
                </InputAdornment>
              ),
            }}
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={isSubmitting}
            sx={{ py: 1.5, mb: 3 }}
          >
            {isSubmitting && <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />}
            Send reset code
          </Button>
        </form>
      ) : (
        <form onSubmit={handleReset}>
          <TextField
            label="Reset code"
            placeholder="Enter the code from your email"
            fullWidth
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            sx={{ mb: 2 }}
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" sx={{ color: 'text.disabled' }}>
                  <ShieldCheck size={20} />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label="New password"
            type="password"
            placeholder="Minimum 8 characters"
            fullWidth
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            sx={{ mb: 3 }}
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start" sx={{ color: 'text.disabled' }}>
                  <KeyRound size={20} />
                </InputAdornment>
              ),
            }}
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            disabled={isSubmitting}
            sx={{ py: 1.5, mb: 3 }}
          >
            {isSubmitting && <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />}
            Reset password
          </Button>
        </form>
      )}

      <Link to="/auth/login" style={{ textDecoration: 'none' }}>
        <Typography
          variant="body2"
          sx={{ textAlign: 'center', color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
        >
          Back to sign in
        </Typography>
      </Link>
    </AuthLayout>
  );
}
