FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install build dependencies if needed
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Build Vite frontend assets
RUN npm run build

# Expose REEV WA Gateway Port
EXPOSE 3000

# Volume for persistent Baileys session storage
VOLUME ["/app/sessions"]

# Start full-stack server
CMD ["npm", "run", "start"]
