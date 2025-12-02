# AGENTS.md - Development Guide

## Build, Lint & Test Commands

**Run Tests**
```bash
npm test                        # Run all tests
npm run test:unit               # Backend unit tests only
npm run test:integration        # Backend integration tests
npm run test:e2e                # End-to-end tests
npm run test:coverage           # Coverage report

# Single test file (from backend directory):
cd backend && npm test -- providers.integration.test.ts
```

**Build & Lint**
```bash
npm run build                   # Build both backend & frontend
npm run lint                    # Lint & fix all code
make dev                        # Start dev servers (frontend + backend)
```

## Architecture & Structure

**Monorepo**: Root workspaces: `backend/` (NestJS), `frontend/` (React)

**Backend Stack**: NestJS, TypeORM, PostgreSQL, Redis + Bull queues, JWT auth, TypeScript

**Backend Modules**: `src/modules/` (Auth, Users, Integrations, Syncs, Webhooks), `src/providers/` (service provider integrations), `src/sync/` (sync engine), `src/common/` (shared utilities/guards)

**Frontend Stack**: React 18, Vite, Zustand, Tailwind, React Router, TypeScript

**Frontend Structure**: `src/components/` (UI), `src/pages/` (route views), `src/services/` (API client), `src/hooks/` (custom hooks), `src/types/` (TS types)

**Database**: PostgreSQL with TypeORM migrations (`backend/scripts/migrate.js`)

## Code Style & Conventions

**TypeScript**: Strict typing required. Use explicit return types in NestJS services. Avoid `any` (eslint warns). Use `class-validator` for DTOs (backend).

**Backend NestJS**: 
- Controllers in modules (dependency injection); Services for business logic
- Use decorators: `@Injectable()`, `@Controller()`, `@Post()`, `@UseGuards(JwtAuthGuard)`
- Error handling: NestJS exceptions (`BadRequestException`, `UnauthorizedException`)
- DTOs with `class-validator` decorators for validation

**Frontend React**: Functional components + hooks. Zustand for state. Services via axios. Type-safe props using interfaces. CSS via Tailwind classes.

**Imports**: Relative paths preferred in modules. Use aliases if configured (check tsconfig.json).

**Naming**: camelCase for variables/functions, PascalCase for classes/types, UPPER_SNAKE_CASE for constants.

**Git**: Use conventional commits (`feat:`, `fix:`, `test:`, `docs:`). Feature branches off main.
