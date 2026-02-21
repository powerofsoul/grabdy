export const redisKeys = {
  pendingSignup: (email: string) => `pending_signup:${email}`,
  signupRate: (email: string) => `signup_rate:${email}`,
  oauthState: (state: string) => `oauth_state:${state}`,
  loginAttempts: (ip: string) => `login_attempts:${ip}`,
  loginBlocked: (ip: string) => `login_blocked:${ip}`,
} as const;
