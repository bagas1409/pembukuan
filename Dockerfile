FROM node:18-alpine AS builder

WORKDIR /app

# Install all deps (incl dev) to build native modules + prisma client
COPY package.json package-lock.json ./
RUN apk add --no-cache --virtual .gyp python3 make g++ \
  && npm install \
  && apk del .gyp

COPY prisma ./prisma
RUN npx prisma generate

# Drop dev deps to keep node_modules production-only
RUN npm prune --production

FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=production

# Install production dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN apk add --no-cache --virtual .gyp python3 make g++ \
  && npm install --production --ignore-scripts \
  && apk del .gyp

# Copy the rest of the application
COPY . .

# Use prebuilt, production-only node_modules from builder (includes generated Prisma client + native deps)
COPY --from=builder /app/node_modules ./node_modules

# Run as non-root for better security
RUN chown -R node:node /app
USER node

# App listens on PORT (default 5000 in this project)
EXPOSE 5000

CMD ["node", "server.js"]
