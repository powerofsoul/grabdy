import { useState } from 'react';

import { Button, Paper, TextField, Typography } from '@mui/material';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';

import { useAuth } from '@/context/AuthContext';

export const Route = createFileRoute('/auth/register')({
  component: RegisterPage,
});

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await register(name, email, password);
      navigate({ to: '/dashboard' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Paper sx={{ p: 4, maxWidth: 400, width: '100%', mx: 2 }}>
      <Typography variant="h5" sx={{ mb: 3, textAlign: 'center' }}>
        Create Account
      </Typography>

      <form onSubmit={handleSubmit}>
        <TextField
          label="Name"
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mb: 2 }}
          required
        />
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
          helperText="Minimum 8 characters"
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
          {isSubmitting ? 'Creating account...' : 'Create Account'}
        </Button>

        <Link to="/auth/login">
          <Typography variant="body2" color="primary" sx={{ textAlign: 'center' }}>
            Already have an account? Sign in
          </Typography>
        </Link>
      </form>
    </Paper>
  );
}
