import type { IntegrationProvider, StandaloneDataSourceType, UploadsExt } from '@grabdy/contracts';
import {
  IntegrationProvider as IntegrationProviderEnum,
  STANDALONE_DATA_SOURCE_TYPES,
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

/** Noun used when grouping sources by provider or standalone type */
export const SOURCE_NOUN: Record<IntegrationProvider | StandaloneDataSourceType, string> = {
  SLACK: 'channel',
  LINEAR: 'issue',
  GITHUB: 'item',
  NOTION: 'page',
  CODE_REPO: 'file',
};

/** Integration providers (everything except UPLOAD) -- derived from the enum */
export const INTEGRATION_SOURCE_TYPES: ReadonlySet<string> = new Set(
  Object.values(IntegrationProviderEnum)
);

/** External source types: integration providers + standalone types like CODE_REPO */
export const EXTERNAL_SOURCE_TYPES: ReadonlySet<string> = new Set([
  ...Object.values(IntegrationProviderEnum),
  ...STANDALONE_DATA_SOURCE_TYPES,
]);

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
