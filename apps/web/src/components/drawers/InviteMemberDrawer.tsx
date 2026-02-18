import {
  Box,
  Button,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import { zodResolver } from '@hookform/resolvers/zod';
import { contract } from '@grabdy/contracts';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { useAuth } from '@/context/AuthContext';
import { DrawerProps } from '@/context/DrawerContext';
import { api } from '@/lib/api';

const inviteSchema = contract.orgs.invite.body;
type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteMemberDrawerProps extends DrawerProps {
  onInvited: () => void;
}

export function InviteMemberDrawer({ onClose, onInvited }: InviteMemberDrawerProps) {
  const { selectedOrgId } = useAuth();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    mode: 'onBlur',
    defaultValues: {
      email: '',
      name: '',
      roles: ['MEMBER'],
    },
  });

  const onSubmit = async (data: InviteFormData) => {
    if (!selectedOrgId) return;

    try {
      const res = await api.orgs.invite({
        params: { orgId: selectedOrgId },
        body: {
          email: data.email.trim(),
          name: data.name.trim(),
          roles: data.roles,
        },
      });

      if (res.status === 200) {
        toast.success('Invitation sent');
        reset();
        onInvited();
        onClose();
      } else if (res.status === 400) {
        toast.error(res.body.error);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invitation');
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <TextField
        {...register('name')}
        label="Name"
        fullWidth
        error={!!errors.name}
        helperText={errors.name?.message}
        placeholder="John Doe"
      />
      <TextField
        {...register('email')}
        label="Email"
        type="email"
        fullWidth
        error={!!errors.email}
        helperText={errors.email?.message}
        placeholder="john@example.com"
      />
      <Controller
        name="roles"
        control={control}
        render={({ field }) => (
          <FormControl fullWidth error={!!errors.roles}>
            <InputLabel>Role</InputLabel>
            <Select
              value={field.value[0] ?? 'MEMBER'}
              label="Role"
              onChange={(e) => field.onChange([e.target.value])}
            >
              <MenuItem value="MEMBER">Member</MenuItem>
              <MenuItem value="ADMIN">Admin</MenuItem>
            </Select>
            {errors.roles && <FormHelperText>{errors.roles.message}</FormHelperText>}
          </FormControl>
        )}
      />
      <Button
        type="submit"
        variant="contained"
        disabled={isSubmitting}
        sx={{ mt: 1 }}
      >
        {isSubmitting ? 'Sending...' : 'Send Invitation'}
      </Button>
    </Box>
  );
}
