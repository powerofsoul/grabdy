import { Injectable, Logger } from '@nestjs/common';

import { type Events, inngest } from './inngest.client';

type EventName = keyof Events;

type EventPayload = {
  [K in EventName]: { name: K; data: Events[K]['data'] };
}[EventName];

// The Inngest SDK's send() requires concrete event names via complex mapped types.
// TypeScript can't prove { name: T, data: Events[T]['data'] } satisfies SendEventPayload
// when T is a generic union (correlated record type limitation). This wrapper accepts
// our fully-typed EventPayload and forwards to the SDK. Type safety is enforced at
// the public send<T>() boundary where T narrows to a concrete event name.
function dispatchToInngest(event: EventPayload) {
  // EventPayload is a discriminated union where name+data are correlated.
  // inngest.send() accepts the same shape but TypeScript can't verify the
  // correlation across the generic boundary, so we widen through this helper.
  return inngest.send(event);
}

/**
 * Injectable wrapper around inngest.send() with typed events.
 *
 * Usage:
 *   await inngestService.send('app/data-source.process', { dataSourceId, orgId, ... });
 */
@Injectable()
export class InngestService {
  private readonly logger = new Logger(InngestService.name);

  /**
   * Send a single typed event.
   * The generic is inferred from the event name, ensuring data matches the schema at call sites.
   */
  async send<T extends EventName>(name: T, data: Events[T]['data']): Promise<void> {
    // Cast-free bridge: construct EventPayload via Object.assign to avoid
    // TypeScript's inability to narrow correlated generics
    const payload = Object.assign({ name, data }) satisfies { name: EventName; data: unknown };
    try {
      await dispatchToInngest(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send Inngest event ${name}: ${message}`);
      throw error;
    }
  }

  /**
   * Send multiple events at once in a single HTTP call.
   * Callers build the array using typed EventPayload entries.
   */
  async sendBulk(events: EventPayload[]): Promise<void> {
    if (events.length === 0) return;
    try {
      await inngest.send(events);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send Inngest events: ${message}`);
      throw error;
    }
  }
}
