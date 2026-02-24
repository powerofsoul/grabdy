import { UPLOADS_FILE_TYPES } from '@grabdy/contracts';

const PREVIEWABLE_MIMES: ReadonlySet<string> = new Set(UPLOADS_FILE_TYPES.map((f) => f.mime));

export function canPreview(mimeType: string): boolean {
  return PREVIEWABLE_MIMES.has(mimeType);
}
