FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

# Copy workspace manifests first for layer caching
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/ai/package.json ./packages/ai/
COPY packages/api/package.json ./packages/api/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY packages/ai ./packages/ai
COPY packages/api ./packages/api

EXPOSE 3000

CMD ["pnpm", "--filter", "@scout/api", "exec", "tsx", "src/index.ts"]
