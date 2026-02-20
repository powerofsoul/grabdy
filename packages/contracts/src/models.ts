export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

export interface ModelInfo {
  label: string;
  provider: string;
  contextWindow: number;
  maxOutput: number;
  pricing: ModelPricing;
}

export const MODEL_INFO = {
  'openai/gpt-5-mini': {
    label: 'GPT-5 Mini',
    provider: 'OpenAI',
    contextWindow: 1047576,
    maxOutput: 32768,
    pricing: { inputPerMillion: 0.3, outputPerMillion: 1.25 },
  },
  'openai/gpt-4o-mini': {
    label: 'GPT-4o Mini',
    provider: 'OpenAI',
    contextWindow: 128000,
    maxOutput: 16384,
    pricing: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  },
  'openai/text-embedding-3-small': {
    label: 'Embedding 3 Small',
    provider: 'OpenAI',
    contextWindow: 8191,
    maxOutput: 0,
    pricing: { inputPerMillion: 0.02, outputPerMillion: 0 },
  },
  'bedrock/cohere.rerank-v3-5:0': {
    label: 'Cohere Rerank 3.5',
    provider: 'Bedrock',
    contextWindow: 4096,
    maxOutput: 0,
    pricing: { inputPerMillion: 2.0, outputPerMillion: 0 },
  },
  'amazon-bedrock/us.anthropic.claude-haiku-4-5-20251001-v1:0': {
    label: 'Claude Haiku 4.5',
    provider: 'Bedrock',
    contextWindow: 200000,
    maxOutput: 8192,
    pricing: { inputPerMillion: 0.8, outputPerMillion: 4.0 },
  },
} satisfies Record<string, ModelInfo>;

export type ModelId = keyof typeof MODEL_INFO;

export const CHAT_MODEL: ModelId = 'amazon-bedrock/us.anthropic.claude-haiku-4-5-20251001-v1:0';
export const EMBEDDING_MODEL: ModelId = 'openai/text-embedding-3-small';
export const RERANK_MODEL: ModelId = 'bedrock/cohere.rerank-v3-5:0';
export const HYDE_MODEL: ModelId = 'openai/gpt-4o-mini';
export function calculateCost(model: ModelId, inputTokens: number, outputTokens: number): number {
  const { pricing } = MODEL_INFO[model];
  return (
    (inputTokens / 1_000_000) * pricing.inputPerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion
  );
}
