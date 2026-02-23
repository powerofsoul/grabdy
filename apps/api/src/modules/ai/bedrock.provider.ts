import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { CHAT_MODEL } from '@grabdy/contracts';
import type { LanguageModel } from 'ai';

const awsCredentials = fromNodeProviderChain();

const bedrockAiSdk = createAmazonBedrock({
  credentialProvider: async () => {
    const creds = await awsCredentials();
    return {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    };
  },
});

/** Default chat model for agents. */
export const CHAT_LANGUAGE_MODEL = bedrockAiSdk(CHAT_MODEL.replace('amazon-bedrock/', ''));

/** Create a Bedrock language model by region and model ID. */
export function createBedrockModel(region: string, model: string): LanguageModel {
  const creds = fromNodeProviderChain();
  const provider = createAmazonBedrock({
    region,
    credentialProvider: async () => {
      const c = await creds();
      return {
        accessKeyId: c.accessKeyId,
        secretAccessKey: c.secretAccessKey,
        sessionToken: c.sessionToken,
      };
    },
  });
  return provider(model);
}
