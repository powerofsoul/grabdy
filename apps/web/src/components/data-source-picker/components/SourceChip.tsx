import { Chip } from '@mui/material';
import { CheckIcon } from '@phosphor-icons/react';

interface SourceChipProps {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function SourceChip({ label, selected, disabled, onClick }: SourceChipProps) {
  return (
    <Chip
      label={label}
      size="small"
      variant={selected ? 'filled' : 'outlined'}
      color={selected ? 'primary' : 'default'}
      icon={selected ? <CheckIcon size={12} weight="bold" /> : undefined}
      onClick={disabled ? undefined : onClick}
      sx={{
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    />
  );
}
