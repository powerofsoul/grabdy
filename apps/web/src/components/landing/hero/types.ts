export type HeroCardId =
  | 'hub'
  | 'market'
  | 'competitors'
  | 'swot'
  | 'metrics'
  | 'channels'
  | 'risks'
  | 'recommendations'
  | 'roadmap'
  | 'summary';

export type SourceType = 'slack' | 'gdrive' | 'linear' | 'file';

export interface CardSource {
  type: SourceType;
  label: string;
}

export interface ChatMsg {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  sources?: string[];
  responseMs?: number;
}
