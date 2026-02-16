export const AiCallerType = {
  MEMBER: 'MEMBER',
  SYSTEM: 'SYSTEM',
  API_KEY: 'API_KEY',
} as const;
export type AiCallerType = (typeof AiCallerType)[keyof typeof AiCallerType];

export const AiRequestType = {
  CHAT: 'CHAT',
  EMBEDDING: 'EMBEDDING',
} as const;
export type AiRequestType = (typeof AiRequestType)[keyof typeof AiRequestType];

export const AiRequestSource = {
  WEB: 'WEB',
  SLACK: 'SLACK',
  API: 'API',
  MCP: 'MCP',
  SYSTEM: 'SYSTEM',
} as const;
export type AiRequestSource = (typeof AiRequestSource)[keyof typeof AiRequestSource];

/** Fenced code block names the AI can output in chat responses. */
export const StreamBlock = {
  THINKING: 'thinking',
  SOURCES: 'sources',
} as const;
export type StreamBlock = (typeof StreamBlock)[keyof typeof StreamBlock];
