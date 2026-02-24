import { Injectable } from '@nestjs/common';

import type { UploadsMime } from '@grabdy/contracts';
import type { Queue } from 'bullmq';

import { InjectTypedQueue } from '../../queue/queue.decorators';

import type { DataSourceJobData } from './data-source.types';

@Injectable()
export class DataSourceDispatchService {
  constructor(
    @InjectTypedQueue('ds-pdf') private pdfQueue: Queue,
    @InjectTypedQueue('ds-docx') private docxQueue: Queue,
    @InjectTypedQueue('ds-csv') private csvQueue: Queue,
    @InjectTypedQueue('ds-xlsx') private xlsxQueue: Queue,
    @InjectTypedQueue('ds-text') private textQueue: Queue,
    @InjectTypedQueue('ds-image') private imageQueue: Queue,
    @InjectTypedQueue('ds-messages') private messagesQueue: Queue
  ) {}

  async dispatch(jobData: DataSourceJobData): Promise<void> {
    const queue = this.getQueueForJob(jobData);
    await queue.add('process', jobData, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }

  private getQueueForJob(jobData: DataSourceJobData): Queue {
    if (jobData.messages || jobData.content) {
      return this.messagesQueue;
    }
    return this.getQueueForMime(jobData.mimeType);
  }

  private getQueueForMime(mimeType: UploadsMime): Queue {
    switch (mimeType) {
      case 'application/pdf':
        return this.pdfQueue;
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'application/msword':
        return this.docxQueue;
      case 'text/csv':
        return this.csvQueue;
      case 'text/plain':
      case 'application/json':
        return this.textQueue;
      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      case 'application/vnd.ms-excel':
        return this.xlsxQueue;
      case 'image/png':
      case 'image/jpeg':
      case 'image/webp':
      case 'image/gif':
        return this.imageQueue;
    }
  }
}
