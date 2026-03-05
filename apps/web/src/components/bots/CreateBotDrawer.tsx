import { useForm } from 'react-hook-form';

import { botsContract } from '@grabdy/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Box, Button, TextField } from '@mui/material';
import { toast } from 'sonner';
import { z } from 'zod';

import { useAuth } from '@/context/AuthContext';
import type { DrawerProps } from '@/context/DrawerContext';
import { api } from '@/lib/api';

const createSchema = botsContract.create.body.pick({ name: true });

type CreateForm = z.infer<typeof createSchema>;

export function CreateBotDrawer({ onClose, onCreated }: DrawerProps & { onCreated: () => void }) {
  const { selectedOrgId } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    mode: 'onBlur',
    defaultValues: { name: '' },
  });

  const onSubmit = async (data: CreateForm) => {
    if (!selectedOrgId) return;
    try {
      const res = await api.bots.create({
        params: { orgId: selectedOrgId },
        body: { name: data.name.trim() },
      });
      if (res.status === 200) {
        toast.success('Bot created');
        onCreated();
        onClose();
      }
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : 'Failed to create Bot',
      });
      toast.error(err instanceof Error ? err.message : 'Failed to create Bot');
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      <TextField
        label="Name"
        fullWidth
        {...register('name')}
        error={!!errors.name}
        helperText={errors.name?.message}
        placeholder="e.g. Support Chat, Product Assistant"
        required
        autoFocus
      />
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create'}
        </Button>
      </Box>
    </Box>
  );
}
