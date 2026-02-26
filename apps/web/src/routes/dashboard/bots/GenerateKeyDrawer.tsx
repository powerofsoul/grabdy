import { useState } from 'react';
import { useForm } from 'react-hook-form';

import type { DbId } from '@grabdy/common';
import { botsContract } from '@grabdy/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, TextField } from '@mui/material';
import { toast } from 'sonner';
import { z } from 'zod';

import { CopyButton } from '@/components/ui/CopyButton';
import type { DrawerProps } from '@/context/DrawerContext';
import { api } from '@/lib/api';
import { FONT_MONO } from '@/theme';

const generateKeySchema = botsContract.generateSigningKey.body.required();

type GenerateKeyForm = z.infer<typeof generateKeySchema>;

export function GenerateKeyDrawer({
  onClose,
  onCreated,
  orgId,
  botId,
}: DrawerProps & {
  onCreated: () => void;
  orgId: DbId<'Org'>;
  botId: DbId<'Bot'>;
}) {
  const [privateKey, setPrivateKey] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
    setError,
  } = useForm<GenerateKeyForm>({
    resolver: zodResolver(generateKeySchema),
    mode: 'onBlur',
    defaultValues: { name: '' },
  });

  const onSubmit = async (data: GenerateKeyForm) => {
    try {
      const res = await api.bots.generateSigningKey({
        params: { orgId, botId },
        body: { name: data.name?.trim() || 'default' },
      });
      if (res.status === 200) {
        setPrivateKey(res.body.data.privateKey);
        onCreated();
      }
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Failed to generate key' });
      toast.error(err instanceof Error ? err.message : 'Failed to generate key');
    }
  };

  if (privateKey) {
    return (
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Alert severity="warning">
          Save this private key now. You will not be able to see it again.
        </Alert>
        <Box
          sx={{
            fontFamily: FONT_MONO,
            fontSize: '0.75rem',
            bgcolor: 'action.hover',
            borderRadius: 1,
            p: 2,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            border: '1px solid',
            borderColor: 'divider',
            maxHeight: 300,
          }}
        >
          {privateKey}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <CopyButton text={privateKey} />
          <Button onClick={onClose}>Done</Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}
    >
      <TextField
        label="Key Name"
        fullWidth
        {...register('name')}
        placeholder="e.g. production, staging"
        autoFocus
      />
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={isSubmitting}>
          {isSubmitting ? 'Generating...' : 'Generate'}
        </Button>
      </Box>
    </Box>
  );
}
