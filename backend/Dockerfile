FROM node:18-alpine

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy root package files for workspace
COPY package.json package-lock.json ./

# Copy backend package.json
COPY backend/package.json ./backend/

# Install all dependencies (including dev for development)
RUN npm ci

# Copy backend source code and config
COPY backend/src ./backend/src
COPY backend/tsconfig.json ./backend/
COPY backend/.eslintrc.js ./backend/
COPY backend/jest.config.js ./backend/

# Build the application
RUN npm run build -w backend

# Expose port
EXPOSE 3000

# Start the backend application
CMD ["npm", "run", "dev", "-w", "backend"]
