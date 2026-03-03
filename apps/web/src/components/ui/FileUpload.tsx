import { useCallback, useState } from 'react';

import { UPLOADS_EXTENSIONS, UPLOADS_LABELS, UPLOADS_MIMES } from '@grabdy/contracts';
import { Box, LinearProgress, Typography } from '@mui/material';
import { UploadSimpleIcon } from '@phosphor-icons/react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onFilesSelect?: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  uploadProgress?: number | null;
}

export function FileUpload({
  onFileSelect,
  onFilesSelect,
  multiple,
  disabled,
  uploadProgress,
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;

      if (multiple && onFilesSelect && e.dataTransfer.files.length > 0) {
        const files: File[] = [];
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const f = e.dataTransfer.files[i];
          if (f && UPLOADS_MIMES.has(f.type)) {
            files.push(f);
          }
        }
        if (files.length > 0) onFilesSelect(files);
      } else {
        const file = e.dataTransfer.files[0];
        if (file && UPLOADS_MIMES.has(file.type)) {
          onFileSelect(file);
        }
      }
    },
    [onFileSelect, onFilesSelect, multiple, disabled]
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
      if (multiple && onFilesSelect && e.target.files && e.target.files.length > 0) {
        const files: File[] = [];
        for (let i = 0; i < e.target.files.length; i++) {
          const f = e.target.files[i];
          if (f) files.push(f);
        }
        if (files.length > 0) onFilesSelect(files);
      } else {
        const file = e.target.files?.[0];
        if (file) {
          onFileSelect(file);
        }
      }
      e.target.value = '';
    },
    [onFileSelect, onFilesSelect, multiple]
  );

  return (
    <Box
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      sx={{
        border: '2px dashed',
        borderColor: isDragOver ? 'primary.main' : 'grey.300',
        p: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
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
        accept={UPLOADS_EXTENSIONS}
        onChange={handleFileInput}
        disabled={disabled}
        multiple={multiple}
        style={{ display: 'none' }}
      />
      <Box sx={{ color: 'grey.400', mb: 1 }}>
        <UploadSimpleIcon size={32} weight="light" color="currentColor" />
      </Box>
      <Typography variant="body1" fontWeight={500}>
        {multiple ? 'Drop files here or click to browse' : 'Drop a file here or click to browse'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {UPLOADS_LABELS}
      </Typography>
      {uploadProgress != null && (
        <Box sx={{ width: '100%', mt: 2, px: 2 }}>
          <LinearProgress variant="determinate" value={uploadProgress} />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}
          >
            Uploading… {uploadProgress}%
          </Typography>
        </Box>
      )}
    </Box>
  );
}
