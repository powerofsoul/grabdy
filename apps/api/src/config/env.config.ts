import { Global, Inject, Module } from '@nestjs/common';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function requiredInProd(name: string, devDefault: string): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required env in production: ${name}`);
  }
  return devDefault;
}

/**
 * Single source of truth for all environment configuration.
 * Add new env variables here - @InjectEnv keys are inferred automatically.
 */
export const env = {
  port: parseInt(process.env.API_PORT || '4000', 10),
  nodeEnv: (() => {
    const value = process.env.NODE_ENV || 'development';
    if (value === 'development' || value === 'production' || value === 'test') {
      return value;
    }
    return 'development';
  })(),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  apiUrl: process.env.API_URL || 'http://localhost:4000',

  openaiApiKey: required('OPENAI_API_KEY'),
  jwtSecret: required('JWT_SECRET'),
  databaseUrl: required('DATABASE_URL'),

  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
  redisPassword: process.env.REDIS_PASSWORD,

  s3UploadsBucket: requiredInProd('S3_UPLOADS_BUCKET', 'grabdy-uploads-dev'),
  awsRegion: process.env.AWS_REGION || 'eu-central-1',

  sesFromEmail: process.env.SES_FROM_EMAIL || 'Grabdy <noreply@grabdy.com>',

  adminApiKey: required('ADMIN_API_KEY'),

  bullBoardUsername: requiredInProd('BULL_BOARD_USERNAME', 'admin'),
  bullBoardPassword: requiredInProd('BULL_BOARD_PASSWORD', 'admin'),

  // Integration encryption
  integrationEncryptionKey: requiredInProd(
    'INTEGRATION_ENCRYPTION_KEY',
    'dev-encryption-key-32chars-paddd'
  ),

  // Slack
  slackClientId: requiredInProd('SLACK_CLIENT_ID', ''),
  slackClientSecret: requiredInProd('SLACK_CLIENT_SECRET', ''),
  slackSigningSecret: requiredInProd('SLACK_SIGNING_SECRET', ''),

  // Waitlist Slack webhook
  slackWebhookUrl: requiredInProd('SLACK_WEBHOOK_URL', ''),
} as const;

type EnvKey = keyof typeof env;

// Type guard for EnvKey
function isEnvKey(key: string): key is EnvKey {
  return key in env;
}

// Type-safe helper to get env keys
function getEnvKeys(): EnvKey[] {
  return Object.keys(env).filter(isEnvKey);
}

// Create injection tokens using a Map for type safety
const tokenMap = new Map<EnvKey, symbol>();
for (const key of getEnvKeys()) {
  tokenMap.set(key, Symbol(key));
}

/**
 * Type-safe environment injection.
 *
 * @example
 * constructor(@InjectEnv('databaseUrl') private dbUrl: string) {}
 *
 * // Typos fail at compile time:
 * @InjectEnv('databaseUrll') // Error: not assignable to EnvKey
 */
export function InjectEnv<K extends EnvKey>(key: K) {
  const token = tokenMap.get(key);
  if (!token) {
    throw new Error(`Unknown env key: ${key}`);
  }
  return Inject(token);
}

// Auto-generate providers
const envProviders = getEnvKeys().map((key) => {
  const token = tokenMap.get(key);
  if (!token) {
    throw new Error(`Missing token for env key: ${key}`);
  }
  return {
    provide: token,
    useValue: env[key],
  };
});

@Global()
@Module({
  providers: envProviders,
  exports: envProviders.map((p) => p.provide),
})
export class EnvModule {}
