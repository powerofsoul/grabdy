import JSZip from 'jszip';

const isDev = import.meta.env.DEV;
const SDK_SCRIPT_URL = isDev ? 'http://localhost:3002/sdk.js' : 'https://sdk.grabdy.com/sdk.js';
const SDK_APP_URL = isDev ? 'http://localhost:3000' : 'https://grabdy.com';

interface DemoFiles {
  [path: string]: string;
}

function getDemoFiles(chatId: string): DemoFiles {
  return {
    'package.json': `{
  "name": "grabdy-chat-demo",
  "private": true,
  "scripts": {
    "dev": "concurrently \\"node server.js\\" \\"vite\\"",
    "server": "node server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.0",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "concurrently": "^9.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "vite": "^6.0.0"
  }
}`,

    '.env': `# Paste your private key PEM here (the one you downloaded when generating a signing key)
GRABDY_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
PASTE_YOUR_KEY_HERE
-----END PRIVATE KEY-----"

# Your SDK Chat ID
GRABDY_CHAT_ID="${chatId}"

# Grabdy SDK URLs (change these for local development)
VITE_SDK_SCRIPT_URL=${SDK_SCRIPT_URL}
VITE_SDK_APP_URL=${SDK_APP_URL}

# Port for the Express server
PORT=3001`,

    'server.js': `const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "http://localhost:5173" }));

const privateKey = process.env.GRABDY_PRIVATE_KEY;
const chatId = process.env.GRABDY_CHAT_ID;

if (!privateKey || privateKey.includes("PASTE_YOUR_KEY_HERE")) {
  console.error("\\n  Missing GRABDY_PRIVATE_KEY in .env");
  console.error("  Paste the private key you downloaded from the Grabdy dashboard.\\n");
  process.exit(1);
}

if (!chatId) {
  console.error("\\n  Missing GRABDY_CHAT_ID in .env\\n");
  process.exit(1);
}

// In a real app, this would be behind authentication.
// The "sub" claim should be the authenticated user's ID.
app.get("/api/grabdy/token", (req, res) => {
  const userId = req.query.userId || "demo-user-1";

  const token = jwt.sign(
    {
      sub: String(userId),
      chatId: chatId,
    },
    privateKey,
    { algorithm: "RS256", expiresIn: "1h" }
  );

  res.json({ jwt: token });
});

app.listen(PORT, () => {
  console.log(\`  Token server running at http://localhost:\${PORT}\`);
  console.log(\`  Open http://localhost:5173 to see the demo\\n\`);
});`,

    'vite.config.js': `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});`,

    'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Grabdy Chat Demo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,

    'src/main.jsx': `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,

    'src/App.jsx': `import { useEffect, useRef, useState } from "react";

const CHAT_ID = "${chatId}";
const SDK_SCRIPT_URL = import.meta.env.VITE_SDK_SCRIPT_URL || "https://sdk.grabdy.com/sdk.js";
const SDK_APP_URL = import.meta.env.VITE_SDK_APP_URL || "https://grabdy.com";

// Fetches a signed JWT from your Express backend.
// In production, this endpoint should require authentication
// and use the real user's ID as the "sub" claim.
async function getToken() {
  const res = await fetch("/api/grabdy/token");
  const data = await res.json();
  return data.jwt;
}

// ---- Example 1: Floating bubble (bottom-right) ----
// The default mode. A chat bubble appears in the corner.
// Click it to open/close the chat popup.
function FloatingBubbleExample() {
  const chatRef = useRef(null);

  useEffect(() => {
    if (!window.GrabdyChat) return;

    chatRef.current = new GrabdyChat({
      chatId: CHAT_ID,
      getToken,
      sdkUrl: SDK_APP_URL,
      position: "bottom-right",
      style: {
        primaryColor: "#6366f1",
        title: "Support Chat",
        welcomeMessage: "Hi! How can I help?",
        placeholder: "Type your question...",
      },
    });

    return () => {
      chatRef.current?.destroy();
      chatRef.current = null;
    };
  }, []);

  return null;
}

// ---- Example 2: Inline container ----
// Renders the chat directly inside a DOM element.
// No floating button, the chat is always visible.
function InlineContainerExample() {
  const chatRef = useRef(null);

  useEffect(() => {
    if (!window.GrabdyChat) return;

    chatRef.current = new GrabdyChat({
      chatId: CHAT_ID,
      getToken,
      sdkUrl: SDK_APP_URL,
      container: "#grabdy-inline",
      style: {
        primaryColor: "#059669",
        title: "Knowledge Base",
        placeholder: "Search our docs...",
      },
    });

    return () => {
      chatRef.current?.destroy();
      chatRef.current = null;
    };
  }, []);

  return (
    <div
      id="grabdy-inline"
      style={{
        width: "100%",
        height: 500,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid #e5e7eb",
      }}
    />
  );
}

// ---- Example 3: Open on button click ----
// No bubble is shown. Open the chat programmatically from your own button.
function ClickToOpenExample() {
  const chatRef = useRef(null);

  useEffect(() => {
    if (!window.GrabdyChat) return;

    chatRef.current = new GrabdyChat({
      chatId: CHAT_ID,
      getToken,
      sdkUrl: SDK_APP_URL,
      bubble: false,
      style: {
        primaryColor: "#dc2626",
        title: "Ask AI",
        placeholder: "What do you need help with?",
      },
    });

    return () => {
      chatRef.current?.destroy();
      chatRef.current = null;
    };
  }, []);

  return (
    <button
      onClick={() => chatRef.current?.open()}
      style={{
        padding: "10px 20px",
        fontSize: 14,
        fontWeight: 500,
        border: "none",
        borderRadius: 8,
        backgroundColor: "#dc2626",
        color: "#fff",
        cursor: "pointer",
      }}
    >
      Open Chat
    </button>
  );
}

// ---- Demo page layout ----

export default function App() {
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("bubble");

  // Load the SDK script once
  useEffect(() => {
    const script = document.createElement("script");
    script.src = SDK_SCRIPT_URL;
    script.async = true;
    script.onload = () => setSdkLoaded(true);
    document.head.appendChild(script);
    return () => script.remove();
  }, []);

  const tabs = [
    { id: "bubble", label: "Floating Bubble" },
    { id: "inline", label: "Inline Container" },
    { id: "click", label: "Click to Open" },
  ];

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", backgroundColor: "#fafafa" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Grabdy Chat Demo</h1>
        <p style={{ color: "#666", lineHeight: 1.6, marginBottom: 32 }}>
          Three ways to integrate the chat widget. Pick one below to see it in action.
        </p>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "1px solid #e5e7eb", paddingBottom: 0 }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: activeTab === tab.id ? 600 : 400,
                border: "none",
                borderBottom: activeTab === tab.id ? "2px solid #111" : "2px solid transparent",
                backgroundColor: "transparent",
                color: activeTab === tab.id ? "#111" : "#888",
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {!sdkLoaded && <p style={{ color: "#999" }}>Loading SDK...</p>}

        {sdkLoaded && activeTab === "bubble" && (
          <div>
            <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: 24, border: "1px solid #e5e7eb" }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Floating Bubble</h2>
              <p style={{ color: "#666", lineHeight: 1.6, marginBottom: 16 }}>
                A chat bubble appears in the <strong>bottom-right</strong> corner.
                Click it to open the chat popup. This is the default mode.
              </p>
              <pre style={{ backgroundColor: "#f5f5f5", padding: 16, borderRadius: 8, overflow: "auto", fontSize: 13 }}>{\`new GrabdyChat({
  chatId: "your-chat-id",
  getToken,
  style: {
    primaryColor: "#6366f1",
    title: "Support Chat",
    welcomeMessage: "Hi! How can I help?",
    placeholder: "Type your question...",
    // logoUrl: "https://example.com/logo.svg",
    // bubbleImageUrl: "https://example.com/avatar.png",
  },
});\`}</pre>
            </div>
            <FloatingBubbleExample />
          </div>
        )}

        {sdkLoaded && activeTab === "inline" && (
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 0", minWidth: 0 }}>
              <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: 24, border: "1px solid #e5e7eb", marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Inline Container</h2>
                <p style={{ color: "#666", lineHeight: 1.6, marginBottom: 16 }}>
                  Renders the chat directly inside a DOM element. No floating button.
                  The chat is always visible and fills its container.
                </p>
                <pre style={{ backgroundColor: "#f5f5f5", padding: 16, borderRadius: 8, overflow: "auto", fontSize: 13 }}>{\`new GrabdyChat({
  chatId: "your-chat-id",
  getToken,
  container: "#my-chat",
  style: {
    primaryColor: "#059669",
    title: "Knowledge Base",
    placeholder: "Search our docs...",
  },
});\`}</pre>
              </div>
            </div>
            <div style={{ flex: "1 1 0", minWidth: 0 }}>
              <InlineContainerExample key="inline" />
            </div>
          </div>
        )}

        {sdkLoaded && activeTab === "click" && (
          <div>
            <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: 24, border: "1px solid #e5e7eb" }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Click to Open</h2>
              <p style={{ color: "#666", lineHeight: 1.6, marginBottom: 16 }}>
                No bubble is shown. You control when to open the chat by calling
                <code style={{ backgroundColor: "#f5f5f5", padding: "2px 6px", borderRadius: 4 }}> chat.open()</code> from
                any button, link, or event handler.
              </p>
              <pre style={{ backgroundColor: "#f5f5f5", padding: 16, borderRadius: 8, overflow: "auto", fontSize: 13, marginBottom: 16 }}>{\`const chat = new GrabdyChat({
  chatId: "your-chat-id",
  getToken,
  bubble: false,
  style: {
    primaryColor: "#dc2626",
    title: "Ask AI",
    placeholder: "What do you need help with?",
  },
});

// Open from your own button, link, etc:
chat.open();\`}</pre>
              <ClickToOpenExample key="click" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}`,

    'README.md': `# Grabdy Chat Demo

A minimal Express + React demo showing how to integrate the Grabdy Chat widget.

## Setup

1. Install dependencies:

   \`\`\`
   npm install
   \`\`\`

2. Open \`.env\` and paste your private key (from the Grabdy dashboard > SDK Chats > Signing Keys).

3. Start the dev servers:

   \`\`\`
   npm run dev
   \`\`\`

   This starts both the Express token server (port 3001) and the Vite dev server (port 5173).
   Vite proxies \`/api\` requests to Express automatically.

4. Open http://localhost:5173 and click the chat button.

## How it works

- **server.js** runs an Express server that signs RS256 JWTs with your private key
- **src/App.jsx** loads the Grabdy SDK and initializes the chat widget
- **vite.config.js** proxies \`/api\` to Express so the frontend uses relative URLs
- The SDK calls \`getToken\` to fetch a JWT from your server whenever it needs one

## Environment variables

| Variable | Description |
|---|---|
| \`GRABDY_PRIVATE_KEY\` | Your RS256 private key PEM |
| \`GRABDY_CHAT_ID\` | Your SDK Chat ID |
| \`VITE_SDK_SCRIPT_URL\` | SDK script URL (default: \`https://sdk.grabdy.com/sdk.js\`) |
| \`VITE_SDK_APP_URL\` | Grabdy app URL for the embed iframe (default: \`https://grabdy.com\`) |
| \`PORT\` | Express server port (default: 3001) |

## Production notes

- The token endpoint should require authentication
- Use the authenticated user's ID as the \`sub\` claim in the JWT
- Store your private key securely (environment variable, secrets manager)
- Set a reasonable expiry (1 hour is a good default)
- In production, serve the built React app from Express or a CDN
`,
  };
}

export async function downloadDemoProject(chatId: string): Promise<void> {
  const zip = new JSZip();
  const files = getDemoFiles(chatId);

  for (const [path, content] of Object.entries(files)) {
    zip.file(`grabdy-chat-demo/${path}`, content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'grabdy-chat-demo.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
