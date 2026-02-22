import type { ChatSource, IntegrationProvider, UploadsExt } from '@grabdy/contracts';
import { DOC_PAGE_FILE_PATH } from '@grabdy/contracts';
import { FileTextIcon } from '@phosphor-icons/react';

import {
  EXTERNAL_SOURCE_TYPES,
  FILE_EXTS,
  ICON_BY_EXT,
  INTEGRATION_SOURCE_TYPES,
  SOURCE_NOUN,
} from './constants';
import type { IconComponent, SourceGroup, SourceGroupType } from './types';

import { getProviderLabel, ProviderIcon } from '@/components/integrations/ProviderIcon';

export function pluralize(count: number, noun: string): string {
  return count === 1 ? `${count} ${noun}` : `${count} ${noun}s`;
}

export function formatLocation(source: ChatSource): string {
  const parts: string[] = [];
  if ('sheet' in source && source.sheet) parts.push(source.sheet);
  if ('pages' in source && source.pages.length > 0) parts.push(`p. ${source.pages.join(', ')}`);
  if ('rows' in source && source.rows.length > 0) parts.push(`row ${source.rows.join(', ')}`);
  if ('columns' in source && source.columns.length > 0) parts.push(source.columns.join(', '));
  if ('filePath' in source && source.filePath && source.filePath !== DOC_PAGE_FILE_PATH)
    parts.push(source.filePath);
  return parts.length > 0 ? ` ${parts.join(', ')}` : '';
}

export function isIntegrationProvider(type: string): type is IntegrationProvider {
  return INTEGRATION_SOURCE_TYPES.has(type);
}

/** Returns true for integration providers and standalone types (e.g. CODE_REPO) */
export function isExternalSource(type: string): boolean {
  return EXTERNAL_SOURCE_TYPES.has(type);
}

export function isFileExt(ext: string): ext is UploadsExt {
  return FILE_EXTS.has(ext);
}

export function getFileIcon(name: string): IconComponent {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return isFileExt(ext) ? ICON_BY_EXT[ext] : FileTextIcon;
}

export function groupSources(
  sources: ChatSource[],
  FileIcon: React.ComponentType<{ name: string; size: number }>
): SourceGroup[] {
  const groups = new Map<SourceGroupType, ChatSource[]>();

  for (const source of sources) {
    const type = isExternalSource(source.type) ? source.type : 'UPLOAD';
    const existing = groups.get(type);
    if (existing) {
      const isDuplicate = existing.some((s) => {
        if (s.dataSourceId !== source.dataSourceId) return false;
        if (source.type === 'CODE_REPO' && s.type === 'CODE_REPO') {
          return s.filePath === source.filePath && s.docPageId === source.docPageId;
        }
        return true;
      });
      if (!isDuplicate) {
        existing.push(source);
      }
    } else {
      groups.set(type, [source]);
    }
  }

  const result: SourceGroup[] = [];

  for (const [type, items] of groups) {
    if (type === 'UPLOAD') {
      const icon =
        items.length === 1 ? (
          <FileIcon name={items[0].dataSourceName} size={12} />
        ) : (
          <FileTextIcon size={12} weight="light" style={{ flexShrink: 0, opacity: 0.5 }} />
        );

      result.push({
        type: 'UPLOAD',
        label:
          items.length === 1
            ? `${items[0].dataSourceName}${formatLocation(items[0])}`
            : pluralize(items.length, 'document'),
        icon,
        count: items.length,
        sources: items,
      });
    } else if (type === 'CODE_REPO') {
      // CODE_REPO uses the GitHub icon since repos are synced from GitHub
      const providerType = 'GITHUB' satisfies keyof typeof SOURCE_NOUN;

      const getCodeRepoLabel = (item: ChatSource): string => {
        if (item.type === 'CODE_REPO' && item.docPageTitle) return item.docPageTitle;
        return `${item.dataSourceName}${formatLocation(item)}`;
      };

      result.push({
        type,
        label:
          items.length === 1
            ? getCodeRepoLabel(items[0])
            : `${getProviderLabel(providerType)} (${pluralize(items.length, SOURCE_NOUN[type])})`,
        icon: <ProviderIcon provider={providerType} size={13} />,
        count: items.length,
        sources: items,
      });
    } else if (isIntegrationProvider(type)) {
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
    } else {
      // Unknown external source type fallback
      result.push({
        type,
        label:
          items.length === 1
            ? items[0].dataSourceName
            : pluralize(items.length, 'source'),
        icon: <FileTextIcon size={12} weight="light" style={{ flexShrink: 0, opacity: 0.5 }} />,
        count: items.length,
        sources: items,
      });
    }
  }

  return result;
}
