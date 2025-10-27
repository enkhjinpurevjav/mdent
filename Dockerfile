FROM node:20-alpine
WORKDIR /app

# install curl for healthcheck
RUN apk add --no-cache curl

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev || npm install --omit=dev
COPY . .

# generate prisma client at build
RUN npx prisma generate

EXPOSE 80
ENV PORT=80 NODE_ENV=production

# Healthcheck: only passes when app is READY (DB connected)
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=5 \
  CMD curl -fsS http://127.0.0.1/ready || exit 1

# Start: migrate (or push) then run server (PID1)
CMD ["sh", "-lc", "\
  set -e; \
  echo '[entrypoint] running prisma migrate deploy...'; \
  npx prisma migrate deploy || (echo '[entrypoint] migrate failed, trying db push...' && npx prisma db push); \
  echo '[entrypoint] starting node server...'; \
  exec node server.js \
"]
