import type { DbId } from '@grabdy/common';

import type { JwtMembership, JwtPayload } from '../common/guards/auth.guard';

interface ApiKeyContext {
  orgId: DbId<'Org'>;
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
