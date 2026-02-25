import { GetParametersByPathCommand, SSMClient } from '@aws-sdk/client-ssm';

/**
 * Fetches secrets from AWS SSM Parameter Store and populates process.env.
 * Also constructs DATABASE_URL from DB_USERNAME, DB_PASSWORD, and DB_ENDPOINT.
 * Only runs when SSM_PREFIX is set (production). In dev, .env is used as-is.
 *
 * Parameter naming: /grabdy/{stage}/PARAMETER_NAME -> process.env.PARAMETER_NAME
 */
export async function loadSsmParameters(): Promise<void> {
  const prefix = process.env.SSM_PREFIX;
  if (!prefix) return;

  const region = process.env.AWS_REGION || 'eu-central-1';

  await loadFromSsm(prefix, region);

  buildDatabaseUrl();
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
  // e.g., /grabdy/prod/JWT_SECRET -> JWT_SECRET
  const prefixWithSlash = prefix.endsWith('/') ? prefix : `${prefix}/`;

  for (const param of parameters) {
    const envKey = param.Name.replace(prefixWithSlash, '');
    process.env[envKey] = param.Value;
  }

  console.log(`Loaded ${parameters.length} parameters from SSM (${prefix})`);
}

/**
 * Constructs DATABASE_URL from SSM-provided DB_USERNAME, DB_PASSWORD, and
 * the ECS-injected DB_ENDPOINT environment variable.
 */
function buildDatabaseUrl(): void {
  const username = process.env.DB_USERNAME;
  const password = process.env.DB_PASSWORD;
  const endpoint = process.env.DB_ENDPOINT;

  if (!username || !password || !endpoint) {
    throw new Error(
      'Missing DB_USERNAME, DB_PASSWORD (from SSM), or DB_ENDPOINT (from ECS env). Cannot construct DATABASE_URL.'
    );
  }

  process.env.DATABASE_URL = `postgresql://${username}:${encodeURIComponent(password)}@${endpoint}/grabdy`;

  console.log('Constructed DATABASE_URL from SSM parameters');
}
