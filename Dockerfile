# ---- runtime image ----
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install only what’s needed to run
COPY package*.json ./
RUN npm ci --only=production

# Copy the rest of the app
COPY . .

# Your app MUST listen on this port (see server.js)
ENV PORT=3000
EXPOSE 3000

# (Optional) Healthcheck to /health
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["npm","start"]
