import type { DbId, OrgNumericId } from '@fastdex/common';

import type { JwtPayload } from '../common/guards/auth.guard';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      apiKeyOrgId?: DbId<'Org'>;
      apiKeyOrgNumericId?: OrgNumericId;
    }
  }
}
