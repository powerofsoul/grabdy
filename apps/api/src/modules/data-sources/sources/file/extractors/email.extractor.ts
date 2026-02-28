import { Injectable } from '@nestjs/common';

import { simpleParser } from 'mailparser';

import type { EmailExtractionResult } from '../../../services/chunking/extractor.interface';

function addressToStrings(field: Awaited<ReturnType<typeof simpleParser>>['to']): string[] {
  if (!field) return [];
  const objects = Array.isArray(field) ? field : [field];
  return objects.flatMap((obj) =>
    obj.value.map((addr) => addr.address ?? addr.name).filter((v): v is string => v !== undefined)
  );
}

@Injectable()
export class EmailExtractor {
  async extract(buffer: Buffer): Promise<EmailExtractionResult> {
    const parsed = await simpleParser(buffer);

    const from = parsed.from?.text ?? '';
    const to = addressToStrings(parsed.to);
    const subject = parsed.subject ?? '';
    const date = parsed.date ? parsed.date.toISOString() : '';
    const rfcMessageRef = parsed.messageId ?? null;

    const bodyText = parsed.text ?? '';
    const bodyHtml = parsed.html === false ? undefined : parsed.html || undefined;

    const attachments = parsed.attachments.map((att) => ({
      filename: att.filename ?? 'attachment',
      mimeType: att.contentType,
      buffer: att.content,
      size: att.size,
    }));

    return {
      headers: { from, to, subject, date, rfcMessageRef },
      bodyText,
      bodyHtml,
      attachments,
    };
  }
}
