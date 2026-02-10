import { useEffect, useState } from 'react';

import {
  Alert,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Eye, EyeOff, Lock, Mail, User } from 'lucide-react';

import { AuthLayout } from '@/components/ui/AuthLayout';
import { useAuth } from '@/context/AuthContext';

export const Route = createFileRoute('/auth/register')({
  component: RegisterPage,
});

function RegisterPage() {
  const { register, isAuthenticated, isLoading, user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registerInProgress, setRegisterInProgress] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      navigate({ to: '/dashboard' });
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  useEffect(() => {
    if (registerInProgress && !isLoading && user) {
      navigate({ to: '/dashboard' });
    }
  }, [registerInProgress, isLoading, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      setRegisterInProgress(true);
      await register(name, email, password);
    } catch (err) {
      setRegisterInProgress(false);
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Create account" subtitle="Get started with Grabdy">
      <form onSubmit={handleSubmit}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <TextField
          label="Name"
          placeholder="Your name"
          fullWidth
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mb: 2 }}
          required
          InputProps={{
            startAdornment: (
              <InputAdornment position="start" sx={{ color: 'text.disabled' }}>
                <User size={20} />
              </InputAdornment>
            ),
          }}
        />

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
                <Mail size={20} />
              </InputAdornment>
            ),
          }}
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
          disabled={isSubmitting || registerInProgress}
          sx={{ py: 1.5, mb: 3 }}
        >
          {(isSubmitting || registerInProgress) && (
            <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />
          )}
          Create account
        </Button>

        <Link to="/auth/login" style={{ textDecoration: 'none' }}>
          <Typography
            variant="body2"
            sx={{ textAlign: 'center', color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
          >
            Already have an account? Sign in
          </Typography>
        </Link>
      </form>
    </AuthLayout>
  );
}
