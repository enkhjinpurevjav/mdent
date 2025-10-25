FROM node:20-alpine

WORKDIR /app

# Copy only manifests first for better layer caching
COPY package*.json ./

# Use npm install (works without package-lock)
RUN npm install --omit=dev

# Copy the rest of the app
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# No HEALTHCHECK in image; we'll use EasyPanel's health check
CMD ["npm","start"]
