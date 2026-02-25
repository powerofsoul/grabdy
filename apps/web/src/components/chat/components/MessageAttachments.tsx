import { useEffect, useState } from 'react';

import type { ChatAttachment } from '@grabdy/contracts';
import { alpha, Box, Typography } from '@mui/material';
import { FileIcon } from '@phosphor-icons/react';

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncateName(name: string, max: number): string {
  if (name.length <= max) return name;
  const ext = name.lastIndexOf('.');
  if (ext > 0 && name.length - ext <= 5) {
    const base = name.slice(0, ext);
    const suffix = name.slice(ext);
    const maxBase = max - suffix.length - 1;
    if (maxBase > 3) return `${base.slice(0, maxBase)}...${suffix}`;
  }
  return `${name.slice(0, max - 3)}...`;
}

interface ImageThumbnailProps {
  attachment: ChatAttachment;
  getUrl: (storageKey: string) => Promise<string>;
}

function ImageThumbnail({ attachment, getUrl }: ImageThumbnailProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getUrl(attachment.storageKey)
      .then((u) => {
        if (!cancelled) setUrl(u);
      })
      .catch(() => {
        // silently fail
      });
    return () => {
      cancelled = true;
    };
  }, [attachment.storageKey, getUrl]);

  if (!url) {
    return (
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: 0.5,
          bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
        }}
      />
    );
  }

  return (
    <Box
      component="a"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      sx={{ display: 'block', lineHeight: 0 }}
    >
      <Box
        component="img"
        src={url}
        alt={attachment.fileName}
        loading="lazy"
        sx={{
          width: 64,
          height: 64,
          objectFit: 'cover',
          borderRadius: 0.5,
          cursor: 'pointer',
        }}
      />
    </Box>
  );
}

interface FileLinkProps {
  attachment: ChatAttachment;
  getUrl: (storageKey: string) => Promise<string>;
}

function FileLink({ attachment, getUrl }: FileLinkProps) {
  const handleClick = () => {
    getUrl(attachment.storageKey)
      .then((url) => {
        window.open(url, '_blank', 'noopener,noreferrer');
      })
      .catch(() => {
        // silently fail
      });
  };

  return (
    <Box
      onClick={handleClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.5,
        borderRadius: 1,
        bgcolor: (t) => alpha(t.palette.text.primary, 0.06),
        cursor: 'pointer',
        '&:hover': {
          bgcolor: (t) => alpha(t.palette.text.primary, 0.1),
        },
      }}
    >
      <FileIcon size={14} weight="light" />
      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
        {truncateName(attachment.fileName, 20)}
      </Typography>
      <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', whiteSpace: 'nowrap' }}>
        {formatFileSize(attachment.fileSize)}
      </Typography>
    </Box>
  );
}

interface MessageAttachmentsProps {
  attachments: ChatAttachment[];
  getUrl: (storageKey: string) => Promise<string>;
}

export function MessageAttachments({ attachments, getUrl }: MessageAttachmentsProps) {
  if (attachments.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {attachments.map((attachment) => {
        const isImage = attachment.mimeType.startsWith('image/');
        if (isImage) {
          return (
            <ImageThumbnail key={attachment.storageKey} attachment={attachment} getUrl={getUrl} />
          );
        }
        return <FileLink key={attachment.storageKey} attachment={attachment} getUrl={getUrl} />;
      })}
    </Box>
  );
}
