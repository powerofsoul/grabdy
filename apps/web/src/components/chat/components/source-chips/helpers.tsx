import type { ChatSource, IntegrationProvider, UploadsExt } from '@grabdy/contracts';
import { FileTextIcon } from '@phosphor-icons/react';

import { FILE_EXTS, ICON_BY_EXT, INTEGRATION_SOURCE_TYPES, SOURCE_NOUN } from './constants';
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
  return parts.length > 0 ? ` ${parts.join(', ')}` : '';
}

export function isIntegrationProvider(type: string): type is IntegrationProvider {
  return INTEGRATION_SOURCE_TYPES.has(type);
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
    const type = isIntegrationProvider(source.type) ? source.type : 'UPLOAD';
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
