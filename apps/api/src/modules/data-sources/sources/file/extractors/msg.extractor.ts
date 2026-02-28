import { Injectable, Logger } from '@nestjs/common';

import MsgReader from '@kenjiuno/msgreader';
import { lookup } from 'mime-types';

import type { EmailExtractionResult } from '../../../services/chunking/extractor.interface';

@Injectable()
export class MsgExtractor {
  private readonly logger = new Logger(MsgExtractor.name);

  extract(buffer: Buffer): EmailExtractionResult {
    const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const reader = new MsgReader(new DataView(ab));
    const data = reader.getFileData();

    const from = data.senderEmail
      ? `${data.senderName ?? ''} <${data.senderEmail}>`.trim()
      : (data.senderName ?? '');

    const to: string[] = [];
    if (data.recipients) {
      for (const r of data.recipients) {
        if (r.email) {
          to.push(r.email);
        } else if (r.name) {
          to.push(r.name);
        }
      }
    }

    const subject = data.subject ?? '';
    const date = data.clientSubmitTime ?? data.creationTime ?? '';
    const rfcMessageRef = extractMessageId(data.headers);

    const bodyText = data.body ?? '';
    const bodyHtml = typeof data.bodyHtml === 'string' ? data.bodyHtml : undefined;

    const attachments: EmailExtractionResult['attachments'] = [];
    if (data.attachments) {
      for (let i = 0; i < data.attachments.length; i++) {
        try {
          const att = data.attachments[i];
          const attData = reader.getAttachment(att);
          if (!attData.content) continue;

          const filename = attData.fileName ?? att.fileName ?? 'attachment';
          const contentBuffer = Buffer.from(attData.content);
          const mimeType = lookup(filename) || 'application/octet-stream';

          attachments.push({
            filename,
            mimeType,
            buffer: contentBuffer,
            size: contentBuffer.length,
          });
        } catch (err) {
          this.logger.warn(`Failed to extract MSG attachment ${i}: ${String(err)}`);
        }
      }
    }

    return {
      headers: { from, to, subject, date, rfcMessageRef },
      bodyText,
      bodyHtml,
      attachments,
    };
  }
}

function extractMessageId(headers: string | undefined): string | null {
  if (!headers) return null;
  const match = headers.match(/^message-id:\s*(.+)/im);
  return match ? match[1].trim() : null;
}
