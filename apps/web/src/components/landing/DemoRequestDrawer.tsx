import { Box, Button, TextField, Typography } from '@mui/material';
import { demoRequestBodySchema } from '@grabdy/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { api } from '@/lib/api';
import type { DrawerProps } from '@/context/DrawerContext';

type DemoRequestForm = z.infer<typeof demoRequestBodySchema>;

export function DemoRequestDrawer({ onClose }: DrawerProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<DemoRequestForm>({
    resolver: zodResolver(demoRequestBodySchema),
    mode: 'onBlur',
  });

  const onSubmit = async (data: DemoRequestForm) => {
    try {
      await api.demoRequest.submit({ body: data });
    } catch {
      setError('root', { message: 'Something went wrong. Please try again.' });
    }
  };

  if (isSubmitSuccessful) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          We&apos;ll be in touch!
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Thanks for your interest. We&apos;ll reach out within 24 hours to schedule a demo.
        </Typography>
        <Button variant="outlined" onClick={onClose}>
          Close
        </Button>
      </Box>
    );
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}
    >
      <Typography color="text.secondary" sx={{ fontSize: '0.9rem' }}>
        Tell us a bit about yourself and we&apos;ll set up a personalized walkthrough.
      </Typography>

      <TextField
        {...register('name')}
        label="Name"
        error={!!errors.name}
        helperText={errors.name?.message}
        fullWidth
        autoFocus
      />

      <TextField
        {...register('company')}
        label="Company"
        error={!!errors.company}
        helperText={errors.company?.message}
        fullWidth
      />

      <TextField
        {...register('email')}
        label="Work email"
        type="email"
        error={!!errors.email}
        helperText={errors.email?.message}
        fullWidth
      />

      {errors.root && (
        <Typography color="error" sx={{ fontSize: '0.85rem' }}>
          {errors.root.message}
        </Typography>
      )}

      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={isSubmitting}
        sx={{ mt: 1 }}
      >
        {isSubmitting ? 'Sending...' : 'Request a demo'}
      </Button>
    </Box>
  );
}
