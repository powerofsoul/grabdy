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
}

export interface PostMessageJwt {
  type: 'JWT';
  jwt: string;
  chatId: string;
}

export interface SdkAppearance {
  title: string | null;
  subtitle: string | null;
  placeholder: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
}
