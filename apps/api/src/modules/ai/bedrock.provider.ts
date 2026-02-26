import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { CHAT_MODEL, CHAT_MODEL_VISION } from '@grabdy/contracts';

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

/** Vision-capable model for image analysis tool delegation. */
export const CHAT_VISION_LANGUAGE_MODEL = bedrockAiSdk(
  CHAT_MODEL_VISION.replace('amazon-bedrock/', '')
);
