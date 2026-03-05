import { useForm } from 'react-hook-form';

import { dbIdSchema } from '@grabdy/common';
import { dataSourcesContract, type DataSourceStatus } from '@grabdy/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Box, Button, TextField } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod';

import { useAuth } from '@/context/AuthContext';
import type { DrawerProps } from '@/context/DrawerContext';
import { api } from '@/lib/api';

export interface RenameDataSource {
  id: string;
  title: string;
  type: string;
  mimeType: string;
  status: DataSourceStatus;
  fileSize: number;
  pageCount: number | null;
  processingProgress: number | null;
  createdAt: string;
  updatedAt: string;
}

const formSchema = dataSourcesContract.rename.body;
type FormData = z.infer<typeof formSchema>;

interface RenameDrawerProps extends DrawerProps {
  dataSource: RenameDataSource;
}

export function RenameDrawer({ onClose, dataSource }: RenameDrawerProps) {
  const { selectedOrgId } = useAuth();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: dataSource.title },
    mode: 'onBlur',
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!selectedOrgId) throw new Error('No org selected');
      const parsed = dbIdSchema('DataSource').safeParse(dataSource.id);
      if (!parsed.success) throw new Error('Invalid data source ID');
      const res = await api.dataSources.rename({
        params: { orgId: selectedOrgId, id: parsed.data },
        body: { title: data.title.trim() },
      });
      if (res.status !== 200) throw new Error('Failed to rename');
      return res.body.data;
    },
    onSuccess: () => {
      toast.success('File renamed');
      queryClient.invalidateQueries({ queryKey: ['dataSources'] });
      queryClient.invalidateQueries({ queryKey: ['collections'] });
      onClose();
    },
    onError: (err) => {
      setError('root', { message: err instanceof Error ? err.message : 'Failed to rename' });
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
        label="Title"
        {...register('title')}
        error={!!errors.title}
        helperText={errors.title?.message}
        fullWidth
        autoFocus
        size="small"
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
