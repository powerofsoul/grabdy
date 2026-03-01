import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import {
  AiRequestType,
  type DocumentClassification,
  documentClassificationSchema,
  ENRICHMENT_MODEL,
  isUploadsMime,
  UPLOADS_MIME_TO_TYPE,
} from '@grabdy/contracts';
import MsgReader from '@kenjiuno/msgreader';
import JSZip from 'jszip';
import { simpleParser } from 'mailparser';
import mammoth from 'mammoth';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import XLSX from 'xlsx';

import { AiService } from '../../ai/ai.service';
import { ENRICHMENT_LANGUAGE_MODEL } from '../../ai/bedrock.provider';
import { S3FileStorage } from '../../storage/s3-file-storage';

const execFileAsync = promisify(execFile);

const MIN_FILE_SIZE_FOR_CLASSIFICATION = 5 * 1024; // 5 KB

/** MIME types that are too simple or structured to benefit from classification. */
const SKIP_CLASSIFICATION_TYPES = new Set(['TXT', 'JSON', 'CSV', 'IMAGE']);

const CLASSIFICATION_PROMPT = `You are a document classifier. Analyze the document preview and classify it by category, characteristics, and optimal chunking strategy.`;

@Injectable()
export class ClassificationService {
  private readonly logger = new Logger(ClassificationService.name);

  constructor(
    private aiService: AiService,
    private storage: S3FileStorage
  ) {}

  /**
   * Classify a document based on a text preview of its content.
   */

  async classifyDocument(params: {
    orgId: DbId<'Org'>;
    preview: string;
    mimeType: string;
    fileSize: number;
    pageCount?: number;
  }): Promise<DocumentClassification> {
    const pageInfo = params.pageCount !== undefined ? `\nPage count: ${params.pageCount}` : '';
    const userMessage = `MIME type: ${params.mimeType}\nFile size: ${params.fileSize} bytes${pageInfo}\n\nDocument preview:\n${params.preview.slice(0, 4000)}`;

    const result = await this.aiService.generateStructuredObject(
      documentClassificationSchema,
      {
        model: ENRICHMENT_LANGUAGE_MODEL,
        system: CLASSIFICATION_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        temperature: 0,
      },
      ENRICHMENT_MODEL,
      AiRequestType.CLASSIFICATION,
      { orgId: params.orgId, source: 'SYSTEM', description: 'Document classification' }
    );

    return result;
  }

  /**
   * Determine whether a file should go through AI classification.
   * Simple/structured formats and very small files skip classification.
   */
  shouldClassify(mimeType: string, fileSize: number): boolean {
    if (fileSize < MIN_FILE_SIZE_FOR_CLASSIFICATION) {
      return false;
    }

    if (!isUploadsMime(mimeType)) {
      return false;
    }

    const sourceType = UPLOADS_MIME_TO_TYPE[mimeType];
    return !SKIP_CLASSIFICATION_TYPES.has(sourceType);
  }

  /**
   * Download a file from S3 and extract a short text preview for classification.
   */

  async extractPreview(params: { storagePath: string; mimeType: string }): Promise<string> {
    const { storagePath, mimeType } = params;

    switch (mimeType) {
      case 'application/pdf':
        return this.extractPdfPreview(storagePath);

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        return this.extractDocxPreview(storagePath);

      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      case 'application/vnd.ms-excel':
        return this.extractXlsxPreview(storagePath);

      case 'message/rfc822':
      case 'application/vnd.ms-outlook':
        return this.extractEmailPreview(storagePath, mimeType);

      case 'application/vnd.ms-outlook-pst':
        return '[PST Archive] Binary format, classification not applicable.';

      default: {
        // Fallback: read raw bytes and return first 2000 chars as text
        const buffer = await this.storage.get(storagePath);
        return buffer.toString('utf-8').slice(0, 2000);
      }
    }
  }

  // ── Private preview extractors ──────────────────────────────────────

  private async extractPdfPreview(storagePath: string): Promise<string> {
    const tempFile = await this.storage.getTempPath(storagePath);
    try {
      const { stdout } = await execFileAsync('pdftotext', [
        '-f',
        '1',
        '-l',
        '2',
        '-layout',
        tempFile.path,
        '-',
      ]);
      return stdout.trim().slice(0, 4000);
    } finally {
      await tempFile.cleanup();
    }
  }

  private async extractDocxPreview(storagePath: string): Promise<string> {
    const buffer = await this.storage.get(storagePath);

    // Try extracting headings from raw XML
    const headings: string[] = [];
    let zip: JSZip | null = null;
    try {
      zip = await JSZip.loadAsync(buffer);
    } catch {
      // Legacy .doc format
    }

    if (zip) {
      const docXml = zip.file('word/document.xml');
      if (docXml) {
        const xml: string = await docXml.async('string');
        // Extract heading text from pStyle elements
        const headingPattern = /<w:pStyle\s+w:val="Heading[^"]*"[^/]*\/>/g;
        let match = headingPattern.exec(xml);
        while (match) {
          // Find the parent paragraph's text
          const pStart = xml.lastIndexOf('<w:p ', match.index);
          const pEnd = xml.indexOf('</w:p>', match.index);
          if (pStart !== -1 && pEnd !== -1) {
            const pBlock = xml.slice(pStart, pEnd);
            const texts: string[] = [];
            const textPattern = /<w:t[^>]*>([^<]*)<\/w:t>/g;
            let textMatch = textPattern.exec(pBlock);
            while (textMatch) {
              texts.push(textMatch[1]);
              textMatch = textPattern.exec(pBlock);
            }
            if (texts.length > 0) {
              headings.push(texts.join(''));
            }
          }
          match = headingPattern.exec(xml);
        }
      }
    }

    // Get plain text via mammoth
    const result = await mammoth.extractRawText({ buffer });
    const plainText = result.value.slice(0, 2000);

    const headingList =
      headings.length > 0 ? `\nHeadings:\n${headings.map((h) => `- ${h}`).join('\n')}\n\n` : '';

    return `${headingList}${plainText}`;
  }

  private async extractXlsxPreview(storagePath: string): Promise<string> {
    const buffer = await this.storage.get(storagePath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return '';
    }

    const sheet = workbook.Sheets[firstSheetName];
    if (!sheet) {
      return '';
    }

    const csv: string = XLSX.utils.sheet_to_csv(sheet);
    const lines = csv.split('\n');

    // Header + first 20 rows
    const previewLines = lines.slice(0, 21);
    return `Sheet: ${firstSheetName}\n${previewLines.join('\n')}`;
  }

  private async extractEmailPreview(storagePath: string, mimeType: string): Promise<string> {
    const buffer = await this.storage.get(storagePath);

    if (mimeType === 'application/vnd.ms-outlook') {
      const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      const reader = new MsgReader(new DataView(ab));
      const data = reader.getFileData();
      const toAddresses = data.recipients
        ? data.recipients
            .map((r) => r.email || r.name)
            .filter(Boolean)
            .join(', ')
        : '';
      const headers = [
        `From: ${data.senderEmail ?? data.senderName ?? ''}`,
        `To: ${toAddresses}`,
        `Subject: ${data.subject ?? ''}`,
        `Date: ${data.clientSubmitTime ?? ''}`,
      ].join('\n');
      const body = (data.body ?? '').slice(0, 1000);
      return `${headers}\n\n${body}`;
    }

    const parsed = await simpleParser(buffer);
    const headers = [
      `From: ${parsed.from?.text ?? ''}`,
      `To: ${parsed.to ? (Array.isArray(parsed.to) ? parsed.to.map((t) => t.text).join(', ') : parsed.to.text) : ''}`,
      `Subject: ${parsed.subject ?? ''}`,
      `Date: ${parsed.date ? parsed.date.toISOString() : ''}`,
    ].join('\n');

    const body = (parsed.text ?? '').slice(0, 1000);

    return `${headers}\n\n${body}`;
  }
}
