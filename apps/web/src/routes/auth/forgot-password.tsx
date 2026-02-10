import { useState } from 'react';

import { Button, Paper, TextField, Typography } from '@mui/material';
import { createFileRoute, Link } from '@tanstack/react-router';

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

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await forgotPassword(email);
      setMessage('If an account exists, you will receive a reset code.');
      setStep('reset');
    } catch {
      setError('Failed to send reset code');
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await resetPassword(email, otp, newPassword);
      setMessage('Password reset successfully. You can now log in.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    }
  };

  return (
    <Paper sx={{ p: 4, maxWidth: 400, width: '100%', mx: 2 }}>
      <Typography variant="h5" sx={{ mb: 3, textAlign: 'center' }}>
        Reset Password
      </Typography>

      {message && (
        <Typography color="success.main" variant="body2" sx={{ mb: 2 }}>
          {message}
        </Typography>
      )}
      {error && (
        <Typography color="error" variant="body2" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {step === 'email' ? (
        <form onSubmit={handleSendOTP}>
          <TextField
            label="Email"
            type="email"
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={{ mb: 2 }}
            required
          />
          <Button type="submit" variant="contained" fullWidth sx={{ mb: 2 }}>
            Send Reset Code
          </Button>
        </form>
      ) : (
        <form onSubmit={handleReset}>
          <TextField
            label="Reset Code"
            fullWidth
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            sx={{ mb: 2 }}
            required
          />
          <TextField
            label="New Password"
            type="password"
            fullWidth
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            sx={{ mb: 2 }}
            required
          />
          <Button type="submit" variant="contained" fullWidth sx={{ mb: 2 }}>
            Reset Password
          </Button>
        </form>
      )}

      <Link to="/auth/login">
        <Typography variant="body2" color="primary" sx={{ textAlign: 'center' }}>
          Back to login
        </Typography>
      </Link>
    </Paper>
  );
}
