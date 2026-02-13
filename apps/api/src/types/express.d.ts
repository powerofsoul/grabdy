import type { DbId, OrgNumericId } from '@grabdy/common';

import type { JwtMembership, JwtPayload } from '../common/guards/auth.guard';

interface ApiKeyContext {
  orgId: DbId<'Org'>;
  orgNumericId: OrgNumericId;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      orgMembership?: JwtMembership;
      apiKey?: ApiKeyContext;
    }
  }
}
