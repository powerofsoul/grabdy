import { useEffect, useState } from 'react';

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
import { zodResolver } from '@hookform/resolvers/zod';
import { contract } from '@grabdy/contracts';
import { EyeIcon, EyeSlashIcon, LockIcon } from '@phosphor-icons/react';
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AuthLayout } from '@/components/ui/AuthLayout';
import { api } from '@/lib/api';

interface SearchParams {
  token?: string;
}

const formSchema = contract.auth.completeAccount.body.pick({
  password: true,
  firstName: true,
  lastName: true,
});
type FormData = z.infer<typeof formSchema>;

export const Route = createFileRoute('/auth/complete-account')({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    token: typeof search.token === 'string' ? search.token : undefined,
  }),
  component: CompleteAccountPage,
});

function CompleteAccountPage() {
  const navigate = useNavigate();
  const { token } = useSearch({ from: '/auth/complete-account' });
  const [showPassword, setShowPassword] = useState(false);

  const [isVerifying, setIsVerifying] = useState(true);
  const [inviteData, setInviteData] = useState<{
    email: string;
    orgName: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: 'onBlur',
  });

  useEffect(() => {
    if (!token) {
      setError('root', { message: 'Invalid invitation link' });
      setIsVerifying(false);
      return;
    }

    const verify = async () => {
      try {
        const res = await api.auth.verifySetupToken({ body: { token } });
        if (res.status === 200) {
          setInviteData(res.body.data);
        } else if (res.status === 400) {
          setError('root', { message: res.body.error });
        }
      } catch {
        setError('root', { message: 'Invalid or expired invitation' });
      } finally {
        setIsVerifying(false);
      }
    };

    verify();
  }, [token, setError]);

  const onSubmit = async (data: FormData) => {
    if (!token) return;

    try {
      const res = await api.auth.completeAccount({
        body: {
          token,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
        },
      });

      if (res.status === 200) {
        navigate({ to: '/dashboard' });
      } else if (res.status === 400) {
        setError('root', { message: res.body.error });
      }
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : 'Failed to complete account setup',
      });
    }
  };

  if (isVerifying) {
    return (
      <AuthLayout title="Setting up..." showBack={false}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </AuthLayout>
    );
  }

  if (!inviteData) {
    return (
      <AuthLayout title="Invalid Invitation" showBack={false}>
        <Alert severity="error">
          {errors.root?.message ?? 'This invitation link is invalid or has expired.'}
        </Alert>
        <Button variant="text" onClick={() => navigate({ to: '/auth/login' })} sx={{ mt: 2 }}>
          Go to login
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Complete your account"
      subtitle={`You've been invited to join ${inviteData.orgName}`}
      showBack={false}
    >
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Setting up account for <strong>{inviteData.email}</strong>
        </Typography>
      </Box>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {errors.root && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {errors.root.message}
          </Alert>
        )}

        <TextField label="Email" fullWidth value={inviteData.email} disabled sx={{ mb: 2 }} />

        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            {...register('firstName')}
            label="First Name"
            fullWidth
            autoComplete="given-name"
            error={!!errors.firstName}
            helperText={errors.firstName?.message}
          />
          <TextField
            {...register('lastName')}
            label="Last Name"
            fullWidth
            autoComplete="family-name"
            error={!!errors.lastName}
            helperText={errors.lastName?.message}
          />
        </Box>

        <TextField
          {...register('password')}
          label="Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Minimum 8 characters"
          fullWidth
          autoComplete="new-password"
          error={!!errors.password}
          helperText={errors.password?.message ?? 'Minimum 8 characters'}
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

        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={isSubmitting}
          sx={{ py: 1.5 }}
        >
          {isSubmitting && <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} />}
          Create Account & Join
        </Button>
      </form>
    </AuthLayout>
  );
}
