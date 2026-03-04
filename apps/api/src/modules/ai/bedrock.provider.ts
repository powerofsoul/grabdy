import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import {
  CHAT_MODEL,
  CHAT_MODEL_VISION,
  ENRICHMENT_MODEL,
  IMAGE_VISION_MODEL,
} from '@grabdy/contracts';
import { type LanguageModelMiddleware, wrapLanguageModel } from 'ai';

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

/**
 * Middleware that fixes GPT-OSS models on Bedrock returning `end_turn` (mapped
 * to `stop`) even when the response contains tool calls. The AI SDK's tool loop
 * only continues when finishReason is `tool-calls`, so without this fix the
 * agent exits prematurely after tool calls and produces no text.
 *
 * @see https://github.com/strands-agents/sdk-python/issues/644
 */
const fixGptOssToolCallFinishReason: LanguageModelMiddleware = {
  specificationVersion: 'v3',
  wrapGenerate: async ({ doGenerate }) => {
    const result = await doGenerate();
    const hasToolCalls = result.content.some((c) => c.type === 'tool-call');
    if (hasToolCalls && result.finishReason.unified === 'stop') {
      return {
        ...result,
        finishReason: {
          unified: 'tool-calls' satisfies 'tool-calls',
          raw: result.finishReason.raw,
        },
      };
    }
    return result;
  },

  wrapStream: async ({ doStream }) => {
    const result = await doStream();
    let hasToolCalls = false;

    const transformedStream = result.stream.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          if (chunk.type === 'tool-call') {
            hasToolCalls = true;
          }

          if (chunk.type === 'finish' && hasToolCalls && chunk.finishReason.unified === 'stop') {
            controller.enqueue({
              ...chunk,
              finishReason: {
                unified: 'tool-calls' satisfies 'tool-calls',
                raw: chunk.finishReason.raw,
              },
            });
            return;
          }

          controller.enqueue(chunk);
        },
      })
    );

    return { ...result, stream: transformedStream };
  },
};

/** Default chat model for agents (with GPT-OSS tool-call fix). */
export const CHAT_LANGUAGE_MODEL = wrapLanguageModel({
  model: bedrockAiSdk(CHAT_MODEL.replace('amazon-bedrock/', '')),
  middleware: fixGptOssToolCallFinishReason,
});

/** Vision-capable model for image analysis tool delegation. */
export const CHAT_VISION_LANGUAGE_MODEL = bedrockAiSdk(
  CHAT_MODEL_VISION.replace('amazon-bedrock/', '')
);

/** Lightweight model for enrichment tasks (classification, chunk contexts). */
export const ENRICHMENT_LANGUAGE_MODEL = bedrockAiSdk(
  ENRICHMENT_MODEL.replace('amazon-bedrock/', '')
);

/** Multimodal model for image description (Nova Lite, ~16x cheaper than Haiku). */
export const IMAGE_VISION_LANGUAGE_MODEL = bedrockAiSdk(
  IMAGE_VISION_MODEL.replace('amazon-bedrock/', '')
);
