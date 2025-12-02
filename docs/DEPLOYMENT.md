# 0Sync Deployment Guide

## Table of Contents

1. [Docker](#docker)
2. [Google Cloud Run](#google-cloud-run)
3. [AWS ECS](#aws-ecs)
4. [Kubernetes](#kubernetes)
5. [Environment Configuration](#environment-configuration)
6. [Database](#database)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)

## Docker

### Build Images

```bash
# Build both backend and frontend
docker-compose build

# Or build individually
docker build -t 0sync-backend:latest ./backend
docker build -t 0sync-frontend:latest ./frontend
```

### Run Locally

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Push to Registry

```bash
# Tag images
docker tag 0sync-backend:latest YOUR_REGISTRY/0sync-backend:latest
docker tag 0sync-frontend:latest YOUR_REGISTRY/0sync-frontend:latest

# Push to registry
docker push YOUR_REGISTRY/0sync-backend:latest
docker push YOUR_REGISTRY/0sync-frontend:latest
```

## Google Cloud Run

### Prerequisites

```bash
# Install gcloud CLI
# https://cloud.google.com/sdk/docs/install

gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### Deploy Backend

```bash
cd backend

# Build and deploy
gcloud run deploy 0sync-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL=postgresql://... \
  --set-env-vars REDIS_URL=redis://... \
  --set-env-vars JWT_SECRET=... \
  --memory 1Gi \
  --cpu 1 \
  --timeout 3600
```

### Deploy Frontend

```bash
cd frontend

# Build and deploy (static site)
gcloud run deploy 0sync-frontend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars VITE_API_URL=https://0sync-backend-xxx.run.app \
  --memory 512Mi
```

## AWS ECS

### Prerequisites

```bash
# Install AWS CLI
# https://aws.amazon.com/cli/

aws configure
```

### Create ECS Cluster

```bash
# Create cluster
aws ecs create-cluster --cluster-name 0sync-prod

# Create task definition (backend)
aws ecs register-task-definition \
  --cli-input-json file://task-definition-backend.json

# Create service
aws ecs create-service \
  --cluster 0sync-prod \
  --service-name 0sync-backend \
  --task-definition 0sync-backend:1 \
  --desired-count 2 \
  --load-balancers targetGroupArn=arn:aws:...,containerName=0sync-backend,containerPort=3000 \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx]}"
```

### task-definition-backend.json

```json
{
  "family": "0sync-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [
    {
      "name": "0sync-backend",
      "image": "YOUR_ACCOUNT.dkr.ecr.us-east-1.amazonaws.com/0sync-backend:latest",
      "portMappings": [
        { "containerPort": 3000, "hostPort": 3000 }
      ],
      "environment": [
        { "name": "NODE_ENV", "value": "production" },
        { "name": "DATABASE_URL", "value": "postgresql://..." },
        { "name": "REDIS_URL", "value": "redis://..." }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/0sync-backend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

## Kubernetes

### Prerequisites

```bash
# Install kubectl
# https://kubernetes.io/docs/tasks/tools/

# Configure cluster access
kubectl config use-context YOUR_CONTEXT
```

### Create Namespace

```bash
kubectl create namespace 0sync
```

### Deploy ConfigMap & Secrets

```bash
# Create ConfigMap
kubectl create configmap 0sync-config \
  --from-literal=NODE_ENV=production \
  --from-literal=LOG_LEVEL=info \
  -n 0sync

# Create Secrets
kubectl create secret generic 0sync-secrets \
  --from-literal=DATABASE_URL=postgresql://... \
  --from-literal=REDIS_URL=redis://... \
  --from-literal=JWT_SECRET=... \
  --from-literal=ENCRYPTION_KEY=... \
  -n 0sync
```

### Deploy Backend

```bash
# Apply backend deployment
kubectl apply -f k8s/backend-deployment.yaml -n 0sync

# Check status
kubectl get pods -n 0sync
kubectl logs -f deployment/0sync-backend -n 0sync
```

### backend-deployment.yaml

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: 0sync-backend
  namespace: 0sync
spec:
  replicas: 3
  selector:
    matchLabels:
      app: 0sync-backend
  template:
    metadata:
      labels:
        app: 0sync-backend
    spec:
      containers:
      - name: backend
        image: YOUR_REGISTRY/0sync-backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: 0sync-config
              key: NODE_ENV
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: 0sync-secrets
              key: DATABASE_URL
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: 0sync-secrets
              key: REDIS_URL
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: 0sync-backend-service
  namespace: 0sync
spec:
  selector:
    app: 0sync-backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

## Environment Configuration

### Production Secrets

Create `.env.production`:

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Redis
REDIS_URL=redis://host:6379

# JWT & Encryption
JWT_SECRET=<generate-with: openssl rand -hex 32>
ENCRYPTION_KEY=<generate-with: openssl rand -hex 16>

# OAuth
NOTION_OAUTH_CLIENT_ID=
NOTION_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
# ... other OAuth credentials

# App
NODE_ENV=production
API_PORT=3000
API_URL=https://api.0sync.com
FRONTEND_URL=https://app.0sync.com
LOG_LEVEL=warn
```

### Generate Secrets

```bash
# Generate JWT secret
openssl rand -hex 32

# Generate encryption key
openssl rand -hex 16

# Generate secure password
openssl rand -base64 32
```

## Database

### PostgreSQL Setup

```bash
# Create database
createdb sync_db -h localhost -U postgres

# Run migrations
cd backend
DATABASE_URL=postgresql://... npm run db:migrate

# Verify migrations
psql sync_db -h localhost -U postgres -c "\dt"
```

### Redis Setup

```bash
# Start Redis
redis-server

# Verify connection
redis-cli ping
# Should return: PONG
```

### Backups

```bash
# PostgreSQL backup
pg_dump sync_db > backup-$(date +%Y%m%d).sql

# Restore backup
psql sync_db < backup-20240101.sql

# S3 backup (if using AWS)
aws s3 cp backup-$(date +%Y%m%d).sql s3://your-bucket/backups/
```

## Monitoring

### Logs

```bash
# Docker
docker-compose logs -f backend
docker-compose logs -f frontend

# Kubernetes
kubectl logs -f deployment/0sync-backend -n 0sync

# Google Cloud Run
gcloud run services describe 0sync-backend --region us-central1
```

### Health Checks

```bash
# Check backend health
curl http://localhost:3000/health

# Check frontend
curl http://localhost:5173/index.html
```

### Metrics

Prometheus setup (optional):

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: '0sync-backend'
    static_configs:
      - targets: ['localhost:3000']
```

### Alerts

Common alerts to set up:
- High error rate (>5%)
- Database connection failures
- Redis connection failures
- High memory usage (>80%)
- High CPU usage (>80%)
- Sync job failures

## Troubleshooting

### Database Connection Error

```bash
# Verify credentials
psql postgresql://user:pass@host:5432/db

# Check environment variable
echo $DATABASE_URL

# Restart service
docker-compose restart postgres
```

### Redis Connection Error

```bash
# Check Redis is running
redis-cli ping

# Verify Redis URL
echo $REDIS_URL

# Restart Redis
docker-compose restart redis
```

### Memory Leak

```bash
# Check memory usage
docker stats

# Restart pod
kubectl delete pod <pod-name> -n 0sync
```

### Sync Failures

```bash
# Check logs
kubectl logs -f deployment/0sync-backend -n 0sync | grep error

# Manual retry
curl -X POST http://localhost:3000/syncs/{id}/run
```

## Scaling

### Horizontal Scaling

```bash
# Kubernetes
kubectl scale deployment 0sync-backend --replicas=5 -n 0sync

# ECS
aws ecs update-service --cluster 0sync-prod --service 0sync-backend --desired-count 5

# Cloud Run
gcloud run services update 0sync-backend --region us-central1 --concurrency 100
```

### Performance Tuning

1. **Database**: Add indexes for frequently queried fields
2. **Cache**: Increase Redis memory, implement caching strategies
3. **API**: Enable compression, implement rate limiting
4. **Frontend**: Lazy load components, optimize bundle size

## SSL/TLS

### Let's Encrypt (Nginx)

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate certificate
sudo certbot certonly --nginx -d api.0sync.com

# Auto-renew
sudo certbot renew --dry-run
```

### Cloud Provider Managed

- **Google Cloud Run**: Automatic HTTPS
- **AWS**: Use ACM (AWS Certificate Manager)
- **Kubernetes**: Use cert-manager

## Success Criteria

After deployment, verify:

- [ ] Frontend accessible and responsive
- [ ] API responding to requests
- [ ] Database connected and migrations applied
- [ ] Redis cache working
- [ ] OAuth flows complete successfully
- [ ] Syncs running on schedule
- [ ] Logs being captured
- [ ] Monitoring/alerts active
- [ ] Backups configured
- [ ] SSL/TLS enabled

## Support

For deployment issues:
1. Check logs first
2. Verify environment variables
3. Test database/Redis connectivity
4. Review this guide for similar scenarios
5. Open GitHub issue with logs
