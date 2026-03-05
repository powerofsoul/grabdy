export const AiCallerType = {
  MEMBER: 'MEMBER',
  SYSTEM: 'SYSTEM',
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
  SYSTEM: 'SYSTEM',
} as const;
export type AiRequestSource = (typeof AiRequestSource)[keyof typeof AiRequestSource];
