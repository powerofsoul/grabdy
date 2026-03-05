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

const formSchema = collectionsContract.update.body.pick({ name: true }).required();

type FormData = z.infer<typeof formSchema>;

interface RenameFolderDrawerProps extends DrawerProps {
  collectionId: string;
  currentName: string;
}

export function RenameFolderDrawer({
  onClose,
  collectionId,
  currentName,
}: RenameFolderDrawerProps) {
  const { selectedOrgId } = useAuth();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: currentName },
    mode: 'onBlur',
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!selectedOrgId) throw new Error('No org selected');
      const parsedId = dbIdSchema('Collection').parse(collectionId);
      const res = await api.collections.update({
        params: { orgId: selectedOrgId, collectionId: parsedId },
        body: { name: data.name },
      });
      if (res.status !== 200) throw new Error('Failed to rename folder');
      return res.body.data;
    },
    onSuccess: () => {
      toast.success('Folder renamed');
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      onClose();
    },
    onError: (err) => {
      setError('root', { message: err instanceof Error ? err.message : 'Failed to rename folder' });
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
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      {errors.root && <Box sx={{ color: 'error.main', fontSize: 13 }}>{errors.root.message}</Box>}
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button variant="outlined" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant="contained" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save'}
        </Button>
      </Box>
    </Box>
  );
}
