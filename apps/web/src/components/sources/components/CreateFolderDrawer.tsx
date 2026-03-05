import { useForm } from 'react-hook-form';

import { dbIdSchema } from '@grabdy/common';
import { collectionsContract } from '@grabdy/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Box, Button, TextField } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';

import { useAuth } from '@/context/AuthContext';
import type { DrawerProps } from '@/context/DrawerContext';
import { api } from '@/lib/api';

const formSchema = collectionsContract.create.body.pick({ name: true, description: true });

type FormData = z.infer<typeof formSchema>;

interface CreateFolderDrawerProps extends DrawerProps {
  parentId?: string;
}

export function CreateFolderDrawer({ onClose, parentId }: CreateFolderDrawerProps) {
  const { selectedOrgId } = useAuth();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: undefined,
    },
    mode: 'onBlur',
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!selectedOrgId) throw new Error('No org selected');
      const parsedParentId = parentId ? dbIdSchema('Collection').parse(parentId) : undefined;
      const res = await api.collections.create({
        params: { orgId: selectedOrgId },
        body: {
          name: data.name,
          description: data.description,
          parentId: parsedParentId,
        },
      });
      if (res.status !== 200) throw new Error('Failed to create folder');
      return res.body.data;
    },
    onSuccess: () => {
      toast.success('Folder created');
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      onClose();
    },
    onError: (err) => {
      setError('root', { message: err instanceof Error ? err.message : 'Failed to create folder' });
    },
  });

  const onSubmit = handleSubmit((data) => mutation.mutateAsync(data));

  return (
    <Box
      component="form"
      onSubmit={onSubmit}
      sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      <TextField
        label="Name"
        {...register('name')}
        error={!!errors.name}
        helperText={errors.name?.message}
        fullWidth
        autoFocus
        size="small"
      />
      <TextField
        label="Description (optional)"
        {...register('description')}
        fullWidth
        multiline
        rows={3}
        size="small"
      />
      {errors.root && <Box sx={{ color: 'error.main', fontSize: 13 }}>{errors.root.message}</Box>}
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button variant="outlined" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant="contained" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create'}
        </Button>
      </Box>
    </Box>
  );
}
