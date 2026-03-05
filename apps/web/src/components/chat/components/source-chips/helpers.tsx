import type { ChatSource, UploadsExt } from '@grabdy/contracts';
import { FileTextIcon } from '@phosphor-icons/react';

import { FILE_EXTS, ICON_BY_EXT } from './constants';
import type { IconComponent, SourceGroup } from './types';

function pluralize(count: number, noun: string): string {
  return count === 1 ? `${count} ${noun}` : `${count} ${noun}s`;
}

export function formatLocation(source: ChatSource): string {
  const parts: string[] = [];
  if ('sheet' in source && source.sheet) parts.push(source.sheet);
  if ('pages' in source && source.pages.length > 0) parts.push(`p. ${source.pages.join(', ')}`);
  if ('rows' in source && source.rows.length > 0) parts.push(`row ${source.rows.join(', ')}`);
  if ('columns' in source && source.columns.length > 0) parts.push(source.columns.join(', '));
  return parts.length > 0 ? ` ${parts.join(', ')}` : '';
}

export function isFileExt(ext: string): ext is UploadsExt {
  return FILE_EXTS.has(ext);
}

export function getFileIcon(name: string): IconComponent {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return isFileExt(ext) ? ICON_BY_EXT[ext] : FileTextIcon;
}

/**
 * Expand sources so each page in a multi-page PDF/DOCX becomes its own entry.
 * Other source types are passed through unchanged.
 */
export function expandGroupPages(sources: ChatSource[]): ChatSource[] {
  const expanded: ChatSource[] = [];
  for (const source of sources) {
    if ('pages' in source && source.pages.length > 1) {
      for (const page of source.pages) {
        expanded.push({ ...source, pages: [page] });
      }
    } else {
      expanded.push(source);
    }
  }
  return expanded;
}

export function groupSources(
  sources: ChatSource[],
  FileIcon: React.ComponentType<{ name: string; size: number }>
): SourceGroup[] {
  const icon =
    sources.length === 1 ? (
      <FileIcon name={sources[0].dataSourceName} size={12} />
    ) : (
      <FileTextIcon size={12} weight="light" style={{ flexShrink: 0, opacity: 0.5 }} />
    );

  return [
    {
      type: 'UPLOAD',
      label:
        sources.length === 1
          ? `${sources[0].dataSourceName}${formatLocation(sources[0])}`
          : pluralize(sources.length, 'document'),
      icon,
      count: sources.length,
      sources,
    },
  ];
}
