import type { DbId } from '@grabdy/common';

export interface PageText {
  page: number;
  text: string;
}

export interface SheetRow {
  row: number;
  text: string;
}

export interface SheetData {
  sheet: string;
  columns: string[];
  rows: SheetRow[];
}

export type ExtractionResult =
  | { type: 'pages'; text: string; pages: PageText[] }
  | { type: 'sheets'; text: string; sheets: SheetData[] }
  | { type: 'rows'; text: string; columns: string[]; rows: SheetRow[] }
  | { type: 'text'; text: string };

export interface BatchExtractionResult {
  textSegments: Array<{
    content: string;
    unit: number;
    contextOnly: boolean;
  }>;
  highlights: Array<{
    unit: number;
    text: string;
    color?: string;
    contextOnly: boolean;
  }>;
  comments: Array<{
    unit: number;
    author?: string;
    text: string;
    referencedText?: string;
    contextOnly: boolean;
  }>;
  annotations: Array<{
    unit: number;
    text: string;
    type: string;
    contextOnly: boolean;
  }>;
  images: Array<{
    unit: number;
    s3Key: string;
    buffer?: Buffer;
    mimeType?: string;
    width?: number;
    height?: number;
    altText?: string;
    surroundingText?: string;
    contextOnly: boolean;
  }>;
  formFields: Array<{ name: string; value: string; unit: number }>;
  footnotes: Array<{ text: string; unit: number; contextOnly: boolean }>;
  trackChanges: Array<{
    type: 'insert' | 'delete';
    author?: string;
    text: string;
    contextOnly: boolean;
  }>;
  headings: Array<{ title: string; level: number; unit: number }>;
}

export interface EmailExtractionResult {
  headers: {
    from: string;
    to: string[];
    subject: string;
    date: string;
    rfcMessageRef: string | null;
  };
  bodyText: string;
  bodyHtml?: string;
  attachments: Array<{
    filename: string;
    mimeType: string;
    buffer: Buffer;
    size: number;
  }>;
}

export interface DocumentMetadata {
  pageCount?: number;
  rowCount?: number;
  sheetNames?: string[];
  fileSize: number;
  charCount?: number;
}

export interface BatchPlan {
  batchIndex: number;
  startUnit: number;
  endUnit: number;
  overlapBefore: number;
  overlapAfter: number;
  sheet?: string;
}

export interface BatchExtractionParams {
  dataSourceId: DbId<'DataSource'>;
  orgId: DbId<'Org'>;
  collectionId: DbId<'Collection'> | null;
  storagePath: string;
  mimeType: string;
  batchIndex: number;
  startUnit: number;
  endUnit: number;
  overlapBefore: number;
  overlapAfter: number;
  classification: unknown;
  filename?: string;
}
