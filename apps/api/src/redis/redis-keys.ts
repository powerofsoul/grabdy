export const redisKeys = {
  pendingSignup: (email: string) => `pending_signup:${email}`,
  signupRate: (email: string) => `signup_rate:${email}`,
  oauthState: (state: string) => `oauth_state:${state}`,
} as const;
