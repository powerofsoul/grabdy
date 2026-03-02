import { Injectable, Logger } from '@nestjs/common';

import type { DbId } from '@grabdy/common';
import type { Queue } from 'bullmq';

import { InjectTypedQueue } from '../../queue/queue.decorators';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(@InjectTypedQueue('notification') private notificationQueue: Queue) {}

  notifyNewSignup(email: string, name: string, method: 'email' | 'google'): void {
    this.notificationQueue
      .add('slack', {
        orgId: null,
        type: 'new-signup',
        text: `New signup: *${name}* (${email}) via ${method}`,
      })
      .catch((err) => {
        this.logger.error(`Failed to queue signup notification: ${err}`);
      });
  }

  notifyS3CleanupFailure(dataSourceId: DbId<'DataSource'>, failureCount: number): void {
    this.notificationQueue
      .add('slack', {
        orgId: null,
        type: 's3-cleanup-failure',
        text: `S3 cleanup failed during reprocess of DataSource ${dataSourceId}: ${failureCount} file(s) could not be deleted`,
      })
      .catch((err) => {
        this.logger.error(`Failed to queue S3 cleanup failure notification: ${err}`);
      });
  }

  notifyImageDescriptionFailure(
    dataSourceId: DbId<'DataSource'>,
    storagePath: string,
    pages: number[],
    error: string
  ): void {
    const pageLabel = pages.length > 0 ? ` (pages ${pages.join(', ')})` : '';
    const errorSnippet = error.length > 200 ? error.slice(0, 200) + '...' : error;
    this.notificationQueue
      .add('slack', {
        orgId: null,
        type: 'image-description-failure',
        text: `Image description failed for DataSource \`${dataSourceId}\`${pageLabel}\nS3: \`${storagePath}\`\nError: ${errorSnippet}`,
      })
      .catch((err) => {
        this.logger.error(`Failed to queue image description failure notification: ${err}`);
      });
  }

  notifyStaleProcessingCleanup(count: number, details: string): void {
    this.notificationQueue
      .add('slack', {
        orgId: null,
        type: 'stale-processing-cleanup',
        text: `Marked ${count} stale data source(s) as FAILED (stuck in PROCESSING with no queue job):\n${details}`,
      })
      .catch((err) => {
        this.logger.error(`Failed to queue stale processing notification: ${err}`);
      });
  }

  notifyDemoRequest(name: string, company: string, email: string): void {
    this.notificationQueue
      .add('slack', {
        orgId: null,
        type: 'demo-request',
        text: `Demo request: *${name}* from *${company}* (${email})`,
      })
      .catch((err) => {
        this.logger.error(`Failed to queue demo request notification: ${err}`);
      });
  }
}
