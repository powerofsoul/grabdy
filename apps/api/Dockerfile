# Stage 1: Install dependencies and build
FROM node:20-slim AS builder

RUN corepack enable && corepack prepare yarn@4.6.0 --activate && \
    npm install -g turbo

WORKDIR /app

# Copy dependency/config files first for layer caching
COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/common/package.json packages/common/
COPY packages/contracts/package.json packages/contracts/

RUN yarn install --immutable

# Now copy source code (this layer busts only when code changes)
COPY turbo.json ./
COPY apps/api apps/api
COPY packages/common packages/common
COPY packages/contracts packages/contracts

RUN turbo build --filter=@grabdy/api

# Stage 2: Production image
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only what's needed to run
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/apps/api/node_modules apps/api/node_modules
COPY --from=builder /app/packages/common/dist packages/common/dist
COPY --from=builder /app/packages/common/package.json packages/common/
COPY --from=builder /app/packages/contracts/dist packages/contracts/dist
COPY --from=builder /app/packages/contracts/package.json packages/contracts/
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/api/package.json apps/api/

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "--max-old-space-size=3584", "apps/api/dist/main.js"]
