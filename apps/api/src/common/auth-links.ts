import { env } from '../config/env.config';

export const authLinks = {
  login: () => `${env.frontendUrl}/auth/login`,

  completeAccount: (token: string) => `${env.frontendUrl}/auth/complete-account?token=${token}`,
};
