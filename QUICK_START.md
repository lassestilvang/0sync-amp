# 0Sync Quick Start Guide

## Prerequisites

- **Node.js** 18 or higher
- **Docker** and **Docker Compose** (optional, but recommended)
- **Git**

## Option 1: Docker (Recommended)

```bash
# Clone repository
git clone <repo-url>
cd 0sync-amp

# Configure environment
cp .env.example .env
# Edit .env with your OAuth credentials

# Start all services
docker-compose up

# Access application
# Frontend: http://localhost:5173
# API: http://localhost:3000
# Database: PostgreSQL on :5432
# Cache: Redis on :6379
```

## Option 2: Local Development

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure database
# Update DATABASE_URL in ../.env
# or use Docker: docker-compose up postgres redis

# Run development server
npm run dev
# Server runs on http://localhost:3000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure API URL
# Update VITE_API_URL in .env or use default http://localhost:3000

# Run development server
npm run dev
# App runs on http://localhost:5173
```

## Configuration

Create `.env` file from `.env.example`:

```bash
cp .env.example .env
```

Key environment variables:

```env
# Database
DATABASE_URL=postgresql://sync_user:sync_password@localhost:5432/sync_db

# OAuth - Register apps at:
# Notion: https://www.notion.so/my-integrations
# Google: https://console.cloud.google.com/
# Microsoft: https://portal.azure.com/
# Todoist: https://todoist.com/app/settings/integrations/developer

NOTION_OAUTH_CLIENT_ID=your_id
NOTION_OAUTH_CLIENT_SECRET=your_secret
GOOGLE_OAUTH_CLIENT_ID=your_id
GOOGLE_OAUTH_CLIENT_SECRET=your_secret
MICROSOFT_OAUTH_CLIENT_ID=your_id
MICROSOFT_OAUTH_CLIENT_SECRET=your_secret
TODOIST_OAUTH_CLIENT_ID=your_id
TODOIST_OAUTH_CLIENT_SECRET=your_secret

# Security
ENCRYPTION_KEY=32_character_encryption_key
JWT_SECRET=your_jwt_secret
```

## First Time Setup

1. **Create an account**
   - Go to http://localhost:5173
   - Click "Sign up"
   - Enter email, password, name

2. **Connect integrations**
   - Click "Integrations" in sidebar
   - Click "Connect" on desired service
   - Authorize the app
   - Successfully connected integration appears in list

3. **Create your first sync**
   - Click "Dashboard"
   - Click "New Sync"
   - Select source integration
   - Select destination integration
   - Configure field mapping
   - Choose sync direction (bidirectional or one-way)
   - Save sync

4. **Monitor sync**
   - Sync runs automatically every 5 minutes
   - Click sync to see logs and status
   - Click "Run" button to trigger immediate sync

## Useful Commands

```bash
# Root level commands
make dev              # Start all dev servers
make docker-up        # Start with Docker
make docker-down      # Stop Docker
make build            # Build for production
make test             # Run tests
make lint             # Lint all code

# Backend
cd backend
npm run dev           # Development mode with hot reload
npm run build         # Build TypeScript
npm test              # Run unit tests

# Frontend
cd frontend
npm run dev           # Development server
npm run build         # Build for production
npm run preview       # Preview production build
```

## Database Migrations

Migrations run automatically on startup. To manually run:

```bash
cd backend
npm run db:migrate
npm run db:seed       # Optional: seed test data
```

## Architecture

### Backend
- **Framework**: NestJS
- **Database**: PostgreSQL with TypeORM
- **Queues**: Redis + Bull for background jobs
- **Auth**: JWT + OAuth 2.0
- **API**: RESTful endpoints

### Frontend
- **Framework**: React 18
- **State**: Zustand
- **Styling**: Tailwind CSS
- **Build**: Vite

### Integrations
- **Notion** - Databases, pages, properties
- **Todoist** - Tasks, projects
- **Google** - Calendar, Tasks
- **Microsoft** - To-Do, Calendar
- _More coming soon_

## Troubleshooting

### Database connection error
```bash
# Check PostgreSQL is running
docker-compose ps

# Restart services
docker-compose down
docker-compose up
```

### Port already in use
```bash
# Backend (3000)
lsof -i :3000
kill -9 <PID>

# Frontend (5173)
lsof -i :5173
kill -9 <PID>
```

### OAuth fails
1. Verify OAuth credentials in `.env`
2. Check redirect URI matches OAuth app settings
3. Ensure correct scopes requested
4. Check browser console for detailed errors

### Sync not running
1. Check sync status on Dashboard
2. Verify integrations are connected
3. Check logs in Docker: `docker-compose logs backend`
4. Trigger manual sync via "Run" button

## Development Tips

- **Hot reload**: Changes to source files auto-reload in dev mode
- **Database**: Use Adminer on `http://localhost:8080` (add to docker-compose)
- **Logs**: Check `docker-compose logs -f <service-name>`
- **Testing**: Run `npm test` in backend or frontend directories
- **API docs**: Swagger UI at `/api/docs` (coming soon)

## Production Deployment

See `SYSTEM_DESIGN.md` for detailed deployment instructions for:
- Google Cloud Run
- AWS ECS
- Azure Container Instances
- Heroku
- Kubernetes

## Support

- Check `SYSTEM_DESIGN.md` for architecture details
- Read inline code documentation
- Search existing GitHub issues
- Create new issue if problem persists

## Next Steps

1. Explore the Dashboard
2. Connect your first service
3. Set up a sync between Notion and Todoist
4. Check sync logs and status
5. Try advanced features (field mapping, conflict resolution)

Happy syncing!
