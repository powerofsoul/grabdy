import type { ComponentType } from 'react';
import { type ReactNode, useCallback, useMemo, useState } from 'react';

import { dbIdSchema } from '@grabdy/common';
import type { ChatSource, ChunkSourceType, IntegrationProvider } from '@grabdy/contracts';
import { IntegrationProvider as IntegrationProviderEnum } from '@grabdy/contracts';
import { alpha, Box, Typography } from '@mui/material';
import type { IconProps } from '@phosphor-icons/react';
import {
  ArrowSquareOutIcon,
  FileCsvIcon,
  FileDocIcon,
  FilePdfIcon,
  FileTextIcon,
  FileTsIcon,
  FileXlsIcon,
  ImageIcon,
} from '@phosphor-icons/react';

import { DocumentPreviewDrawer } from './DocumentPreviewDrawer';

import { getProviderLabel, ProviderIcon } from '@/components/integrations/ProviderIcon';
import { useDrawer } from '@/context/DrawerContext';

/** Noun used when grouping sources by provider */
const SOURCE_NOUN: Record<IntegrationProvider, string> = {
  SLACK: 'channel',
};

function pluralize(count: number, noun: string): string {
  return count === 1 ? `${count} ${noun}` : `${count} ${noun}s`;
}

function formatLocation(source: ChatSource): string {
  const parts: string[] = [];
  if (source.sheet) parts.push(source.sheet);
  if (source.pages && source.pages.length > 0) parts.push(`p. ${source.pages.join(', ')}`);
  if (source.rows && source.rows.length > 0) parts.push(`row ${source.rows.join(', ')}`);
  return parts.length > 0 ? ` ${parts.join(', ')}` : '';
}

/** Integration providers (everything except UPLOAD) — derived from the enum */
const INTEGRATION_SOURCE_TYPES = new Set<ChunkSourceType>(
  Object.values(IntegrationProviderEnum),
);

function isIntegrationProvider(type: ChunkSourceType): type is IntegrationProvider {
  return INTEGRATION_SOURCE_TYPES.has(type);
}

/* ── File extension icons ─────────────────────────────────────── */

type FileExt =
  | 'pdf'
  | 'csv'
  | 'json'
  | 'txt'
  | 'docx'
  | 'doc'
  | 'xlsx'
  | 'xls'
  | 'ts'
  | 'tsx'
  | 'png'
  | 'jpg'
  | 'jpeg'
  | 'webp'
  | 'gif';

const FILE_EXTS = new Set<string>([
  'pdf', 'csv', 'json', 'txt', 'docx', 'doc',
  'xlsx', 'xls', 'ts', 'tsx', 'png', 'jpg', 'jpeg', 'webp', 'gif',
]);

const ICON_BY_EXT: Record<FileExt, ComponentType<IconProps>> = {
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

function isFileExt(ext: string): ext is FileExt {
  return FILE_EXTS.has(ext);
}

function getFileIcon(filename: string): ComponentType<IconProps> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return isFileExt(ext) ? ICON_BY_EXT[ext] : FileTextIcon;
}

/** Render a file-type icon as JSX (avoids storing component refs during render) */
function FileIcon({ filename, size }: { filename: string; size: number }) {
  const Icon = getFileIcon(filename);
  return <Icon size={size} weight="light" style={{ flexShrink: 0, opacity: 0.5 }} />;
}

/* ── Grouping ─────────────────────────────────────────────────── */

interface SourceGroup {
  type: ChunkSourceType;
  label: string;
  icon: ReactNode;
  count: number;
  sources: ChatSource[];
}

function groupSources(sources: ChatSource[]): SourceGroup[] {
  const groups = new Map<ChunkSourceType, ChatSource[]>();

  for (const source of sources) {
    const type = source.sourceType ?? 'UPLOAD';
    const existing = groups.get(type);
    if (existing) {
      if (!existing.some((s) => s.dataSourceId === source.dataSourceId)) {
        existing.push(source);
      }
    } else {
      groups.set(type, [source]);
    }
  }

  const result: SourceGroup[] = [];

  for (const [type, items] of groups) {
    if (type === 'UPLOAD' || !isIntegrationProvider(type)) {
      const icon =
        items.length === 1 ? (
          <FileIcon filename={items[0].dataSourceName} size={12} />
        ) : (
          <FileTextIcon size={12} weight="light" style={{ flexShrink: 0, opacity: 0.5 }} />
        );

      result.push({
        type: 'UPLOAD',
        label: items.length === 1
          ? `${items[0].dataSourceName}${formatLocation(items[0])}`
          : pluralize(items.length, 'document'),
        icon,
        count: items.length,
        sources: items,
      });
    } else {
      result.push({
        type,
        label:
          items.length === 1
            ? items[0].dataSourceName
            : `${getProviderLabel(type)} (${pluralize(items.length, SOURCE_NOUN[type])})`,
        icon: <ProviderIcon provider={type} size={13} />,
        count: items.length,
        sources: items,
      });
    }
  }

  return result;
}

/* ── Open source helper ───────────────────────────────────────── */

function useOpenSource() {
  const { pushDrawer } = useDrawer();

  return useCallback(
    (source: ChatSource) => {
      if (source.sourceUrl) {
        window.open(source.sourceUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      // Upload without URL — open preview drawer
      const parsed = dbIdSchema('DataSource').safeParse(source.dataSourceId);
      if (!parsed.success) return;
      pushDrawer(
        (onClose) => <DocumentPreviewDrawer onClose={onClose} dataSourceId={parsed.data} />,
        { title: source.dataSourceName, mode: 'dialog', maxWidth: 'lg' },
      );
    },
    [pushDrawer],
  );
}

/* ── Individual source chip ───────────────────────────────────── */

interface SourceItemProps {
  source: ChatSource;
  onOpen: (source: ChatSource) => void;
}

function SourceItem({ source, onOpen }: SourceItemProps) {
  const isIntegration = Boolean(source.sourceType && source.sourceType !== 'UPLOAD');
  const hasUrl = Boolean(source.sourceUrl);
  const clickable = hasUrl || !isIntegration;

  return (
    <Box
      onClick={clickable ? () => onOpen(source) : undefined}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 0.75,
        py: 0.25,
        borderRadius: 1,
        bgcolor: (t) => alpha(t.palette.text.primary, 0.04),
        cursor: clickable ? 'pointer' : 'default',
        transition: 'background-color 120ms ease',
        '&:hover': clickable ? { bgcolor: (t) => alpha(t.palette.primary.main, 0.08) } : {},
      }}
    >
      {source.sourceType && isIntegrationProvider(source.sourceType) ? (
        <ProviderIcon provider={source.sourceType} size={11} />
      ) : (
        <FileIcon filename={source.dataSourceName} size={11} />
      )}
      <Typography
        noWrap
        sx={{
          fontSize: '0.65rem',
          color: 'text.secondary',
          lineHeight: 1.2,
          maxWidth: 200,
        }}
      >
        {source.dataSourceName}{formatLocation(source)}
      </Typography>
      {hasUrl && (
        <ArrowSquareOutIcon size={9} weight="light" style={{ flexShrink: 0, opacity: 0.4 }} />
      )}
    </Box>
  );
}

/* ── Main component ───────────────────────────────────────────── */

interface SourceChipsProps {
  sources: ChatSource[];
}

export function SourceChips({ sources }: SourceChipsProps) {
  const openSource = useOpenSource();
  const groups = useMemo(() => groupSources(sources), [sources]);
  const [expandedType, setExpandedType] = useState<ChunkSourceType | null>(null);

  const handleGroupClick = useCallback(
    (group: SourceGroup) => {
      // Single source — act directly
      if (group.count === 1) {
        openSource(group.sources[0]);
        return;
      }
      // Multiple sources — toggle expand
      setExpandedType((prev) => (prev === group.type ? null : group.type));
    },
    [openSource],
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {/* Grouped summary row */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, alignItems: 'center' }}>
        {groups.map((group) => (
          <Box
            key={group.type}
            onClick={() => handleGroupClick(group)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              cursor: 'pointer',
              '&:hover .source-label': { textDecoration: 'underline' },
            }}
          >
            {group.icon}
            <Typography
              className="source-label"
              sx={{ fontSize: '0.7rem', color: 'text.disabled', lineHeight: 1 }}
              noWrap
            >
              {group.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Expanded individual sources */}
      {expandedType && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, pl: 0.25 }}>
          {groups
            .find((g) => g.type === expandedType)
            ?.sources.map((source) => (
              <SourceItem key={source.dataSourceId} source={source} onOpen={openSource} />
            ))}
        </Box>
      )}
    </Box>
  );
}
