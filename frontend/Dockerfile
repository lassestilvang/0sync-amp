FROM node:18-alpine AS builder

WORKDIR /app

# Copy root package files for workspace
COPY package.json package-lock.json ./

# Copy frontend package.json
COPY frontend/package.json ./frontend/

# Install dependencies
RUN npm ci -w frontend

# Copy source code and config
COPY frontend/src ./frontend/src
COPY frontend/vite.config.ts ./frontend/
COPY frontend/vite-env.d.ts ./frontend/
COPY frontend/tsconfig.json ./frontend/
COPY frontend/tsconfig.node.json ./frontend/
COPY frontend/tailwind.config.js ./frontend/
COPY frontend/postcss.config.js ./frontend/
COPY frontend/index.html ./frontend/

# Build the application
RUN npm run build -w frontend

# Production stage
FROM nginx:alpine

# Copy nginx config
COPY frontend/nginx.conf /etc/nginx/nginx.conf

# Copy built files
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
