import { Chip, type ChipProps } from '@mui/material';

import { type DataSourceStatus } from '@fastdex/contracts';

const STATUS_CONFIG: Record<DataSourceStatus, { label: string; color: ChipProps['color'] }> = {
  UPLOADED: { label: 'Uploaded', color: 'info' },
  PROCESSING: { label: 'Processing', color: 'warning' },
  READY: { label: 'Ready', color: 'success' },
  FAILED: { label: 'Failed', color: 'error' },
};

interface StatusChipProps {
  status: DataSourceStatus;
  size?: ChipProps['size'];
}

export function StatusChip({ status, size = 'small' }: StatusChipProps) {
  const config = STATUS_CONFIG[status];
  return <Chip label={config.label} color={config.color} size={size} variant="outlined" />;
}
