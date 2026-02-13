import { useState } from 'react';

import { alpha, Box, Collapse, Typography, useTheme } from '@mui/material';
import { FileText, ImageSquare, VideoCamera } from '@phosphor-icons/react';

import type { Source } from './MessageRow';

type SourceCategory = 'document' | 'image' | 'video';

interface SourceGroup {
  category: SourceCategory;
  label: string;
  icon: React.ReactNode;
  sources: Source[];
}

const DOC_EXTENSIONS = new Set([
  'pdf', 'csv', 'docx', 'doc', 'txt', 'xlsx', 'xls', 'pptx', 'ppt', 'rtf', 'md', 'json',
]);

const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico',
]);

const VIDEO_EXTENSIONS = new Set([
  'mp4', 'mov', 'avi', 'mkv', 'webm',
]);

function getCategory(name: string): SourceCategory {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (DOC_EXTENSIONS.has(ext)) return 'document';
  return 'document'; // default
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${singular}s`;
}

function groupSources(sources: Source[], ct: string): SourceGroup[] {
  const groups = new Map<SourceCategory, Source[]>();

  for (const source of sources) {
    const cat = getCategory(source.dataSourceName);
    const existing = groups.get(cat);
    if (existing) {
      // Deduplicate by name
      if (!existing.some((s) => s.dataSourceName === source.dataSourceName)) {
        existing.push(source);
      }
    } else {
      groups.set(cat, [source]);
    }
  }

  const iconColor = alpha(ct, 0.35);
  const result: SourceGroup[] = [];

  if (groups.has('document')) {
    result.push({
      category: 'document',
      label: `Documents (${pluralize(groups.get('document')?.length ?? 0, 'file')})`,
      icon: <FileText size={11} weight="light" color={iconColor} />,
      sources: groups.get('document') ?? [],
    });
  }

  if (groups.has('image')) {
    result.push({
      category: 'image',
      label: `Images (${pluralize(groups.get('image')?.length ?? 0, 'file')})`,
      icon: <ImageSquare size={11} weight="light" color={iconColor} />,
      sources: groups.get('image') ?? [],
    });
  }

  if (groups.has('video')) {
    result.push({
      category: 'video',
      label: `Videos (${pluralize(groups.get('video')?.length ?? 0, 'file')})`,
      icon: <VideoCamera size={11} weight="light" color={iconColor} />,
      sources: groups.get('video') ?? [],
    });
  }

  return result;
}

interface SourcesRowProps {
  sources: Source[];
}

export function SourcesRow({ sources }: SourcesRowProps) {
  const theme = useTheme();
  const ct = theme.palette.text.primary;
  const [expandedCategory, setExpandedCategory] = useState<SourceCategory | null>(null);

  const groups = groupSources(sources, ct);

  const handleToggle = (category: SourceCategory) => {
    setExpandedCategory((prev) => (prev === category ? null : category));
  };

  return (
    <Box sx={{ mt: 0.75, px: 0.5 }}>
      {/* Group labels */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1,
        }}
      >
        {groups.map((group) => (
          <Box
            key={group.category}
            onClick={() => handleToggle(group.category)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              borderRadius: 0.5,
              px: 0.5,
              py: 0.25,
              mx: -0.5,
              transition: 'background-color 0.15s ease',
              '&:hover': {
                bgcolor: alpha(ct, 0.04),
              },
            }}
          >
            {group.icon}
            <Typography
              sx={{
                fontSize: '0.65rem',
                color: alpha(ct, 0.4),
                userSelect: 'none',
              }}
            >
              {group.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Expanded source details */}
      {groups.map((group) => (
        <Collapse key={group.category} in={expandedCategory === group.category}>
          <Box
            sx={{
              mt: 0.75,
              pl: 1,
              borderLeft: '2px solid',
              borderColor: 'primary.main',
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
            }}
          >
            {group.sources.map((source, i) => (
              <Box
                key={i}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  bgcolor: alpha(ct, 0.02),
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.68rem',
                    color: alpha(ct, 0.6),
                    fontWeight: 500,
                  }}
                  noWrap
                >
                  {source.dataSourceName}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.6rem',
                    color: alpha(ct, 0.3),
                    flexShrink: 0,
                  }}
                >
                  {(source.score * 100).toFixed(0)}% match
                </Typography>
              </Box>
            ))}
          </Box>
        </Collapse>
      ))}
    </Box>
  );
}
