import { alpha, Box, Typography, useTheme } from '@mui/material';
import { CalendarCheckIcon, ChatCircleIcon, FileTextIcon } from '@phosphor-icons/react';

import { FeaturePreview } from './FeaturePreview';

import { FileUpload } from '@/components/ui/FileUpload';

interface EmptyStateProps {
  onFilesSelect: (files: File[]) => void;
  isUploading: boolean;
}

export function EmptyState({ onFilesSelect, isUploading }: EmptyStateProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', pt: 4 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Box
          sx={{
            display: 'inline-flex',
            p: 2,
            mb: 2,
            bgcolor: alpha(ct, 0.06),
          }}
        >
          <FileTextIcon size={48} weight="light" color={ct} />
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 500, color: 'text.primary', mb: 1 }}>
          Upload your contracts to get started
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          Grabdy will extract deadlines, obligations, and key terms automatically.
        </Typography>
      </Box>

      <FileUpload
        onFileSelect={(file) => onFilesSelect([file])}
        onFilesSelect={onFilesSelect}
        multiple
        disabled={isUploading}
      />

      <Box sx={{ mt: 6 }}>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            mb: 2.5,
            display: 'block',
          }}
        >
          What happens after upload
        </Typography>
        <Box
          sx={{
            display: 'flex',
            gap: 3,
            flexDirection: { xs: 'column', sm: 'row' },
          }}
        >
          <FeaturePreview
            icon={<CalendarCheckIcon size={20} weight="light" color="currentColor" />}
            title="Deadlines extracted"
            description="Expiration dates, renewal windows, and notice periods are identified automatically."
            color={alpha(ct, 0.06)}
          />
          <FeaturePreview
            icon={<FileTextIcon size={20} weight="light" color="currentColor" />}
            title="Contract profiles"
            description="Counterparties, contract types, and governing law are pulled from each document."
            color={alpha(ct, 0.06)}
          />
          <FeaturePreview
            icon={<ChatCircleIcon size={20} weight="light" color="currentColor" />}
            title="Ask questions"
            description="Chat with your contract library to find clauses, compare terms, or get summaries."
            color={alpha(ct, 0.06)}
          />
        </Box>
      </Box>
    </Box>
  );
}
