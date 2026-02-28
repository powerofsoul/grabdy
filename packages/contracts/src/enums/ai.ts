export const AiCallerType = {
  MEMBER: 'MEMBER',
  SYSTEM: 'SYSTEM',
  API_KEY: 'API_KEY',
  SDK_JWT: 'SDK_JWT',
} as const;
export type AiCallerType = (typeof AiCallerType)[keyof typeof AiCallerType];

export const AiRequestType = {
  CHAT: 'CHAT',
  EMBEDDING: 'EMBEDDING',
  RERANK: 'RERANK',
  HYDE: 'HYDE',
  SUMMARY: 'SUMMARY',
  CLASSIFICATION: 'CLASSIFICATION',
  ENRICHMENT: 'ENRICHMENT',
  IMAGE_ANALYSIS: 'IMAGE_ANALYSIS',
} as const;
export type AiRequestType = (typeof AiRequestType)[keyof typeof AiRequestType];

export const AiRequestSource = {
  WEB: 'WEB',
  SLACK: 'SLACK',
  API: 'API',
  MCP: 'MCP',
  SYSTEM: 'SYSTEM',
  SDK: 'SDK',
} as const;
export type AiRequestSource = (typeof AiRequestSource)[keyof typeof AiRequestSource];
