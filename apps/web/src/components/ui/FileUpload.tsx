import { useCallback, useState } from 'react';

import { Box, Typography } from '@mui/material';
import { Upload } from 'lucide-react';

const ACCEPTED_TYPES = [
  'application/pdf',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/json',
];

const ACCEPTED_EXTENSIONS = '.pdf,.csv,.docx,.txt,.json';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export function FileUpload({ onFileSelect, disabled }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;

      const file = e.dataTransfer.files[0];
      if (file && ACCEPTED_TYPES.includes(file.type)) {
        onFileSelect(file);
      }
    },
    [onFileSelect, disabled]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelect(file);
      }
      e.target.value = '';
    },
    [onFileSelect]
  );

  return (
    <Box
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      sx={{
        border: '2px dashed',
        borderColor: isDragOver ? 'primary.main' : 'divider',
        borderRadius: 2,
        p: 4,
        textAlign: 'center',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 0.2s',
        bgcolor: isDragOver ? 'action.hover' : 'transparent',
        opacity: disabled ? 0.5 : 1,
        '&:hover': disabled ? {} : { borderColor: 'primary.main', bgcolor: 'action.hover' },
      }}
      component="label"
    >
      <input
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleFileInput}
        disabled={disabled}
        style={{ display: 'none' }}
      />
      <Upload size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
      <Typography variant="body1" fontWeight={500}>
        Drop a file here or click to browse
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        PDF, CSV, DOCX, TXT, JSON
      </Typography>
    </Box>
  );
}
