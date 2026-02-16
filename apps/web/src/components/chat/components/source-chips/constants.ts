import type { IntegrationProvider } from '@grabdy/contracts';
import { IntegrationProvider as IntegrationProviderEnum } from '@grabdy/contracts';
import {
  FileCsvIcon,
  FileDocIcon,
  FilePdfIcon,
  FileTextIcon,
  FileTsIcon,
  FileXlsIcon,
  ImageIcon,
} from '@phosphor-icons/react';

import type { FileExt, IconComponent } from './types';

/** Noun used when grouping sources by provider */
export const SOURCE_NOUN: Record<IntegrationProvider, string> = {
  SLACK: 'channel',
};

/** Integration providers (everything except UPLOAD) -- derived from the enum */
export const INTEGRATION_SOURCE_TYPES: ReadonlySet<string> = new Set(
  Object.values(IntegrationProviderEnum),
);

export const FILE_EXTS = new Set<string>([
  'pdf', 'csv', 'json', 'txt', 'docx', 'doc',
  'xlsx', 'xls', 'ts', 'tsx', 'png', 'jpg', 'jpeg', 'webp', 'gif',
]);

export const ICON_BY_EXT: Record<FileExt, IconComponent> = {
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
