import { Chip } from '@mui/material';

import { type DataSourceStatus } from '@grabdy/contracts';

const STATUS_CONFIG: Record<DataSourceStatus, { label: string; color: string; bgColor: string }> = {
  UPLOADED: { label: 'Uploaded', color: '#6A6A6A', bgColor: '#F3F2EF' },
  PROCESSING: { label: 'Processing', color: '#6A6A6A', bgColor: '#F3F2EF' },
  READY: { label: 'Ready', color: '#4A6741', bgColor: '#EEF2EC' },
  FAILED: { label: 'Failed', color: '#C44A4A', bgColor: '#FDF5F5' },
};

interface StatusChipProps {
  status: DataSourceStatus;
}

export function StatusChip({ status }: StatusChipProps) {
  const config = STATUS_CONFIG[status];
  return (
    <Chip
      label={config.label}
      size="small"
      sx={{
        color: config.color,
        bgcolor: config.bgColor,
        border: 'none',
        fontWeight: 500,
        fontSize: '0.75rem',
      }}
    />
  );
}
