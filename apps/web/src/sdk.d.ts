/** Global set by /sdk/sdk.js IIFE */
interface Window {
  GrabdyChat?: new (config: {
    chatId: string;
    getToken: () => Promise<string>;
    onSourceClick?: (source: {
      type: string;
      dataSourceId: string;
      dataSourceName: string;
      sourceUrl: string | null;
      pages?: number[];
    }) => void;
    container?: string;
    position?: 'bottom-right' | 'bottom-left';
    bubble?: boolean;
    zIndex?: number;
    sdkUrl?: string;
    style?: {
      primaryColor?: string;
      accentColor?: string;
      logoUrl?: string;
      bubbleImageUrl?: string;
      title?: string;
      placeholder?: string;
      welcomeMessage?: string;
    };
  }) => {
    destroy: () => void;
    open: () => void;
    close: () => void;
    refreshToken: () => Promise<void>;
  };
}
