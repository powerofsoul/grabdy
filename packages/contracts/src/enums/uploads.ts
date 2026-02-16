// ── Supported File Types (single source of truth) ───────────────────
// Every consumer (upload validation, text extraction, preview, icons)
// must derive from this map. Never duplicate mime/extension lists.
// DataSourceType is derived FROM this array (+ integration providers),
// so uploads.ts must not import from data-source.ts.

interface UploadFileType {
  readonly mime: string;
  readonly ext: string;
  readonly type: string;
  readonly label: string;
}

export const UPLOADS_FILE_TYPES = [
  { mime: 'application/pdf', ext: 'pdf', type: 'PDF', label: 'PDF' },
  { mime: 'text/csv', ext: 'csv', type: 'CSV', label: 'CSV' },
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ext: 'docx',
    type: 'DOCX',
    label: 'DOCX',
  },
  { mime: 'application/msword', ext: 'doc', type: 'DOCX', label: 'DOC' },
  {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ext: 'xlsx',
    type: 'XLSX',
    label: 'XLSX',
  },
  { mime: 'application/vnd.ms-excel', ext: 'xls', type: 'XLSX', label: 'XLS' },
  { mime: 'text/plain', ext: 'txt', type: 'TXT', label: 'TXT' },
  { mime: 'application/json', ext: 'json', type: 'JSON', label: 'JSON' },
  { mime: 'image/png', ext: 'png', type: 'IMAGE', label: 'PNG' },
  { mime: 'image/jpeg', ext: 'jpg', type: 'IMAGE', label: 'JPEG' },
  { mime: 'image/webp', ext: 'webp', type: 'IMAGE', label: 'WebP' },
  { mime: 'image/gif', ext: 'gif', type: 'IMAGE', label: 'GIF' },
] as const satisfies readonly UploadFileType[];

/** The DataSourceType values that come from file uploads (e.g. 'PDF', 'DOCX', 'IMAGE'). */
export type UploadSourceType = (typeof UPLOADS_FILE_TYPES)[number]['type'];

export type UploadsMime = (typeof UPLOADS_FILE_TYPES)[number]['mime'];
export type UploadsExt = (typeof UPLOADS_FILE_TYPES)[number]['ext'];

/** Set of accepted MIME types for upload validation */
export const UPLOADS_MIMES: ReadonlySet<string> = new Set(
  UPLOADS_FILE_TYPES.map((f) => f.mime)
);

/** Comma-separated extensions for HTML file input accept attribute */
export const UPLOADS_EXTENSIONS = UPLOADS_FILE_TYPES.map((f) => `.${f.ext}`).join(',');

/** Human-readable label list (e.g. "PDF, CSV, DOCX, XLSX, TXT, JSON") */
export const UPLOADS_LABELS = UPLOADS_FILE_TYPES.map((f) => f.label).join(', ');

/** Map from MIME to the upload's DataSourceType */
export const UPLOADS_MIME_TO_TYPE: Record<UploadsMime, UploadSourceType> = Object.fromEntries(
  UPLOADS_FILE_TYPES.map((f) => [f.mime, f.type])
) as Record<UploadsMime, UploadSourceType>;

/** Type guard to narrow a string to UploadsMime */
export function isUploadsMime(mime: string): mime is UploadsMime {
  return UPLOADS_MIMES.has(mime);
}
