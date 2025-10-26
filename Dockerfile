FROM node:20-alpine

WORKDIR /app

# Faster, repeatable installs
ENV NODE_ENV=production
COPY package*.json ./
# Prefer npm ci if you have a lockfile; fall back to install
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev || npm install --omit=dev

COPY . .
EXPOSE 80
CMD ["node", "server.js"]
