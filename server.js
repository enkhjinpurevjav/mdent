FROM node:20-alpine

WORKDIR /app

# Copy manifests first for cache
COPY package*.json ./
RUN npm install --omit=dev

# Copy app
COPY . .

ENV NODE_ENV=production
ENV PORT=80
EXPOSE 80

CMD ["npm","start"]
