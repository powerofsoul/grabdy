# grabdy

SaaS that lets businesses upload data (PDF, CSV, DOCX, TXT) and retrieve it contextually via REST API and chatbot.

## Prerequisites

- **Node.js** 20+
- **Yarn** 4.x (via corepack: `corepack enable && corepack prepare yarn@4.6.0 --activate`)
- **PostgreSQL** 15+ with pgvector extension
- **Redis** 7+
- **poppler** (provides `pdftotext` and `pdfinfo` for PDF text extraction)

### Installing poppler

**macOS:**

```bash
brew install poppler
```

**Ubuntu/Debian:**

```bash
sudo apt-get install -y poppler-utils
```

**Docker:** Already included in the API Dockerfile.

## Setup

```bash
yarn install
```

Copy `.env.example` to `.env` in `apps/api` and fill in the values.

## Development

```bash
# API
cd apps/api && yarn dev

# Web
cd apps/web && yarn dev
```

## Type Checking

```bash
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
```
