import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { GetParametersByPathCommand, SSMClient } from '@aws-sdk/client-ssm';
import { z } from 'zod';

const rdsSecretSchema = z.object({ username: z.string(), password: z.string() });

/**
 * Fetches secrets from AWS SSM Parameter Store and populates process.env.
 * Also constructs DATABASE_URL from the RDS Secrets Manager secret.
 * Only runs when SSM_PREFIX is set (production). In dev, .env is used as-is.
 *
 * Parameter naming: /grabdy/{stage}/PARAMETER_NAME → process.env.PARAMETER_NAME
 */
export async function loadSsmParameters(): Promise<void> {
  const prefix = process.env.SSM_PREFIX;
  if (!prefix) return;

  const region = process.env.AWS_REGION || 'eu-central-1';

  await Promise.all([loadFromSsm(prefix, region), loadDatabaseUrl(region)]);
}

async function loadFromSsm(prefix: string, region: string): Promise<void> {
  const client = new SSMClient({ region });

  const parameters: Array<{ Name: string; Value: string }> = [];
  let nextToken: string | undefined;

  do {
    const command = new GetParametersByPathCommand({
      Path: prefix,
      WithDecryption: true,
      Recursive: false,
      MaxResults: 10,
      ...(nextToken ? { NextToken: nextToken } : {}),
    });

    const response = await client.send(command);

    if (response.Parameters) {
      for (const param of response.Parameters) {
        if (param.Name && param.Value) {
          parameters.push({ Name: param.Name, Value: param.Value });
        }
      }
    }

    nextToken = response.NextToken;
  } while (nextToken);

  // Map parameter names to env var keys
  // e.g., /grabdy/prod/JWT_SECRET → JWT_SECRET
  const prefixWithSlash = prefix.endsWith('/') ? prefix : `${prefix}/`;

  for (const param of parameters) {
    const envKey = param.Name.replace(prefixWithSlash, '');
    process.env[envKey] = param.Value;
  }

  console.log(`Loaded ${parameters.length} parameters from SSM (${prefix})`);
}

/**
 * Fetches the RDS master password from Secrets Manager and constructs DATABASE_URL.
 * The secret ARN and DB endpoint are passed as ECS env vars by Pulumi.
 */
async function loadDatabaseUrl(region: string): Promise<void> {
  const secretArn = process.env.DB_SECRET_ARN;
  const endpoint = process.env.DB_ENDPOINT;
  if (!secretArn || !endpoint) return;

  const client = new SecretsManagerClient({ region });
  const response = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));

  if (!response.SecretString) {
    throw new Error('RDS secret is empty');
  }

  // RDS-managed secrets have shape: { username, password, engine, host, port, dbname, ... }
  const { username, password } = rdsSecretSchema.parse(JSON.parse(response.SecretString));

  process.env.DATABASE_URL = `postgresql://${username}:${encodeURIComponent(password)}@${endpoint}/grabdy`;

  console.log('Constructed DATABASE_URL from Secrets Manager');
}
