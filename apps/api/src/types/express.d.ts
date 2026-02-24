import type { DbId } from '@grabdy/common';
import type { SdkChatSourceConfig } from '@grabdy/contracts';

import type { JwtMembership, JwtPayload } from '../common/guards/auth.guard';

interface ApiKeyContext {
  orgId: DbId<'Org'>;
}

interface SdkAuthContext {
  orgId: DbId<'Org'>;
  sdkChatId: DbId<'SdkChat'>;
  externalUser: string;
  dataSourceConfig: SdkChatSourceConfig;
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
