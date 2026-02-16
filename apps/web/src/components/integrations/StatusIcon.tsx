import { CircularProgress, useTheme } from '@mui/material';
import { CheckIcon, ClockIcon, WarningIcon } from '@phosphor-icons/react';

export function StatusIcon({ status }: { status: string }) {
  const theme = useTheme();
  switch (status) {
    case 'COMPLETED':
      return <CheckIcon size={13} color={theme.palette.success.main} weight="light" />;
    case 'FAILED':
      return <WarningIcon size={13} color={theme.palette.error.main} weight="light" />;
    case 'RUNNING':
      return <CircularProgress size={12} thickness={5} />;
    case 'PENDING':
      return <ClockIcon size={13} color={theme.palette.info.main} weight="light" />;
    default:
      return null;
  }
}
