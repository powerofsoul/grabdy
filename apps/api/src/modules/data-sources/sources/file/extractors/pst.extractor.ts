import { Injectable, Logger } from '@nestjs/common';

import { PSTFile, PSTFolder, PSTMessage } from 'pst-extractor';

import type { EmailExtractionResult } from '../../../services/chunking/extractor.interface';

const MAX_EMAILS = 500;

@Injectable()
export class PstExtractor {
  private readonly logger = new Logger(PstExtractor.name);

  /**
   * Extract emails from a PST file on disk.
   * Accepts a file path to avoid loading the entire PST into memory.
   */
  extract(filePath: string): EmailExtractionResult[] {
    const pst = new PSTFile(filePath);
    const emails: EmailExtractionResult[] = [];

    try {
      this.walkFolder(pst.getRootFolder(), emails);
    } finally {
      pst.close();
    }

    return emails;
  }

  private walkFolder(folder: PSTFolder, emails: EmailExtractionResult[]): void {
    if (emails.length >= MAX_EMAILS) return;

    // Process emails in this folder
    let message = folder.getNextChild();
    while (message) {
      if (emails.length >= MAX_EMAILS) {
        this.logger.warn(`PST extraction capped at ${MAX_EMAILS} emails`);
        return;
      }

      if (message instanceof PSTMessage) {
        // Only process actual email messages (skip calendar, contacts, tasks, etc.)
        const msgClass = message.messageClass;
        if (msgClass && !msgClass.startsWith('IPM.Note')) {
          message = folder.getNextChild();
          continue;
        }

        const email = this.extractMessage(message);
        if (email) {
          emails.push(email);
        }
      }
      message = folder.getNextChild();
    }

    // Recurse into subfolders
    if (folder.hasSubfolders) {
      for (const sub of folder.getSubFolders()) {
        if (emails.length >= MAX_EMAILS) return;
        this.walkFolder(sub, emails);
      }
    }
  }

  private extractMessage(message: PSTMessage): EmailExtractionResult | null {
    const bodyText = message.body ?? '';
    const subject = message.subject ?? '';

    // Skip empty messages (calendar items, contacts, etc.)
    if (!bodyText.trim() && !subject.trim()) return null;

    const from = message.senderEmailAddress
      ? `${message.senderName ?? ''} <${message.senderEmailAddress}>`.trim()
      : (message.senderName ?? '');

    const to: string[] = [];
    for (let i = 0; i < message.numberOfRecipients; i++) {
      const recipient = message.getRecipient(i);
      if (recipient) {
        to.push(recipient.emailAddress || recipient.displayName);
      }
    }

    const date = message.clientSubmitTime ? message.clientSubmitTime.toISOString() : '';
    const rfcMessageRef = message.internetMessageId || null;
    const bodyHtml = message.bodyHTML || undefined;

    // Extract attachments
    const attachments: EmailExtractionResult['attachments'] = [];
    for (let i = 0; i < message.numberOfAttachments; i++) {
      try {
        const att = message.getAttachment(i);
        const stream = att.fileInputStream;
        if (!stream || att.filesize <= 0) continue;

        const buf = Buffer.alloc(att.filesize);
        stream.readCompletely(buf);

        const filename = att.longFilename || att.filename || 'attachment';
        const mimeType = att.mimeTag || 'application/octet-stream';

        attachments.push({
          filename,
          mimeType,
          buffer: buf,
          size: att.filesize,
        });
      } catch (err) {
        this.logger.warn(`Failed to extract PST attachment ${i}: ${String(err)}`);
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
