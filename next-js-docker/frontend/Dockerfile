FROM node:22-slim AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV PORT=3000 NODE_ENV=production HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
