# Integration Providers — Connector Conventions

## Structure

Each provider follows this layout:

```
<provider>/
├── <provider>.connector.ts    ← Auth, signature verification, routing
├── <provider>.types.ts        ← ProviderData interface + Zod schemas
├── <provider>.utils.ts        ← Shared helpers, types, Zod schemas for payloads
└── webhooks/
    └── <type>.webhook.ts      ← One @Injectable() per webhook event type
```

## Webhook Services

Each `@Injectable()` webhook service handles the full pipeline for one event type:

| Method | Description |
|--------|-------------|
| `extractEvent()` | Parse webhook payload → `WebhookEvent` |
| `fetchItem()` | Fetch a single item by ID → `SyncedItem` |
| `fetchUpdatedItems()` | Batch fetch for sync → `SyncedItem[]` |

Private helpers (comment fetching, item building, etc.) stay inside the service.

### Naming

- File: `<type>.webhook.ts` (e.g., `issue.webhook.ts`, `pr.webhook.ts`, `channel.webhook.ts`)
- Class: `<Provider><Type>Webhook` (e.g., `GitHubIssueWebhook`, `SlackChannelWebhook`)

## Connector Responsibilities

The connector (`<provider>.connector.ts`) keeps:

- **Auth**: OAuth flow, token exchange/refresh, account info
- **Signature verification**: HMAC verification (private method)
- **Routing**: `extractWebhookEvent()` routes to the right webhook service
- **Delegation**: `sync()`, `processWebhookItem()` delegate to webhook services
- **Provider-specific non-webhook logic**: resource listing, channel joining, etc.

## Shared Helpers

Put reusable functions, types, and Zod schemas in `<provider>.utils.ts`:

- Date formatting functions
- Context header builders
- `SyncedItem` builder helpers
- Webhook payload Zod schemas (trust boundary parsing)
- Shared type aliases and interfaces

## Module Registration

All webhook services must be registered as providers in `integrations.module.ts`.
