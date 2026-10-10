FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && mkdir -p /app/sessions && chown -R node:node /app
ENV NODE_ENV=production PORT=3000 DATA_DIR=/app/sessions
USER node
EXPOSE 3000
CMD ["npm", "start"]
