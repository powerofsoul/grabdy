import { type DataSourceStatus } from '@grabdy/contracts';
import { Chip, keyframes } from '@mui/material';
import { green, grey, red } from '@mui/material/colors';

const pulse = keyframes`
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
`;

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
  const isProcessing = status === 'PROCESSING';
  const label = config.label;

  return (
    <Chip
      label={label}
      size="small"
      sx={{
        color: config.color,
        bgcolor: config.bgColor,
        border: 'none',
        fontWeight: 500,
        fontSize: '0.75rem',
        ...(isProcessing && {
          animation: `${pulse} 1.5s ease-in-out infinite`,
        }),
      }}
    />
  );
}
