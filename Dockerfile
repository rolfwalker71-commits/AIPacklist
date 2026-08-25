# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
# postinstall runs prisma generate — schema is not present in this stage yet
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:../data/flexipack.db"
RUN --mount=type=cache,target=/root/.npm \
    mkdir -p data \
  && npm run build \
  && mkdir -p /opt/prisma-cli \
  && cd /opt/prisma-cli \
  && echo '{"private":true}' > package.json \
  && npm install --omit=dev prisma@$(node -p "require('/app/node_modules/prisma/package.json').version")

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3330
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL="file:/app/data/flexipack.db"

RUN apk add --no-cache libc6-compat openssl \
  && addgroup -S nodejs \
  && adduser -S nextjs -G nodejs \
  && mkdir -p /app/data \
  && chown -R nextjs:nodejs /app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Prisma Client after standalone so engines are not overwritten by .next/standalone/node_modules
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# Self-contained Prisma CLI (effect, c12, …) for migrate deploy
COPY --from=builder /opt/prisma-cli /opt/prisma-cli
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh \
  && chown -R nextjs:nodejs /app /opt/prisma-cli

USER nextjs
EXPOSE 3330
VOLUME ["/app/data"]
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
