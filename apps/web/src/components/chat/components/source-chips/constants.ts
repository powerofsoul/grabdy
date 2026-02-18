import type { IntegrationProvider, UploadsExt } from '@grabdy/contracts';
import {
  IntegrationProvider as IntegrationProviderEnum,
  UPLOADS_FILE_TYPES,
} from '@grabdy/contracts';
import {
  FileCsvIcon,
  FileDocIcon,
  FilePdfIcon,
  FileTextIcon,
  FileXlsIcon,
  ImageIcon,
} from '@phosphor-icons/react';

import type { IconComponent } from './types';

/** Noun used when grouping sources by provider */
export const SOURCE_NOUN: Record<IntegrationProvider, string> = {
  SLACK: 'channel',
  LINEAR: 'issue',
  GITHUB: 'item',
};

/** Integration providers (everything except UPLOAD) -- derived from the enum */
export const INTEGRATION_SOURCE_TYPES: ReadonlySet<string> = new Set(
  Object.values(IntegrationProviderEnum)
);

export const FILE_EXTS: ReadonlySet<string> = new Set(UPLOADS_FILE_TYPES.map((f) => f.ext));

export const ICON_BY_EXT: Record<UploadsExt, IconComponent> = {
  pdf: FilePdfIcon,
  csv: FileCsvIcon,
  json: FileTextIcon,
  txt: FileTextIcon,
  docx: FileDocIcon,
  doc: FileDocIcon,
  xlsx: FileXlsIcon,
  xls: FileXlsIcon,
  png: ImageIcon,
  jpg: ImageIcon,
  webp: ImageIcon,
  gif: ImageIcon,
};
