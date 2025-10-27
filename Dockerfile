# ---- 1. Base build image ----
FROM node:20-alpine AS base
WORKDIR /app

# ---- 2. Dependencies ----
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev || npm install --omit=dev

# ---- 3. Copy source ----
COPY . .

# ---- 4. Prisma client ----
# This is important! It generates the Prisma client inside the image.
RUN npx prisma generate

# ---- 5. Expose and run ----
EXPOSE 80
ENV PORT=80
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
