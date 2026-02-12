import type { DbId, OrgNumericId } from '@grabdy/common';

import type { JwtMembership, JwtPayload } from '../common/guards/auth.guard';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      orgMembership?: JwtMembership;
      apiKeyOrgId?: DbId<'Org'>;
      apiKeyOrgNumericId?: OrgNumericId;
    }
  }
}
