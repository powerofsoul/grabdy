import { useState } from 'react';

import { Box, Button, Drawer, TextField, Typography } from '@mui/material';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmText,
  onConfirm,
  onCancel,
  isLoading,
}: ConfirmDialogProps) {
  const [typedText, setTypedText] = useState('');

  const isConfirmDisabled = isLoading || (confirmText !== undefined && typedText !== confirmText);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={() => {
        setTypedText('');
        onCancel();
      }}
      sx={{
        '& .MuiDrawer-paper': {
          width: { xs: '100%', sm: 400 },
        },
      }}
    >
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
        <Typography variant="h6">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
        {confirmText !== undefined && (
          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Type <strong>{confirmText}</strong> to confirm
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder={confirmText}
              autoFocus
            />
          </Box>
        )}
        <Box sx={{ mt: 'auto', display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button variant="outlined" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={onConfirm}
            disabled={isConfirmDisabled}
          >
            {isLoading ? 'Loading...' : confirmLabel}
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}
