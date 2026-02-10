import { useState } from 'react';

import { Box, Button, Paper, TextField, Typography } from '@mui/material';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';

import { useAuth } from '@/context/AuthContext';

export const Route = createFileRoute('/auth/login')({
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate({ to: '/dashboard' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Paper sx={{ p: 4, maxWidth: 400, width: '100%', mx: 2 }}>
      <Typography variant="h5" sx={{ mb: 3, textAlign: 'center' }}>
        Sign In
      </Typography>

      <form onSubmit={handleSubmit}>
        <TextField
          label="Email"
          type="email"
          fullWidth
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          sx={{ mb: 2 }}
          required
        />
        <TextField
          label="Password"
          type="password"
          fullWidth
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          sx={{ mb: 2 }}
          required
        />

        {error && (
          <Typography color="error" variant="body2" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        <Button
          type="submit"
          variant="contained"
          fullWidth
          disabled={isSubmitting}
          sx={{ mb: 2 }}
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </Button>

        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Link to="/auth/forgot-password">
            <Typography variant="body2" color="primary">
              Forgot password?
            </Typography>
          </Link>
          <Link to="/auth/register">
            <Typography variant="body2" color="primary">
              Create account
            </Typography>
          </Link>
        </Box>
      </form>
    </Paper>
  );
}
