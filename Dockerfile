FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY backend/package.json ./backend/package.json
RUN npm install --prefix backend --omit=dev
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/backend ./backend
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=build --chown=node:node /app/migrations ./migrations
COPY --from=build --chown=node:node /app/lib/domain ./lib/domain
USER node
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.mjs && node --experimental-strip-types scripts/seed-catalog.mjs && exec node scripts/server.mjs"]
