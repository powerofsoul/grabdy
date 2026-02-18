import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { contract } from '@grabdy/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Box, Button, TextField, Typography } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import { toast } from 'sonner';
import { z } from 'zod';

import { DashboardPage } from '@/components/ui/DashboardPage';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
});
type ProfileFormData = z.infer<typeof profileSchema>;

const settingsSchema = contract.orgs.update.body.required();
type SettingsFormData = z.infer<typeof settingsSchema>;

export const Route = createFileRoute('/dashboard/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, selectedOrgId, refetch } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors, isSubmitting: isSubmittingProfile },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    mode: 'onBlur',
    values: user ? { firstName: user.firstName, lastName: user.lastName } : undefined,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    mode: 'onBlur',
  });

  useEffect(() => {
    if (!selectedOrgId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const orgRes = await api.orgs.get({ params: { orgId: selectedOrgId } });
        if (orgRes.status === 200) {
          reset({ name: orgRes.body.data.name });
        }
      } catch {
        toast.error('Failed to load settings');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [selectedOrgId, reset]);

  const onProfileSubmit = async (data: ProfileFormData) => {
    try {
      const res = await api.auth.updateProfile({
        body: { firstName: data.firstName.trim(), lastName: data.lastName.trim() },
      });
      if (res.status === 200) {
        await refetch();
        toast.success('Profile updated');
      } else if (res.status === 400) {
        toast.error(res.body.error);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  const onSubmit = async (data: SettingsFormData) => {
    if (!selectedOrgId) return;

    try {
      const res = await api.orgs.update({
        params: { orgId: selectedOrgId },
        body: { name: data.name.trim() },
      });
      if (res.status === 200) {
        toast.success('Organization updated');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update organization');
    }
  };

  if (!selectedOrgId || isLoading) return null;

  return (
    <DashboardPage title="Settings" maxWidth={700}>
      <Box
        component="form"
        onSubmit={handleSubmitProfile(onProfileSubmit)}
        noValidate
        sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 6 }}
      >
        <Typography variant="subtitle1">Profile</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            {...registerProfile('firstName')}
            label="First Name"
            error={!!profileErrors.firstName}
            helperText={profileErrors.firstName?.message}
            fullWidth
          />
          <TextField
            {...registerProfile('lastName')}
            label="Last Name"
            error={!!profileErrors.lastName}
            helperText={profileErrors.lastName?.message}
            fullWidth
          />
        </Box>
        <Box>
          <Button type="submit" variant="contained" disabled={isSubmittingProfile}>
            {isSubmittingProfile ? 'Saving...' : 'Save Profile'}
          </Button>
        </Box>
      </Box>

      <Box
        component="form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
      >
        <Typography variant="subtitle1">Organization</Typography>
        <TextField
          {...register('name')}
          label="Organization Name"
          error={!!errors.name}
          helperText={errors.name?.message}
          fullWidth
        />
        <Box>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </Box>
    </DashboardPage>
  );
}
