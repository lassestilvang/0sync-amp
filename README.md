# 0Sync — Bi-directional Synchronization SaaS

A complete SaaS platform that provides two-way synchronization between Notion and 15+ external services.

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose (optional)
- PostgreSQL (or use Docker)
- Redis (or use Docker)

### Development Setup

1. **Clone & Install**
```bash
git clone <repo>
cd 0sync-amp
npm install
```

2. **Environment Configuration**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start Development Servers (Docker)**
```bash
make docker-up
# Frontend: http://localhost:5173
# Backend: http://localhost:3000
```

Or manually:
```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: PostgreSQL & Redis
docker-compose up postgres redis
```

4. **Database Setup**
```bash
cd backend
npm run db:migrate
```

## Project Structure

```
0sync-amp/
├── backend/                 # NestJS API server
│   ├── src/
│   │   ├── modules/         # Auth, Users, Integrations, Syncs, Webhooks
│   │   ├── providers/       # Service provider integrations
│   │   ├── sync/            # Sync engine & workers
│   │   ├── config/          # Configuration
│   │   └── common/          # Shared utilities
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                # React SPA
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── pages/           # Page components
│   │   ├── hooks/           # Custom hooks
│   │   ├── services/        # API service
│   │   └── types/           # TypeScript types
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml       # Development environment
├── .env.example             # Environment template
├── SYSTEM_DESIGN.md         # Architecture & design docs
└── README.md                # This file
```

## Architecture

### Backend Stack
- **Framework**: NestJS
- **Database**: PostgreSQL
- **Cache & Queue**: Redis + Bull
- **Auth**: JWT + Passport
- **Real-time**: Webhooks

### Frontend Stack
- **Framework**: React 18
- **Routing**: React Router
- **State**: Zustand
- **Styling**: Tailwind CSS
- **Build**: Vite

## Development

### Available Commands

```bash
# Backend
cd backend
npm run dev              # Start development server
npm run build           # Build for production
npm test                # Run tests
npm run lint            # Lint code

# Frontend
cd frontend
npm run dev             # Start dev server
npm run build           # Build for production
npm run type-check      # Check types

# Root
make dev                # Start all development servers
make docker-up          # Start with Docker
make docker-down        # Stop Docker containers
make test               # Run all tests
make lint               # Lint all code
```

## API Documentation

### Authentication
```
POST /auth/signup              Register new user
POST /auth/login               Login
```

### Integrations
```
GET    /integrations           List user integrations
GET    /integrations/:provider/authorize   Start OAuth
POST   /integrations/:provider/callback    OAuth callback
DELETE /integrations/:id       Disconnect
```

### Syncs
```
GET    /syncs                  List syncs
POST   /syncs                  Create sync
GET    /syncs/:id              Get details
PUT    /syncs/:id              Update
DELETE /syncs/:id              Delete
POST   /syncs/:id/run          Trigger sync
GET    /syncs/:id/status       Get status
```

### Webhooks
```
POST   /webhooks/:provider/:id Receive webhook
```

## Configuration

Edit `.env` file:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/sync_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRATION=900s
JWT_REFRESH_EXPIRATION=604800s

# OAuth Providers
NOTION_OAUTH_CLIENT_ID=
NOTION_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
# ... more providers

# App
API_PORT=3000
API_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173
```

## Supported Integrations

- **Notion** - Databases, pages, properties
- **Google** - Calendar, Tasks, Contacts, Sheets, Gmail
- **Microsoft** - To-Do, Calendar, Contacts, Mail
- **Apple** - Calendar, Notes, Reminders
- **Project Management** - GitHub, Trello, Asana, Linear, Jira
- **Task Apps** - Todoist, TickTick

## Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests (coming soon)
cd frontend
npm test
```

## Deployment

### Docker Deployment
```bash
docker-compose up -d
```

### Kubernetes (optional)
```bash
kubectl apply -f k8s/
```

### Cloud Platforms
- Google Cloud Run
- AWS ECS/Fargate
- Azure Container Instances
- Heroku

See `SYSTEM_DESIGN.md` for detailed deployment instructions.

## Security

- Tokens encrypted at rest (AES-256)
- HTTPS enforced
- Rate limiting per user/IP
- CORS properly configured
- SQL injection prevention (parameterized queries)
- XSS protection (CSP headers)
- CSRF tokens on state-changing requests
- Webhook signature verification

## Contributing

1. Create feature branch: `git checkout -b feature/name`
2. Make changes and commit: `git commit -m "feat: description"`
3. Push and create PR: `git push origin feature/name`

## Support

For issues, questions, or contributions:
- Open an issue on GitHub
- Check `SYSTEM_DESIGN.md` for architecture details
- Review inline code documentation

## License

MIT

## Roadmap

- [x] Core platform architecture
- [x] Database schema & migrations
- [x] Auth system (JWT + OAuth)
- [x] API structure
- [x] Frontend scaffolding
- [ ] Notion provider (full sync)
- [ ] Wave 1 providers (Todoist, Google services, Microsoft)
- [ ] Wave 2 providers (Apple, GitHub, Trello, Asana, Linear, Jira, TickTick)
- [ ] Advanced sync features (conflict resolution, field mapping)
- [ ] Testing & reliability
- [ ] Monitoring & alerting
- [ ] Production deployment

