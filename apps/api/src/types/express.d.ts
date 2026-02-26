import type { DbId } from '@grabdy/common';
import type { BotSourceConfig } from '@grabdy/contracts';

import type { JwtMembership, JwtPayload } from '../common/guards/auth.guard';

interface ApiKeyContext {
  orgId: DbId<'Org'>;
}

interface SdkAuthContext {
  orgId: DbId<'Org'>;
  botId: DbId<'Bot'>;
  externalUser: string;
  dataSourceConfig: BotSourceConfig;
  systemPrompt: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      orgMembership?: JwtMembership;
      apiKey?: ApiKeyContext;
      sdkAuth?: SdkAuthContext;
    }
  }
}
