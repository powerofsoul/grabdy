import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import type { LanguageModel } from 'ai';

export function createBedrockModel(region: string, model: string): LanguageModel {
  const awsCredentials = fromNodeProviderChain();
  const bedrockProvider = createAmazonBedrock({
    region,
    credentialProvider: async () => {
      const creds = await awsCredentials();
      return {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
        sessionToken: creds.sessionToken,
      };
    },
  });
  return bedrockProvider(model);
}
