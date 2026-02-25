import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { MAX_CHAT_ATTACHMENTS, UPLOADS_EXTENSIONS, UPLOADS_MIMES } from '@grabdy/contracts';
import { alpha, Box, IconButton, Typography, useTheme } from '@mui/material';
import { ArrowUpIcon, PaperclipIcon, XIcon } from '@phosphor-icons/react';
import { toast } from 'sonner';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFiles(files: File[], currentCount: number): { valid: File[]; errors: string[] } {
  const errors: string[] = [];
  const remaining = MAX_CHAT_ATTACHMENTS - currentCount;

  if (remaining <= 0) {
    errors.push(`Maximum ${MAX_CHAT_ATTACHMENTS} files per message`);
    return { valid: [], errors };
  }

  const valid: File[] = [];
  for (const file of files) {
    if (valid.length >= remaining) {
      errors.push(`Maximum ${MAX_CHAT_ATTACHMENTS} files per message`);
      break;
    }
    if (!UPLOADS_MIMES.has(file.type)) {
      errors.push(`${file.name}: unsupported file type`);
    } else if (file.size > MAX_FILE_SIZE) {
      errors.push(`${file.name} exceeds the 10 MB limit`);
    } else {
      valid.push(file);
    }
  }

  return { valid, errors };
}

interface ChatInputProps {
  onSend: (message: string, files?: File[]) => void | Promise<void>;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
  elevated?: boolean;
}

export function ChatInput({
  onSend,
  isStreaming,
  disabled = false,
  placeholder = 'Ask anything about your documents...',
  elevated = false,
}: ChatInputProps) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const theme = useTheme();
  const ct = theme.palette.text.primary;

  const atLimit = pendingFiles.length >= MAX_CHAT_ATTACHMENTS;

  useEffect(() => {
    if (!isStreaming && !disabled) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, disabled]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  // Create stable object URLs for image previews, revoke on change/unmount
  const previewUrls = useMemo(() => {
    const map = new Map<File, string>();
    for (const file of pendingFiles) {
      if (file.type.startsWith('image/')) {
        map.set(file, URL.createObjectURL(file));
      }
    }
    return map;
  }, [pendingFiles]);

  useEffect(() => {
    return () => {
      for (const url of previewUrls.values()) {
        URL.revokeObjectURL(url);
      }
    };
  }, [previewUrls]);

  const addFiles = useCallback((files: File[]) => {
    setPendingFiles((prev) => {
      const { valid, errors } = validateFiles(files, prev.length);
      for (const err of errors) toast.error(err);
      return valid.length > 0 ? [...prev, ...valid] : prev;
    });
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      addFiles(Array.from(files));
      e.target.value = '';
    },
    [addFiles]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) addFiles(Array.from(files));
    },
    [addFiles]
  );

  const removeFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSend = useCallback(async () => {
    const messageToSend = input.trim();
    if ((!messageToSend && pendingFiles.length === 0) || isStreaming || disabled) return;

    const filesToSend = pendingFiles.length > 0 ? [...pendingFiles] : undefined;
    setInput('');
    setPendingFiles([]);

    try {
      await Promise.resolve(onSend(messageToSend, filesToSend));
    } catch (err) {
      setInput((current) => current || messageToSend);
      if (filesToSend) setPendingFiles(filesToSend);
      console.error('Failed to send message:', err);
    }
  }, [input, pendingFiles, isStreaming, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const hasInput = input.trim().length > 0 || pendingFiles.length > 0;

  return (
    <Box
      sx={{
        px: { xs: 2, md: 3 },
        pb: elevated ? 0 : 2,
        pt: elevated ? 0 : 1,
        flexShrink: 0,
      }}
    >
      <Box
        sx={{
          maxWidth: 720,
          mx: 'auto',
          width: '100%',
        }}
      >
        <Box
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          sx={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            px: 2.5,
            py: 1.5,
            borderBottom: focused ? `2px solid ${ct}` : `1px solid ${ct}`,
            transition: 'border-color 150ms ease',
          }}
        >
          {/* Drop overlay */}
          {isDragging && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: (t) => alpha(t.palette.background.default, 0.92),
                border: '2px dashed',
                borderColor: atLimit ? 'error.main' : 'primary.main',
                borderRadius: 1,
                pointerEvents: 'none',
              }}
            >
              <Typography
                sx={{
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  color: atLimit ? 'error.main' : 'primary.main',
                }}
              >
                {atLimit
                  ? `Limit reached (${MAX_CHAT_ATTACHMENTS} files max)`
                  : `Drop files here (${pendingFiles.length}/${MAX_CHAT_ATTACHMENTS})`}
              </Typography>
            </Box>
          )}
          {/* Pending file chips */}
          {pendingFiles.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5 }}>
              {pendingFiles.map((file, index) => (
                <Box
                  key={`${file.name}-${index}`}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 1,
                    bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
                  }}
                >
                  {previewUrls.has(file) ? (
                    <Box
                      component="img"
                      src={previewUrls.get(file)}
                      alt={file.name}
                      sx={{
                        width: 36,
                        height: 36,
                        objectFit: 'cover',
                        borderRadius: 0.5,
                      }}
                    />
                  ) : (
                    <Typography
                      sx={{
                        fontSize: '0.7rem',
                        color: 'text.secondary',
                        maxWidth: 120,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {file.name} ({formatFileSize(file.size)})
                    </Typography>
                  )}
                  <IconButton
                    size="small"
                    onClick={() => removeFile(index)}
                    sx={{
                      p: 0.25,
                      color: 'text.secondary',
                      '&:hover': { color: 'text.primary' },
                    }}
                  >
                    <XIcon size={12} weight="light" />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}

          {/* Input row */}
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
            <Box
              component="textarea"
              ref={inputRef}
              value={input}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              disabled={isStreaming || disabled}
              placeholder={placeholder}
              rows={1}
              sx={{
                flex: 1,
                border: 'none',
                outline: 'none',
                resize: 'none',
                bgcolor: 'transparent',
                color: 'text.primary',
                fontSize: elevated ? '0.9rem' : '0.85rem',
                lineHeight: 1.6,
                p: 0,
                fontFamily: 'inherit',
                '&::placeholder': {
                  color: alpha(ct, 0.3),
                },
                '&:disabled': {
                  opacity: 0.5,
                },
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={UPLOADS_EXTENSIONS}
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <IconButton
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming || disabled || atLimit}
              size="small"
              sx={{
                width: 28,
                height: 28,
                color: alpha(ct, 0.35),
                '&:hover': {
                  color: alpha(ct, 0.7),
                },
                '&.Mui-disabled': {
                  color: alpha(ct, 0.15),
                },
              }}
            >
              <PaperclipIcon size={16} weight="light" />
            </IconButton>
            <IconButton
              onClick={handleSend}
              disabled={!hasInput || isStreaming || disabled}
              size="small"
              sx={{
                width: 28,
                height: 28,
                bgcolor: hasInput ? 'text.primary' : alpha(ct, 0.06),
                color: hasInput ? 'background.default' : alpha(ct, 0.2),
                transition: 'all 150ms ease',
                '&:hover': {
                  bgcolor: hasInput ? alpha(ct, 0.85) : alpha(ct, 0.1),
                },
                '&.Mui-disabled': {
                  bgcolor: alpha(ct, 0.06),
                  color: alpha(ct, 0.2),
                },
              }}
            >
              <ArrowUpIcon size={16} weight="bold" color="currentColor" />
            </IconButton>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
