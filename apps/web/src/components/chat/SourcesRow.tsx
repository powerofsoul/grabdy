import type { ComponentType } from 'react';

import { alpha, Box, Typography } from '@mui/material';
import type { IconProps } from '@phosphor-icons/react';
import {
  FileCsvIcon,
  FileDocIcon,
  FilePdfIcon,
  FileTextIcon,
  FileTsIcon,
  FileXlsIcon,
  ImageIcon,
} from '@phosphor-icons/react';

import type { Source } from './MessageRow';

const ICON_BY_EXT: Record<string, ComponentType<IconProps>> = {
  pdf: FilePdfIcon,
  csv: FileCsvIcon,
  json: FileTextIcon,
  txt: FileTextIcon,
  docx: FileDocIcon,
  doc: FileDocIcon,
  xlsx: FileXlsIcon,
  xls: FileXlsIcon,
  ts: FileTsIcon,
  tsx: FileTsIcon,
  png: ImageIcon,
  jpg: ImageIcon,
  jpeg: ImageIcon,
  webp: ImageIcon,
  gif: ImageIcon,
};

function getIcon(filename: string): ComponentType<IconProps> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return ICON_BY_EXT[ext] ?? FileTextIcon;
}

/** File types that have meaningful page numbers */
const PAGE_EXTENSIONS = new Set(['pdf', 'docx', 'doc']);

function hasPages(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return PAGE_EXTENSIONS.has(ext);
}

interface SourcesRowProps {
  sources: Source[];
  onSourceClick?: (source: Source, page?: number) => void;
}

function deduplicateSources(sources: Source[]): Source[] {
  const seen = new Map<string, Source>();
  for (const source of sources) {
    const existing = seen.get(source.dataSourceId);
    if (existing) {
      if (source.score > existing.score) existing.score = source.score;
      if (source.pages) {
        const merged = new Set(existing.pages ?? []);
        for (const p of source.pages) merged.add(p);
        existing.pages = [...merged].sort((a, b) => a - b);
      }
    } else {
      seen.set(source.dataSourceId, { ...source });
    }
  }
  return [...seen.values()];
}

export function SourcesRow({ sources, onSourceClick }: SourcesRowProps) {
  const unique = deduplicateSources(sources);

  return (
    <Box
      sx={{
        mt: 0.75,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.75,
      }}
    >
      {unique.map((source) => {
        const Icon = getIcon(source.dataSourceName);
        const showPages = hasPages(source.dataSourceName) && source.pages && source.pages.length > 0;
        return (
          <Box
            key={source.dataSourceId}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              px: 1,
              py: 0.5,
              borderRadius: 1,
              bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
              border: '1px solid',
              borderColor: (t) => alpha(t.palette.primary.main, 0.12),
              maxWidth: 360,
            }}
          >
            <Icon size={13} weight="light" style={{ flexShrink: 0 }} />
            <Typography
              noWrap
              onClick={() => onSourceClick?.(source)}
              sx={{
                fontSize: '0.7rem',
                color: 'text.secondary',
                lineHeight: 1.3,
                cursor: onSourceClick ? 'pointer' : 'default',
                '&:hover': onSourceClick ? { textDecoration: 'underline' } : {},
              }}
            >
              {source.dataSourceName}
            </Typography>
            {showPages && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  flexShrink: 0,
                  ml: '2px',
                }}
              >
                {source.pages?.map((p) => (
                  <Typography
                    key={p}
                    component="span"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSourceClick?.(source, p);
                    }}
                    sx={{
                      fontSize: '0.6rem',
                      color: 'text.disabled',
                      cursor: onSourceClick ? 'pointer' : 'default',
                      px: '3px',
                      py: '1px',
                      borderRadius: 0.5,
                      transition: 'all 0.12s ease',
                      '&:hover': onSourceClick
                        ? {
                            color: 'text.secondary',
                            bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                          }
                        : {},
                    }}
                  >
                    p.{p}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
