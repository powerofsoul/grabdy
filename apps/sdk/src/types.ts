export interface GrabdyChatStyle {
  primaryColor?: string;
  accentColor?: string;
  logoUrl?: string;
  bubbleImageUrl?: string;
  title?: string;
  placeholder?: string;
  welcomeMessage?: string;
}

export interface GrabdyChatSource {
  type: string;
  dataSourceId: string;
  dataSourceName: string;
  sourceUrl: string | null;
  pages?: number[];
}

export interface GrabdyChatConfig {
  chatId: string;
  getToken: () => Promise<string>;
  onSourceClick?: (source: GrabdyChatSource) => void;
  container?: string;
  position?: 'bottom-right' | 'bottom-left';
  bubble?: boolean;
  zIndex?: number;
  sdkUrl?: string;
  style?: GrabdyChatStyle;
}

export interface PostMessageJwt {
  type: 'JWT';
  jwt: string;
  chatId: string;
  style?: GrabdyChatStyle;
}
