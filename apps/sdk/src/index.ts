import type {
  GrabdyChatConfig,
  PostMessageJwt,
  SdkAppearance,
} from './types';

declare const __SDK_URL__: string | undefined;
declare const __API_URL__: string | undefined;
const DEFAULT_SDK_URL = typeof __SDK_URL__ !== 'undefined' ? __SDK_URL__ : 'https://grabdy.com';
const DEFAULT_API_URL = typeof __API_URL__ !== 'undefined' ? __API_URL__ : 'https://api.grabdy.com';

const DEFAULT_Z_INDEX = 999999;
const BUTTON_SIZE = 56;
const MARGIN = 20;
const IFRAME_WIDTH = 400;
const IFRAME_HEIGHT = 600;
const MOBILE_BREAKPOINT = 768;

const CHAT_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 256 256" fill="white"><path d="M216,48H40A16,16,0,0,0,24,64V224a15.85,15.85,0,0,0,9.24,14.5A16.13,16.13,0,0,0,40,240a15.89,15.89,0,0,0,10.25-3.78l.09-.07L83,208H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48ZM216,192H80a8,8,0,0,0-5.23,1.95L40,224V64H216Z"/></svg>`;

const CLOSE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 256 256" fill="white"><path d="M205.66,50.34a8,8,0,0,0-11.32,0L128,116.69,61.66,50.34A8,8,0,0,0,50.34,61.66L116.69,128,50.34,194.34a8,8,0,0,0,11.32,11.32L128,139.31l66.34,66.35a8,8,0,0,0,11.32-11.32L139.31,128l66.35-66.34A8,8,0,0,0,205.66,50.34Z"/></svg>`;

let instance: GrabdyChat | null = null;

class GrabdyChat {
  private config: GrabdyChatConfig;
  private appearance: SdkAppearance | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private previewIframe: HTMLIFrameElement | null = null;
  private button: HTMLElement | null = null;
  private buttonLogo: HTMLImageElement | null = null;
  private tooltip: HTMLElement | null = null;
  private container: HTMLElement | null = null;
  private sourceModal: HTMLElement | null = null;
  private sourceModalEscHandler: ((e: KeyboardEvent) => void) | null = null;
  private isOpen = false;
  private sdkUrl: string;
  private sdkOrigin: string;
  private apiUrl: string;
  private zIndex: number;
  private messageHandler: ((e: MessageEvent) => void) | null = null;
  private iframeReady = false;
  private tokenPending = false;

  constructor(config: GrabdyChatConfig) {
    if (instance) {
      throw new Error('GrabdyChat: already initialized. Call destroy() before creating a new instance.');
    }
    if (!config.chatId) {
      throw new Error('GrabdyChat: chatId is required');
    }
    if (!config.getToken) {
      throw new Error('GrabdyChat: getToken is required');
    }

    instance = this;
    this.config = config;
    this.sdkUrl = config.sdkUrl ?? DEFAULT_SDK_URL;
    this.sdkOrigin = new URL(this.sdkUrl).origin;
    this.apiUrl = config.apiUrl ?? DEFAULT_API_URL;
    this.zIndex = config.zIndex ?? DEFAULT_Z_INDEX;

    this.messageHandler = this.handleMessage.bind(this);
    window.addEventListener('message', this.messageHandler);

    // Fetch appearance from API, then create UI
    this.fetchAppearance().then(() => {
      if (config.container) {
        this.mountInline(config.container);
      } else if (config.bubble !== false) {
        this.createButton();
      }
    });
  }

  private async fetchAppearance(): Promise<void> {
    try {
      const res = await fetch(
        `${this.apiUrl}/sdk/chat/${encodeURIComponent(this.config.chatId)}/config`
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          this.appearance = json.data;
        }
      }
    } catch (err) {
      console.error('GrabdyChat: failed to fetch appearance', err);
    }
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.dismissTooltip();

    if (!this.iframe) {
      this.createIframe();
    }

    if (this.config.container) {
      return;
    }

    if (this.iframe) {
      this.iframe.style.display = 'block';
      requestAnimationFrame(() => {
        if (this.iframe) {
          this.iframe.style.opacity = '1';
          this.iframe.style.transform = 'translateY(0)';
        }
      });
    }

    if (this.button) {
      if (this.buttonLogo) {
        this.buttonLogo.style.display = 'none';
      }
      // Replace content with close icon
      const existing = this.button.querySelector('.grabdy-close');
      if (!existing) {
        // Hide the default icon wrapper
        const iconWrapper = this.button.querySelector('span:not(.grabdy-close)');
        if (iconWrapper instanceof HTMLElement) iconWrapper.style.display = 'none';

        const closeWrapper = document.createElement('span');
        closeWrapper.className = 'grabdy-close';
        Object.assign(closeWrapper.style, {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        });
        closeWrapper.innerHTML = CLOSE_ICON_SVG;
        this.button.appendChild(closeWrapper);
      }
    }
  }

  close(): void {
    if (!this.isOpen || this.config.container) return;
    this.isOpen = false;

    if (this.iframe) {
      this.iframe.style.opacity = '0';
      this.iframe.style.transform = 'translateY(10px)';
      setTimeout(() => {
        if (this.iframe && !this.isOpen) {
          this.iframe.style.display = 'none';
        }
      }, 200);
    }

    if (this.button) {
      const closeEl = this.button.querySelector('.grabdy-close');
      if (closeEl) closeEl.remove();
      if (this.buttonLogo) {
        this.buttonLogo.style.display = 'block';
      } else {
        const iconWrapper = this.button.querySelector('span');
        if (iconWrapper instanceof HTMLElement) iconWrapper.style.display = 'flex';
      }
    }
  }

  async refreshToken(): Promise<void> {
    if (this.iframe?.contentWindow) {
      await this.sendTokenTo(this.iframe.contentWindow);
    }
  }

  destroy(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }

    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }

    if (this.button) {
      this.button.remove();
      this.button = null;
      this.buttonLogo = null;
    }

    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }

    this.closeSourceModal();

    if (this.container) {
      this.container = null;
    }

    this.isOpen = false;
    this.iframeReady = false;
    instance = null;
  }

  private handleMessage(e: MessageEvent): void {
    if (e.origin !== this.sdkOrigin) return;

    const data: unknown = e.data;
    if (!data || typeof data !== 'object' || !('type' in data) || typeof data.type !== 'string') return;

    const previewWindow = this.previewIframe?.contentWindow;
    const chatWindow = this.iframe?.contentWindow;

    switch (data.type) {
      case 'READY':
        if (previewWindow && e.source === previewWindow) {
          void this.sendTokenTo(previewWindow);
        } else if (chatWindow && e.source === chatWindow) {
          this.iframeReady = true;
          void this.sendTokenTo(chatWindow);
        }
        break;
      case 'TOKEN_REFRESH':
        if (previewWindow && e.source === previewWindow) {
          void this.sendTokenTo(previewWindow);
        } else if (chatWindow && e.source === chatWindow) {
          void this.sendTokenTo(chatWindow);
        }
        break;
      case 'RESIZE':
        if (this.iframe && 'height' in data && typeof data.height === 'number' && data.height > 0) {
          this.iframe.style.height = `${data.height}px`;
        }
        break;
      case 'CLOSE':
        this.close();
        break;
      case 'OPEN_SOURCE':
        if (chatWindow && e.source === chatWindow && 'source' in data && data.source && typeof data.source === 'object') {
          const raw = data.source;
          if (
            'type' in raw && typeof raw.type === 'string' &&
            'dataSourceId' in raw && typeof raw.dataSourceId === 'string' &&
            'dataSourceName' in raw && typeof raw.dataSourceName === 'string'
          ) {
            const source: import('./types').GrabdyChatSource = {
              type: raw.type,
              dataSourceId: raw.dataSourceId,
              dataSourceName: raw.dataSourceName,
              sourceUrl: 'sourceUrl' in raw && typeof raw.sourceUrl === 'string' ? raw.sourceUrl : null,
              pages: 'pages' in raw && Array.isArray(raw.pages) ? raw.pages : undefined,
            };
            if (this.config.onSourceClick) {
              this.config.onSourceClick(source);
            } else {
              this.showSourceModal(source);
            }
          }
        }
        break;
    }
  }

  private async sendTokenTo(target: Window): Promise<void> {
    if (this.tokenPending) return;
    this.tokenPending = true;
    try {
      const jwt = await this.config.getToken();
      const msg: PostMessageJwt = {
        type: 'JWT',
        jwt,
        chatId: this.config.chatId,
      };
      target.postMessage(msg, this.sdkOrigin);
    } catch (err) {
      console.error('GrabdyChat: failed to get token', err);
    } finally {
      this.tokenPending = false;
    }
  }

  private createButton(): void {
    const isLeft = this.config.position === 'bottom-left';
    const logoUrl = this.appearance?.logoUrl;
    const btn = document.createElement('div');

    Object.assign(btn.style, {
      position: 'fixed',
      bottom: `${MARGIN}px`,
      [isLeft ? 'left' : 'right']: `${MARGIN}px`,
      width: `${BUTTON_SIZE}px`,
      height: `${BUTTON_SIZE}px`,
      borderRadius: '50%',
      backgroundColor: logoUrl ? 'transparent' : (this.appearance?.primaryColor ?? '#33302B'),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      zIndex: `${this.zIndex}`,
      boxShadow: logoUrl ? 'none' : '0 4px 12px rgba(0, 0, 0, 0.15)',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      userSelect: 'none',
      overflow: 'hidden',
    });

    if (logoUrl) {
      const logo = document.createElement('img');
      logo.src = logoUrl;
      logo.alt = '';
      Object.assign(logo.style, {
        width: `${BUTTON_SIZE}px`,
        height: `${BUTTON_SIZE}px`,
        objectFit: 'cover',
        borderRadius: '50%',
        pointerEvents: 'none',
      });
      btn.appendChild(logo);
      this.buttonLogo = logo;
    } else {
      const iconWrapper = document.createElement('span');
      Object.assign(iconWrapper.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      });
      iconWrapper.innerHTML = CHAT_ICON_SVG;
      btn.appendChild(iconWrapper);
      this.buttonLogo = null;
    }

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.08)';
      btn.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    });

    btn.addEventListener('click', () => {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    });

    document.body.appendChild(btn);
    this.button = btn;

    // Show subtitle as welcome tooltip if configured and not previously dismissed
    const subtitle = this.appearance?.subtitle;
    if (subtitle) {
      let dismissed = false;
      try { dismissed = localStorage.getItem(`grabdy_welcome_${this.config.chatId}`) !== null; } catch { /* localStorage may be unavailable */ }
      if (!dismissed) {
        this.createTooltip(subtitle, isLeft);
      }
    }
  }

  private createTooltip(message: string, isLeft: boolean): void {
    const tip = document.createElement('div');

    Object.assign(tip.style, {
      position: 'fixed',
      bottom: `${MARGIN + BUTTON_SIZE / 2}px`,
      transform: 'translateY(50%)',
      [isLeft ? 'left' : 'right']: `${MARGIN + BUTTON_SIZE + 12}px`,
      maxWidth: '240px',
      padding: '10px 14px',
      backgroundColor: '#fff',
      color: '#1a1a1a',
      fontSize: '14px',
      lineHeight: '1.4',
      borderRadius: '10px',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
      zIndex: `${this.zIndex - 1}`,
      opacity: '0',
      transition: 'opacity 0.3s ease',
      cursor: 'pointer',
    });

    tip.textContent = message;

    // Dismiss on click
    tip.addEventListener('click', () => {
      this.dismissTooltip();
    });

    document.body.appendChild(tip);
    this.tooltip = tip;

    // Animate in after a short delay
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.tooltip) {
          this.tooltip.style.opacity = '1';
        }
      });
    });
  }

  private dismissTooltip(): void {
    if (!this.tooltip) return;
    this.tooltip.style.opacity = '0';
    try {
      localStorage.setItem(`grabdy_welcome_${this.config.chatId}`, '1');
    } catch { /* localStorage may be unavailable */ }
    setTimeout(() => {
      if (this.tooltip) {
        this.tooltip.remove();
        this.tooltip = null;
      }
    }, 300);
  }

  private createIframe(): void {
    const iframe = document.createElement('iframe');
    const isInline = !!this.config.container;
    const src = `${this.sdkUrl}/embed?chatId=${encodeURIComponent(this.config.chatId)}${isInline ? '&mode=inline' : ''}`;

    iframe.setAttribute('src', src);
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.setAttribute('title', 'Grabdy Chat');

    const isLeft = this.config.position === 'bottom-left';
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT;

    if (isInline) {
      Object.assign(iframe.style, {
        width: '100%',
        height: '100%',
        border: 'none',
        display: 'block',
      });
    } else {
      const hasBubble = this.config.bubble !== false;
      const bottomOffset = hasBubble ? BUTTON_SIZE + MARGIN + 12 : MARGIN;
      const maxH = hasBubble ? BUTTON_SIZE + MARGIN * 3 : MARGIN * 2;
      const mobileWidth = `calc(100vw - ${MARGIN * 2}px)`;
      const mobileHeight = `calc(100vh - ${maxH}px)`;

      Object.assign(iframe.style, {
        position: 'fixed',
        bottom: `${bottomOffset}px`,
        [isLeft ? 'left' : 'right']: `${MARGIN}px`,
        width: isMobile ? mobileWidth : `${IFRAME_WIDTH}px`,
        height: isMobile ? mobileHeight : `${IFRAME_HEIGHT}px`,
        maxHeight: `calc(100vh - ${maxH}px)`,
        border: 'none',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.16)',
        zIndex: `${this.zIndex}`,
        display: 'none',
        opacity: '0',
        transform: 'translateY(10px)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
        colorScheme: 'normal',
      });
    }

    if (isInline && this.container) {
      this.container.appendChild(iframe);
    } else {
      document.body.appendChild(iframe);
    }

    this.iframe = iframe;
  }

  private showSourceModal(source: import('./types').GrabdyChatSource): void {
    this.closeSourceModal();

    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      zIndex: `${this.zIndex + 1}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: '0',
      transition: 'opacity 0.2s ease',
    });

    const modal = document.createElement('div');
    Object.assign(modal.style, {
      width: '90vw',
      maxWidth: '800px',
      height: '80vh',
      backgroundColor: '#fff',
      borderRadius: '12px',
      boxShadow: '0 16px 48px rgba(0, 0, 0, 0.2)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    });

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: '1px solid #e5e5e5',
      flexShrink: '0',
    });

    const title = document.createElement('div');
    Object.assign(title.style, {
      fontSize: '14px',
      fontWeight: '600',
      color: '#1a1a1a',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    });
    title.textContent = source.dataSourceName;

    const closeBtn = document.createElement('button');
    Object.assign(closeBtn.style, {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '6px',
      color: '#666',
      flexShrink: '0',
    });
    closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" fill="currentColor"><path d="M205.66,50.34a8,8,0,0,0-11.32,0L128,116.69,61.66,50.34A8,8,0,0,0,50.34,61.66L116.69,128,50.34,194.34a8,8,0,0,0,11.32,11.32L128,139.31l66.34,66.35a8,8,0,0,0,11.32-11.32L139.31,128l66.35-66.34A8,8,0,0,0,205.66,50.34Z"/></svg>`;
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.backgroundColor = '#f0f0f0'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.backgroundColor = 'transparent'; });
    closeBtn.addEventListener('click', () => { this.closeSourceModal(); });

    header.appendChild(title);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Body
    const body = document.createElement('div');
    Object.assign(body.style, {
      flex: '1',
      overflow: 'hidden',
    });

    const previewUrl = `${this.sdkUrl}/embed-preview?dataSourceId=${encodeURIComponent(source.dataSourceId)}${source.pages && source.pages.length > 0 ? `&page=${source.pages[0]}` : ''}`;
    const contentIframe = document.createElement('iframe');
    contentIframe.setAttribute('src', previewUrl);
    contentIframe.setAttribute('title', source.dataSourceName);
    Object.assign(contentIframe.style, {
      width: '100%',
      height: '100%',
      border: 'none',
      display: 'block',
    });
    body.appendChild(contentIframe);
    this.previewIframe = contentIframe;

    modal.appendChild(body);
    overlay.appendChild(modal);

    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.closeSourceModal();
      }
    });

    // Close on Escape
    this.sourceModalEscHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.closeSourceModal();
      }
    };
    document.addEventListener('keydown', this.sourceModalEscHandler);

    document.body.appendChild(overlay);
    this.sourceModal = overlay;

    // Animate in
    requestAnimationFrame(() => {
      if (this.sourceModal) {
        this.sourceModal.style.opacity = '1';
      }
    });
  }

  private closeSourceModal(): void {
    if (!this.sourceModal) return;
    if (this.sourceModalEscHandler) {
      document.removeEventListener('keydown', this.sourceModalEscHandler);
      this.sourceModalEscHandler = null;
    }
    this.sourceModal.remove();
    this.sourceModal = null;
    this.previewIframe = null;
  }

  private mountInline(selector: string): void {
    const el = document.querySelector(selector);
    if (!(el instanceof HTMLElement)) {
      throw new Error(`GrabdyChat: container "${selector}" not found`);
    }
    this.container = el;
    this.createIframe();
    this.isOpen = true;
  }
}

// Expose as global for script tag usage
Object.assign(window, { GrabdyChat });
