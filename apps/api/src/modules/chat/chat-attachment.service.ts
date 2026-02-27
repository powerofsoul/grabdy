import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import type { ChatAttachment } from '@grabdy/contracts';
import { isUploadsMime } from '@grabdy/contracts';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';

import { CsvExtractor } from '../data-sources/sources/file/extractors/csv.extractor';
import { DocxExtractor } from '../data-sources/sources/file/extractors/docx.extractor';
import { PdfExtractor } from '../data-sources/sources/file/extractors/pdf.extractor';
import { TextExtractor } from '../data-sources/sources/file/extractors/text.extractor';
import { XlsxExtractor } from '../data-sources/sources/file/extractors/xlsx.extractor';
import { S3FileStorage } from '../storage/s3-file-storage';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_EXTRACTED_TEXT_LENGTH = 100_000;

function deriveExtractedTextKey(storageKey: string): string {
  return storageKey.replace(/\.[^.]+$/, '.extracted.txt');
}

@Injectable()
export class ChatAttachmentService {
  private readonly logger = new Logger(ChatAttachmentService.name);

  constructor(
    private readonly storage: S3FileStorage,
    private readonly pdfExtractor: PdfExtractor,
    private readonly docxExtractor: DocxExtractor,
    private readonly csvExtractor: CsvExtractor,
    private readonly xlsxExtractor: XlsxExtractor,
    private readonly textExtractor: TextExtractor
  ) {}

  async upload(orgId: DbId<'Org'>, file: Express.Multer.File): Promise<ChatAttachment> {
    if (!isUploadsMime(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(`File size exceeds 10 MB limit`);
    }

    const ext = extname(file.originalname).replace(/^\./, '') || 'bin';
    const storageKey = `chat-attachments/${orgId}/${randomUUID()}.${ext}`;

    await this.storage.put(storageKey, file.buffer, file.mimetype);

    if (!file.mimetype.startsWith('image/')) {
      await this.extractAndStoreText(storageKey, file.buffer, file.mimetype);
    }

    return {
      fileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      storageKey,
    };
  }

  async getExtractedText(storageKey: string): Promise<string> {
    const textKey = deriveExtractedTextKey(storageKey);
    const buffer = await this.storage.get(textKey);
    return buffer.toString('utf-8');
  }

  async getSignedUrl(storageKey: string): Promise<string> {
    return this.storage.getUrl(storageKey);
  }

  async buildAttachmentContext(
    attachments: ChatAttachment[]
  ): Promise<
    Array<{ type: 'text'; text: string } | { type: 'image'; image: Buffer; mimeType: string }>
  > {
    const parts: Array<
      { type: 'text'; text: string } | { type: 'image'; image: Buffer; mimeType: string }
    > = [];

    for (const attachment of attachments) {
      if (attachment.mimeType.startsWith('image/')) {
        const buffer = await this.storage.get(attachment.storageKey);
        parts.push({ type: 'image', image: buffer, mimeType: attachment.mimeType });
      } else {
        let extractedText: string;
        try {
          extractedText = await this.getExtractedText(attachment.storageKey);
        } catch {
          extractedText = '[Could not extract text from this file]';
        }
        parts.push({
          type: 'text',
          text: `--- Attached: ${attachment.fileName} ---\n${extractedText}\n---`,
        });
      }
    }

    return parts;
  }

  private async extractAndStoreText(
    storageKey: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<void> {
    try {
      let text = await this.extractText(buffer, mimeType);

      if (text.length > MAX_EXTRACTED_TEXT_LENGTH) {
        text = text.slice(0, MAX_EXTRACTED_TEXT_LENGTH) + '\n\n[Content truncated]';
      }

      const textKey = deriveExtractedTextKey(storageKey);
      await this.storage.put(textKey, Buffer.from(text, 'utf-8'), 'text/plain');
    } catch (error) {
      this.logger.error(
        `Failed to extract text from ${storageKey}`,
        error instanceof Error ? error.stack : error
      );
    }
  }

  private async extractText(buffer: Buffer, mimeType: string): Promise<string> {
    switch (mimeType) {
      case 'application/pdf':
        return this.extractPdfText(buffer);

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword': {
        const docResult = await this.docxExtractor.extract(buffer);
        return docResult.text;
      }

      case 'text/csv': {
        const csvResult = this.csvExtractor.extract(buffer);
        return csvResult.text;
      }

      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      case 'application/vnd.ms-excel': {
        const xlsxResult = this.xlsxExtractor.extract(buffer);
        return xlsxResult.text;
      }

      case 'text/plain':
      case 'application/json': {
        const textResult = this.textExtractor.extract(buffer);
        return textResult.text;
      }

      default:
        return '';
    }
  }

  private async extractPdfText(buffer: Buffer): Promise<string> {
    const tempPath = join(tmpdir(), `grabdy-chat-${Date.now()}-${randomUUID()}.pdf`);
    try {
      await writeFile(tempPath, buffer);
      const pageCount = await this.pdfExtractor.getPageCountFromFile(tempPath);
      const pages = await this.pdfExtractor.extractPageRangeFromFile(tempPath, 1, pageCount);
      return pages.map((p) => p.text).join('');
    } finally {
      try {
        await unlink(tempPath);
      } catch {
        // Temp file may already be cleaned up
      }
    }
  }
}
