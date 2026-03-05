import type { JwtMembership, JwtPayload } from '../common/guards/auth.guard';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      orgMembership?: JwtMembership;
    }
  }
}
