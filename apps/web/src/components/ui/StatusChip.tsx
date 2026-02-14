import { type DataSourceStatus } from '@grabdy/contracts';
import { Chip } from '@mui/material';
import { green, grey, red } from '@mui/material/colors';

const STATUS_CONFIG: Record<DataSourceStatus, { label: string; color: string; bgColor: string }> = {
  UPLOADED: { label: 'Uploaded', color: grey[600], bgColor: grey[100] },
  PROCESSING: { label: 'Processing', color: grey[600], bgColor: grey[100] },
  READY: { label: 'Ready', color: green[800], bgColor: green[50] },
  FAILED: { label: 'Failed', color: red[700], bgColor: red[50] },
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
