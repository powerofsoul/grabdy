# @grabdy/sdk

Embeddable chat widget that customers add to their sites. Renders as a floating bubble or inline container, authenticates via RS256 JWTs, and communicates with the Grabdy API through iframes and postMessage.

## Build

```bash
yarn build      # Produces dist/sdk.js and dist/sdk.min.js
yarn dev         # Watches + serves at http://localhost:3002
```

Built with esbuild as IIFE (no module system). The build injects `__SDK_URL__` (defaults to `https://grabdy.com` in production, `http://localhost:3000` in dev) and `__API_URL__` (defaults to `https://api.grabdy.com` in production, `http://localhost:4000` in dev). The SDK uses `__API_URL__` for direct API calls (e.g., fetching appearance config) to avoid CORS issues when embedded on customer domains.

## How it works

### Initialization

`new GrabdyChat(config)` is a singleton exposed as `window.GrabdyChat`. It:

1. Validates required config (`chatId`, `getToken`)
2. Registers a global `message` event listener for postMessage communication
3. Either mounts inline (`config.container`) or creates a floating bubble button

### Widget modes

- **Floating bubble** (default): Fixed-position button in bottom-right/left corner. Click to open/close a chat iframe popup. Optional welcome tooltip.
- **Inline**: Fills a DOM container element. No bubble button, always open.
- **Headless** (`bubble: false`): No UI created automatically. Call `chat.open()` programmatically.

### Chat iframe

The chat iframe loads `/embed` on the Grabdy web app:

```
{sdkUrl}/embed?chatId={chatId}&mode=inline
```

This renders `EmbedChatPage` (`apps/web/src/components/embed-chat/`).

### Authentication flow (postMessage)

The SDK and embed pages communicate via `postMessage`, scoped to `sdkOrigin`:

```
Customer page                SDK (index.ts)              Embed iframe (/embed)
     |                            |                            |
     |  new GrabdyChat(config)    |                            |
     |--------------------------->|                            |
     |                            |  creates iframe            |
     |                            |--------------------------->|
     |                            |                            |
     |                            |  READY                     |
     |                            |<---------------------------|
     |                            |                            |
     |  config.getToken()         |                            |
     |<---------------------------|                            |
     |  returns JWT               |                            |
     |--------------------------->|                            |
     |                            |  JWT + chatId + style      |
     |                            |--------------------------->|
     |                            |                            |
     |                            |  TOKEN_REFRESH (on 401)    |
     |                            |<---------------------------|
     |                            |  (repeats getToken flow)   |
```

Messages from embed to SDK parent:

- `READY` - iframe loaded, requesting JWT
- `TOKEN_REFRESH` - JWT expired, requesting new one
- `RESIZE` - content height changed (for auto-sizing)
- `CLOSE` - user clicked close button inside embed
- `OPEN_SOURCE` - user clicked a source citation, includes `{ dataSourceId, dataSourceName, pages }`

Messages from SDK to embed:

- `JWT` - contains `{ jwt, chatId, style }`
- `UPDATE_JWT` - refreshed token only

### Source preview flow

When the AI response cites a source and the user clicks it:

```
Embed iframe                SDK (index.ts)           Preview iframe (/embed-preview)
     |                            |                            |
     |  OPEN_SOURCE { source }    |                            |
     |--------------------------->|                            |
     |                            |  opens modal + iframe      |
     |                            |--------------------------->|
     |                            |                            |
     |                            |  READY                     |
     |                            |<---------------------------|
     |                            |                            |
     |                            |  JWT (to preview iframe)   |
     |                            |--------------------------->|
     |                            |                            |
     |                            |     GET /sdk/data-sources/:id/preview-url
     |                            |     (Bearer JWT)
     |                            |                    ------> API
     |                            |                    <------ { url (presigned S3), mimeType, title }
     |                            |                            |
     |                            |     renders DocumentPreview|
```

The SDK routes `READY` and `TOKEN_REFRESH` to the correct iframe by checking `e.source` against `this.iframe.contentWindow` (chat) vs `this.previewIframe.contentWindow` (preview).

The preview modal is a plain DOM overlay with header (title + close button) and an iframe body. Dismissible via close button, backdrop click, or Escape key.

### JWT structure

Customer backends sign RS256 JWTs with their private key (generated in the dashboard):

```json
{
  "sub": "user-123",
  "chatId": "sdk-chat-uuid",
  "exp": 1234567890
}
```

The API verifies against stored public keys (`sdk.sdk_signing_keys` table). There's also an HS256 "preview token" variant (signed with app secret, has `preview: true` claim) used for dashboard previews.

## Config reference

```typescript
interface GrabdyChatConfig {
  // Required
  chatId: string; // SDK Chat ID from dashboard
  getToken: () => Promise<string>; // Returns a signed JWT

  // Optional
  container?: string; // CSS selector for inline mode
  position?: 'bottom-right' | 'bottom-left';
  bubble?: boolean; // Show floating button (default: true)
  zIndex?: number; // Widget z-index (default: 999999)
  sdkUrl?: string; // Override Grabdy URL (for dev)
  apiUrl?: string; // Override API URL (for dev)
  onSourceClick?: (source: GrabdyChatSource) => void; // Custom source handler
  style?: {
    primaryColor?: string; // Bubble background color
    accentColor?: string;
    logoUrl?: string; // Chat header logo
    bubbleImageUrl?: string; // Custom bubble image (replaces icon)
    title?: string; // Chat header title
    placeholder?: string; // Input placeholder
    welcomeMessage?: string; // Tooltip next to bubble
  };
}
```

## Public methods

```typescript
chat.open(); // Open the chat widget
chat.close(); // Close the chat widget
chat.refreshToken(); // Force token refresh
chat.destroy(); // Remove widget, clean up listeners
```

## File structure

```
apps/sdk/
  build.js            # esbuild config (IIFE bundle, dev server on :3002)
  package.json
  src/
    index.ts          # GrabdyChat class (singleton, all DOM/iframe/message logic)
    types.ts          # Config, source, style, and postMessage interfaces
  dist/
    sdk.js            # Development build
    sdk.min.js        # Production build (minified)
```

## Related code

- `apps/web/src/components/embed-chat/` - Chat embed page (`/embed`)
- `apps/web/src/components/embed-preview/` - Preview embed page (`/embed-preview`)
- `apps/web/src/components/chat/components/document-preview/` - Shared document renderer
- `apps/api/src/modules/sdk-chat/` - SDK API endpoints
- `apps/api/src/common/guards/sdk-jwt.guard.ts` - JWT verification guard
- `apps/web/src/routes/dashboard/sdk-chats/` - Dashboard SDK chat management + developer docs
