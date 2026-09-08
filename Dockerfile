FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci --prefix backend --omit=dev && npm cache clean --force

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=dependencies --chown=node:node /app/backend ./backend
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/scripts/server.mjs /app/scripts/rate-limit.mjs /app/scripts/migrate.mjs /app/scripts/migration-path.mjs /app/scripts/seed-catalog.mjs ./scripts/
COPY --from=build --chown=node:node /app/migrations/vault ./migrations/vault
COPY --from=build --chown=node:node /app/lib/domain/catalog.ts /app/lib/domain/types.ts ./lib/domain/
USER node
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.mjs && node --experimental-strip-types scripts/seed-catalog.mjs && exec node scripts/server.mjs"]
