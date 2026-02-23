import type { DbId } from '@grabdy/common';
import type {
  AiCallerType,
  AiRequestSource,
  AiRequestType,
  ModelKey,
  SyncTrigger,
} from '@grabdy/contracts';
import { EventSchemas, type GetStepTools, Inngest } from 'inngest';

import type { CanvasOp } from '../modules/chat/processors/canvas-ops.types';
import type { DataSourceJobData } from '../modules/data-sources/data-source.types';
import type { WebhookEvent } from '../modules/integrations/connector.interface';
import type { SlackBotJobData } from '../modules/integrations/providers/slack/slack-bot.service';

type Events = {
  'app/data-source.process': {
    data: DataSourceJobData;
  };

  'app/canvas-ops.execute': {
    data: { op: CanvasOp; orgId: DbId<'Org'>; threadId: DbId<'ChatThread'> };
  };

  'app/integration.discover': {
    data: {
      connectionId: DbId<'Connection'>;
      orgId: DbId<'Org'>;
      trigger: SyncTrigger;
    };
  };

  'app/integration.process-item': {
    data: {
      connectionId: DbId<'Connection'>;
      orgId: DbId<'Org'>;
      event: WebhookEvent;
    };
  };

  'app/slack-bot.handle': {
    data: SlackBotJobData;
  };

  'app/email.send': {
    data: {
      orgId: DbId<'Org'> | null;
      to: string;
    } & (
      | { type: 'verification-otp'; payload: { name: string; otp: string } }
      | { type: 'welcome'; payload: { name: string } }
      | { type: 'password-reset'; payload: { name: string; otp: string } }
      | { type: 'org-invite'; payload: { orgName: string; token: string } }
    );
  };

  'app/notification.slack': {
    data: {
      orgId: DbId<'Org'> | null;
      type: 'new-signup' | 'demo-request' | 'maintenance-alert';
      text: string;
    };
  };

  'app/data-source.cleanup': {
    data: {
      orgId: DbId<'Org'>;
      dataSourceId: DbId<'DataSource'>;
      storagePath: string;
    };
  };

  'app/connection.cleanup': {
    data: {
      orgId: DbId<'Org'>;
      connectionId: DbId<'Connection'>;
    };
  };

  'app/ai-usage.log': {
    data: {
      orgId: DbId<'Org'>;
      model: ModelKey;
      provider: string;
      callerType: AiCallerType;
      requestType: AiRequestType;
      source: AiRequestSource;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      cost: number;
      userId: DbId<'User'> | null;
      durationMs: number | null;
      finishReason: string | null;
      streaming: boolean;
    };
  };

  'app/maintenance.stale-processing': {
    data: Record<string, never>;
  };

  'app/integration.scheduled-sync': {
    data: Record<string, never>;
  };
};

export const inngest = new Inngest({
  id: 'grabdy',
  schemas: new EventSchemas().fromRecord<Events>(),
});

export type { Events };

export type InngestStepTools = GetStepTools<typeof inngest>;
