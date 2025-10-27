
FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev || npm install --omit=dev

COPY . .

# ✅ generate prisma client at build
RUN npx prisma generate

EXPOSE 80
ENV PORT=80

# ✅ run migrations automatically at startup
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]

