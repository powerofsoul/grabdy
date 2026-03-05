import type { UploadsExt } from '@grabdy/contracts';
import { UPLOADS_FILE_TYPES } from '@grabdy/contracts';
import {
  EnvelopeIcon,
  FileCsvIcon,
  FileDocIcon,
  FilePdfIcon,
  FileTextIcon,
  FileXlsIcon,
  ImageIcon,
} from '@phosphor-icons/react';

import type { IconComponent } from './types';

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
  eml: EnvelopeIcon,
  msg: EnvelopeIcon,
  pst: EnvelopeIcon,
};
