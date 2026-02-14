export interface PageText {
  page: number;
  text: string;
}

export interface ExtractedImage {
  buffer: Buffer;
  mimeType: string;
  pageNumber?: number;
}

export interface ExtractionResult {
  text: string;
  pages?: PageText[];
  images?: ExtractedImage[];
}
