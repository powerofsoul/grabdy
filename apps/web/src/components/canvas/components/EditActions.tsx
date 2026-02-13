import { Button, Stack } from '@mui/material';

interface EditActionsProps {
  onDiscard: () => void;
  onSave: () => void;
}

export function EditActions({ onDiscard, onSave }: EditActionsProps) {
  return (
    <Stack direction="row" spacing={0.5}>
      <Button
        size="small"
        onClick={onDiscard}
        sx={{
          minWidth: 0,
          px: 1,
          py: 0,
          fontSize: 11,

          color: 'text.secondary',
        }}
      >
        Discard
      </Button>
      <Button
        size="small"
        variant="contained"
        onClick={onSave}
        sx={{
          minWidth: 0,
          px: 1,
          py: 0,
          fontSize: 11,

        }}
      >
        Save
      </Button>
    </Stack>
  );
}
