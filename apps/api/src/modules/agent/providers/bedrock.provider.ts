import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';

export const BEDROCK_CLIENT = Symbol('BEDROCK_CLIENT');

export const bedrockProvider = {
  provide: BEDROCK_CLIENT,
  useFactory: () => new BedrockRuntimeClient({}),
};
