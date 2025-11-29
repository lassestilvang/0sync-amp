# 0Sync — Complete SaaS Architecture & Implementation Plan

**A 2-way synchronization platform: Notion ↔ 15+ services**

**Status**: System Design Phase  
**Last Updated**: 2025-01-30  
**Tech Stack**: TypeScript, Node.js, React, PostgreSQL, Redis, Docker

---

## 📋 Implementation Checklist

### Phase 1: Core Platform Architecture
- [x] Create database schema and migrations
- [x] Design API specification (OpenAPI/Swagger)
- [x] Build authentication & OAuth flow system
- [x] Implement core sync state management
- [x] Create unified provider SDK interface
- [x] Set up backend project structure (NestJS)
- [x] Set up frontend project structure (React + Vite)
- [x] Configure Redis and Bull job queue

### Phase 2: Foundation & Infrastructure
- [x] Build webhook ingest server
- [x] Implement polling engine (framework ready)
- [x] Create error handling & retry logic
- [x] Build logging & observability system
- [x] Set up rate limiting & quota management (framework ready)
- [x] Implement token encryption & secure storage
- [x] Create background job workers (Bull setup)

### Phase 3: Notion Provider
- [x] Implement Notion OAuth flow
- [x] Build Notion API client
- [x] Sync databases, properties, records
- [x] Handle Notion webhooks (framework ready)
- [x] Implement conflict resolution (framework ready)
- [x] Test bidirectional sync (framework ready)

### Phase 4: Core Providers (Wave 1)
- [x] Todoist (OAuth + API)
- [x] Google Calendar (OAuth + API)
- [x] Google Tasks (OAuth + API)
- [x] Microsoft To-Do (OAuth + API)

### Phase 5: Extended Providers (Wave 2)
- [ ] Google Contacts, Google Sheets, Gmail
- [ ] Outlook Calendar, Outlook Contacts, Outlook Mail
- [ ] Apple Calendar, Apple Notes, Apple Reminders
- [ ] GitHub, Trello, Asana
- [ ] Linear, Jira, TickTick

### Phase 6: Frontend & UX
- [x] Dashboard page
- [x] Integration onboarding flow
- [x] Sync configuration UI
- [ ] Logs & history viewer (basic)
- [ ] Conflict resolver UI
- [x] Settings & billing page (placeholder)

### Phase 7: Testing & Reliability
- [x] Unit tests for core sync logic (started)
- [ ] Integration tests for providers (framework ready)
- [ ] End-to-end sync tests
- [ ] Load & stress testing
- [ ] Security audit

### Phase 8: Deployment & Operations
- [x] Docker & docker-compose setup
- [ ] Kubernetes manifests (template in SYSTEM_DESIGN.md)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Monitoring & alerting (framework ready)
- [x] Documentation & runbooks

---

## 🏗 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│        Dashboard | Onboarding | Config | Logs | Billing     │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
┌──────────────────────┴──────────────────────────────────────┐
│                  API Gateway / Auth                          │
│              (Express/NestJS + JWT middleware)               │
└──────────────────┬───────────────────────┬──────────────────┘
                   │                       │
      ┌────────────┴────────────┐    ┌────┴────────────┐
      │                         │    │                 │
┌─────┴──────┐         ┌────────┴──┐ │  ┌────────────┐ │
│   REST API │         │ Webhooks  │ │  │   OAuth    │ │
│  /sync     │         │  Ingest   │ │  │  Handlers  │ │
│  /integs   │         │ /webhooks │ │  │            │ │
└────────────┘         └───────────┘ │  └────────────┘ │
                                      │                  │
                                      └──────────────────┘
                                              │
                ┌─────────────────────────────┼─────────────────────────────┐
                │                             │                             │
        ┌───────┴────────┐          ┌─────────┴──────┐          ┌──────────┴─────┐
        │  PostgreSQL    │          │    Redis       │          │   S3 / Storage │
        │                │          │                │          │                │
        │ • Users        │          │ • Session      │          │ • File uploads │
        │ • Integrations │          │ • Rate limits  │          │ • Backups      │
        │ • Sync state   │          │ • Job queue    │          │                │
        │ • Mappings     │          │ • Webhooks     │          └────────────────┘
        │ • Logs         │          │                │
        └────────────────┘          └────────────────┘
                │                           │
                └─────────────┬─────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │       Background Job Workers (Bull)       │
        │                                           │
        │ • Polling scheduler                       │
        │ • Sync processors (per provider)          │
        │ • Conflict resolver                       │
        │ • Token refresh                           │
        │ • Cleanup & maintenance                   │
        └───────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │      Provider Integration Layer           │
        │                                           │
        │ ┌──────────────────────────────────────┐  │
        │ │  Unified Provider SDK                │  │
        │ │  • OAuth flows                       │  │
        │ │  • Data transformation               │  │
        │ │  • Batching & retries                │  │
        │ │  • Rate limiting                     │  │
        │ └──────────────────────────────────────┘  │
        │                                           │
        │ ┌─ Notion ─┬─ Todoist ─┬─ Google ──┬────┐ │
        │ │           │            │           │    │ │
        │ │           ▼            ▼           ▼    │ │
        │ │ [API Clients per provider]       ...   │ │
        │ └──────────────────────────────────────────┘ │
        └───────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │    External Provider APIs (REST/GraphQL)  │
        │                                           │
        │ Notion | Todoist | Google | Microsoft    │
        │ Apple | GitHub | Trello | Asana | ...    │
        └───────────────────────────────────────────┘
```

---

## 🗄 Database Schema

### Core Tables

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  full_name VARCHAR(255),
  avatar_url TEXT,
  auth_method VARCHAR(50) NOT NULL, -- 'password' | 'oauth'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Integrations (user's connected services)
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'notion', 'todoist', 'google_calendar', etc.
  name VARCHAR(255), -- User-friendly name
  oauth_access_token TEXT, -- Encrypted
  oauth_refresh_token TEXT, -- Encrypted
  oauth_expires_at TIMESTAMPTZ,
  additional_config JSONB, -- Provider-specific config
  status VARCHAR(50) DEFAULT 'active', -- 'active' | 'paused' | 'error'
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(user_id, provider) -- Only one integration per provider per user
);

-- Syncs (configured sync pairs)
CREATE TABLE syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  source_integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL, -- e.g., 'notion_database'
  source_config JSONB, -- e.g., { database_id: '...', property_map: {...} }
  destination_integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  destination_type VARCHAR(50) NOT NULL, -- e.g., 'todoist_project'
  destination_config JSONB,
  direction VARCHAR(20) NOT NULL DEFAULT 'bidirectional', -- 'one_way' | 'bidirectional'
  status VARCHAR(50) DEFAULT 'active', -- 'active' | 'paused' | 'error'
  conflict_resolution VARCHAR(50) DEFAULT 'last_write_wins', -- 'last_write_wins' | 'manual'
  field_mapping JSONB NOT NULL, -- { source_field: { dest_field: '...', transform: '...' } }
  filter_config JSONB, -- Optional filtering rules
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Sync State (checkpoints, cursors, last sync)
CREATE TABLE sync_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_id UUID NOT NULL REFERENCES syncs(id) ON DELETE CASCADE,
  last_sync_at TIMESTAMPTZ,
  source_cursor VARCHAR(512), -- Notion sync_token, Google syncToken, etc.
  destination_cursor VARCHAR(512),
  last_conflict_at TIMESTAMPTZ,
  conflict_count INTEGER DEFAULT 0,
  backoff_until TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  metadata JSONB, -- Provider-specific state
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Object Mappings (bi-directional mapping between source and dest)
CREATE TABLE object_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_id UUID NOT NULL REFERENCES syncs(id) ON DELETE CASCADE,
  source_object_id VARCHAR(512) NOT NULL,
  source_provider VARCHAR(50) NOT NULL,
  destination_object_id VARCHAR(512) NOT NULL,
  destination_provider VARCHAR(50) NOT NULL,
  source_checksum VARCHAR(64), -- SHA256 of source data
  destination_checksum VARCHAR(64),
  synced_at TIMESTAMPTZ,
  conflict_flag BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sync_id, source_object_id, destination_object_id)
);

-- Webhooks (incoming webhooks)
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  webhook_url TEXT UNIQUE NOT NULL,
  webhook_secret VARCHAR(255), -- For HMAC signature verification
  events VARCHAR(50)[] DEFAULT ARRAY[]::VARCHAR[], -- Subscribed events
  status VARCHAR(50) DEFAULT 'active',
  last_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook Events (queue of received events for processing)
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sync_id UUID REFERENCES syncs(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL, -- 'sync_started', 'sync_completed', 'conflict_resolved', etc.
  resource_type VARCHAR(50), -- 'sync', 'integration', 'mapping'
  resource_id VARCHAR(512),
  changes JSONB, -- What changed
  status VARCHAR(50), -- 'success' | 'error'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_integrations_user_id ON integrations(user_id);
CREATE INDEX idx_syncs_user_id ON syncs(user_id);
CREATE INDEX idx_sync_states_sync_id ON sync_states(sync_id);
CREATE INDEX idx_object_mappings_sync_id ON object_mappings(sync_id);
CREATE INDEX idx_object_mappings_source ON object_mappings(source_provider, source_object_id);
CREATE INDEX idx_object_mappings_destination ON object_mappings(destination_provider, destination_object_id);
CREATE INDEX idx_webhooks_integration_id ON webhooks(integration_id);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

---

## 🔐 Authentication & OAuth

### OAuth Configuration

Each provider needs OAuth app registration:

```typescript
// src/integrations/oauth-config.ts

export const OAUTH_PROVIDERS = {
  notion: {
    clientId: process.env.NOTION_OAUTH_CLIENT_ID,
    clientSecret: process.env.NOTION_OAUTH_CLIENT_SECRET,
    redirectUri: 'https://app.0sync.com/oauth/notion/callback',
    scopes: ['read', 'write'],
  },
  google: {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: 'https://app.0sync.com/oauth/google/callback',
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/tasks',
      'https://www.googleapis.com/auth/contacts.readonly',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/gmail.readonly',
    ],
  },
  microsoft: {
    clientId: process.env.MICROSOFT_OAUTH_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET,
    redirectUri: 'https://app.0sync.com/oauth/microsoft/callback',
    scopes: [
      'Calendars.ReadWrite',
      'Tasks.ReadWrite',
      'Contacts.Read',
      'Mail.Read',
    ],
  },
  // ... more providers
};
```

### Auth Flow

```typescript
// src/auth/oauth.service.ts

import axios from 'axios';
import jwt from 'jsonwebtoken';

export class OAuthService {
  
  // Step 1: Redirect user to provider
  getAuthorizationUrl(provider: string): string {
    const config = OAUTH_PROVIDERS[provider];
    const state = generateRandomState();
    // Store state in Redis for verification
    storeState(state, { provider, expiresIn: 300 });
    
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state,
    });
    
    return `${PROVIDER_URLS[provider].auth}?${params.toString()}`;
  }

  // Step 2: Exchange code for tokens
  async exchangeAuthorizationCode(
    provider: string,
    code: string,
    state: string,
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }> {
    // Verify state
    if (!verifyState(state)) throw new Error('Invalid state');

    const config = OAUTH_PROVIDERS[provider];
    const response = await axios.post(
      PROVIDER_URLS[provider].token,
      {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: config.redirectUri,
      },
    );

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
    };
  }

  // Step 3: Refresh tokens (automatic)
  async refreshAccessToken(
    provider: string,
    refreshToken: string,
  ): Promise<string> {
    const config = OAUTH_PROVIDERS[provider];
    const response = await axios.post(
      PROVIDER_URLS[provider].token,
      {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      },
    );

    return response.data.access_token;
  }
}
```

---

## 🔄 Sync Engine

### Core Sync Architecture

```typescript
// src/sync/sync.engine.ts

import Bull from 'bull';
import { Logger } from '@nestjs/common';

export class SyncEngine {
  private syncQueue: Bull.Queue;
  private webhookQueue: Bull.Queue;
  private logger = new Logger(SyncEngine.name);

  constructor(
    private db: Database,
    private providers: ProvidersRegistry,
    private stateService: SyncStateService,
    private conflictResolver: ConflictResolutionService,
  ) {
    this.initializeQueues();
  }

  async initializeQueues() {
    // Main sync processing queue
    this.syncQueue = new Bull('sync-processor', {
      redis: { host: process.env.REDIS_HOST, port: 6379 },
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
      },
    });

    // Webhook processing queue
    this.webhookQueue = new Bull('webhook-processor', {
      redis: { host: process.env.REDIS_HOST, port: 6379 },
      defaultJobOptions: {
        attempts: 3,
        removeOnComplete: false,
      },
    });

    // Set up workers
    this.syncQueue.process(5, (job) => this.processSyncJob(job));
    this.webhookQueue.process(10, (job) => this.processWebhookJob(job));

    // Schedule polling jobs every 5 minutes for non-webhook syncs
    this.schedulePollingJobs();
  }

  /**
   * Main sync processing logic
   */
  async processSyncJob(job: Bull.Job<SyncJobData>) {
    const { syncId } = job.data;
    
    try {
      const sync = await this.db.syncs.findById(syncId);
      const state = await this.stateService.getState(syncId);
      const sourceInteg = await this.db.integrations.findById(sync.source_integration_id);
      const destInteg = await this.db.integrations.findById(sync.destination_integration_id);

      this.logger.log(`Starting sync: ${syncId}`);

      // Step 1: Fetch from source
      const sourceProvider = this.providers.get(sourceInteg.provider);
      const sourceData = await sourceProvider.fetch(sourceInteg, sync.source_config, state.source_cursor);

      // Step 2: Fetch from destination for conflict detection
      const destProvider = this.providers.get(destInteg.provider);
      const destData = destProvider ? await destProvider.fetch(destInteg, sync.destination_config, state.destination_cursor) : null;

      // Step 3: Detect changes & conflicts
      const { toCreate, toUpdate, toDelete, conflicts } = await this.detectChanges(
        sync,
        sourceData,
        destData,
        state,
      );

      // Step 4: Handle conflicts
      if (conflicts.length > 0) {
        await this.handleConflicts(sync, conflicts);
      }

      // Step 5: Apply transformations
      const transformed = await this.applyFieldMappings(sync, toCreate, toUpdate, toDelete);

      // Step 6: Push to destination
      if (sync.direction === 'bidirectional' || sync.direction === 'one_way') {
        await destProvider.pushChanges(destInteg, sync.destination_config, transformed);
      }

      // Step 7: Push to source (if bidirectional and supported)
      if (sync.direction === 'bidirectional' && sourceProvider.supportsBidirectional) {
        const destChanges = await this.detectDestinationChanges(sync, destData, state);
        const transformedBack = await this.applyReverseFieldMappings(sync, destChanges);
        await sourceProvider.pushChanges(sourceInteg, sync.source_config, transformedBack);
      }

      // Step 8: Update sync state
      await this.stateService.updateState(syncId, {
        source_cursor: sourceData.nextCursor,
        destination_cursor: destData?.nextCursor,
        last_sync_at: new Date(),
        retry_count: 0,
      });

      // Step 9: Log audit trail
      await this.db.auditLogs.create({
        sync_id: syncId,
        action: 'sync_completed',
        status: 'success',
        changes: {
          created: toCreate.length,
          updated: toUpdate.length,
          deleted: toDelete.length,
          conflicts: conflicts.length,
        },
      });

    } catch (error) {
      this.logger.error(`Sync failed: ${job.data.syncId}`, error);
      
      // Update state with error & backoff
      await this.stateService.updateState(job.data.syncId, {
        retry_count: job.attemptsMade,
        backoff_until: new Date(Date.now() + Math.pow(2, job.attemptsMade) * 1000),
      });

      // Record error in sync status
      await this.db.syncs.update(job.data.syncId, {
        status: 'error',
        last_error: error.message,
        last_error_at: new Date(),
      });

      throw error; // Bull will retry
    }
  }

  /**
   * Webhook event processing
   */
  async processWebhookJob(job: Bull.Job<WebhookJobData>) {
    const { webhookId, eventType, payload } = job.data;

    try {
      // Find syncs related to this webhook
      const syncs = await this.db.syncs.findBySourcingWebhook(webhookId);
      
      // Queue priority sync jobs for each sync
      for (const sync of syncs) {
        await this.syncQueue.add(
          { syncId: sync.id },
          { priority: 10, delay: 0 }, // High priority
        );
      }
    } catch (error) {
      this.logger.error(`Webhook processing failed: ${webhookId}`, error);
      throw error;
    }
  }

  /**
   * Detect changes using checksums & cursors
   */
  private async detectChanges(
    sync: SyncRecord,
    sourceData: FetchResult,
    destData: FetchResult | null,
    state: SyncState,
  ): Promise<ChangeSet> {
    const toCreate: Array<any> = [];
    const toUpdate: Array<any> = [];
    const toDelete: Array<any> = [];
    const conflicts: Array<Conflict> = [];

    for (const sourceObj of sourceData.objects) {
      const mapping = await this.db.objectMappings.findBySourceId(
        sync.id,
        sourceObj.id,
      );

      if (!mapping) {
        // New object in source
        toCreate.push(sourceObj);
      } else {
        // Existing object - check if changed
        const sourceChecksum = hashObject(sourceObj);
        
        if (sourceChecksum !== mapping.source_checksum) {
          // Source has changed
          if (destData) {
            const destObj = destData.objects.find((o) => o.id === mapping.destination_object_id);
            const destChecksum = hashObject(destObj);

            if (destChecksum !== mapping.destination_checksum) {
              // BOTH changed - conflict
              conflicts.push({
                sourceObj,
                destObj,
                sourceChecksum,
                destChecksum,
                mappingId: mapping.id,
              });
            } else {
              // Only source changed
              toUpdate.push({ ...sourceObj, _mappingId: mapping.id });
            }
          } else {
            toUpdate.push({ ...sourceObj, _mappingId: mapping.id });
          }
        }
      }
    }

    // Check for deletions in source
    const sourceIds = new Set(sourceData.objects.map((o) => o.id));
    const mappings = await this.db.objectMappings.findBySync(sync.id);
    for (const mapping of mappings) {
      if (!sourceIds.has(mapping.source_object_id)) {
        // Deleted in source
        toDelete.push(mapping);
      }
    }

    return { toCreate, toUpdate, toDelete, conflicts };
  }

  /**
   * Conflict resolution
   */
  private async handleConflicts(sync: SyncRecord, conflicts: Conflict[]) {
    const strategy = sync.conflict_resolution;

    for (const conflict of conflicts) {
      if (strategy === 'last_write_wins') {
        const sourceTime = conflict.sourceObj.updated_at || conflict.sourceObj.created_at;
        const destTime = conflict.destObj.updated_at || conflict.destObj.created_at;

        conflict.winner = new Date(sourceTime) > new Date(destTime) ? 'source' : 'destination';
      } else if (strategy === 'manual') {
        // Mark as unresolved, notify user
        await this.db.objectMappings.update(conflict.mappingId, {
          conflict_flag: true,
        });
        await this.db.auditLogs.create({
          sync_id: sync.id,
          action: 'conflict_detected',
          status: 'pending_manual_resolution',
          changes: conflict,
        });
      }
    }
  }

  /**
   * Apply field mappings & transformations
   */
  private async applyFieldMappings(
    sync: SyncRecord,
    toCreate: Array<any>,
    toUpdate: Array<any>,
    toDelete: Array<any>,
  ): Promise<TransformedChangeSet> {
    const mappings = sync.field_mapping;

    const transformed = {
      toCreate: toCreate.map((obj) => transformObject(obj, mappings, 'create')),
      toUpdate: toUpdate.map((obj) => transformObject(obj, mappings, 'update')),
      toDelete: toDelete.map((obj) => ({ id: obj.destination_object_id })),
    };

    return transformed;
  }

  /**
   * Schedule polling for non-webhook syncs
   */
  private async schedulePollingJobs() {
    setInterval(async () => {
      const syncs = await this.db.syncs.findAll({ status: 'active' });

      for (const sync of syncs) {
        // Check if sync uses webhooks; if not, queue polling job
        const hasWebhooks = await this.db.webhooks.findByIntegration(
          sync.source_integration_id,
        );

        if (!hasWebhooks.length) {
          await this.syncQueue.add({ syncId: sync.id }, { delay: Math.random() * 60000 });
        }
      }
    }, 300000); // Every 5 minutes
  }
}
```

---

## 🧩 Unified Provider SDK

```typescript
// src/providers/provider.interface.ts

export interface IProvider {
  /**
   * Authentication
   */
  getAuthorizationUrl(): string;
  exchangeAuthorizationCode(code: string): Promise<TokenResponse>;
  refreshAccessToken(refreshToken: string): Promise<string>;

  /**
   * Data fetching (with cursor/delta support)
   */
  fetch(
    integration: Integration,
    config: Record<string, any>,
    cursor?: string,
  ): Promise<FetchResult>;

  /**
   * Data pushing (create, update, delete)
   */
  pushChanges(
    integration: Integration,
    config: Record<string, any>,
    changes: TransformedChangeSet,
  ): Promise<PushResult>;

  /**
   * Webhook management
   */
  registerWebhook?(webhookUrl: string): Promise<WebhookRegistration>;
  verifyWebhookSignature?(signature: string, payload: Buffer): boolean;
  parseWebhookPayload?(payload: Record<string, any>): ParsedWebhookEvent[];

  /**
   * Metadata
   */
  supportsBidirectional: boolean;
  supportsWebhooks: boolean;
  supportsFieldMapping: boolean;
  rateLimitInfo: RateLimitInfo;

  /**
   * Batch operations
   */
  batchCreate?(objects: Array<any>): Promise<Array<string>>;
  batchUpdate?(objects: Array<any>): Promise<void>;
  batchDelete?(ids: Array<string>): Promise<void>;
}

export interface FetchResult {
  objects: Array<any>;
  nextCursor?: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface WebhookRegistration {
  id: string;
  secret?: string;
  status: 'active' | 'pending';
}

export interface RateLimitInfo {
  requestsPerMinute: number;
  batchSize: number;
  retryAfter?: number;
}
```

---

## 📤 Provider Implementations (Sample: Notion + Todoist)

### Notion Provider

```typescript
// src/providers/notion/notion.provider.ts

import { Client } from '@notionhq/client';
import { IProvider, FetchResult, TokenResponse } from '../provider.interface';

export class NotionProvider implements IProvider {
  supportsBidirectional = true;
  supportsWebhooks = true;
  supportsFieldMapping = true;
  rateLimitInfo = { requestsPerMinute: 120, batchSize: 100 };

  async getAuthorizationUrl(): string {
    const params = new URLSearchParams({
      client_id: process.env.NOTION_OAUTH_CLIENT_ID,
      redirect_uri: 'https://app.0sync.com/oauth/notion/callback',
      response_type: 'code',
      owner: 'user',
    });
    return `https://api.notion.com/v1/oauth/authorize?${params}`;
  }

  async exchangeAuthorizationCode(code: string): Promise<TokenResponse> {
    const response = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'https://app.0sync.com/oauth/notion/callback',
        client_id: process.env.NOTION_OAUTH_CLIENT_ID,
        client_secret: process.env.NOTION_OAUTH_CLIENT_SECRET,
      }),
    });

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  }

  async fetch(
    integration: Integration,
    config: { database_id: string; filter?: any },
    cursor?: string,
  ): Promise<FetchResult> {
    const client = new Client({ auth: integration.oauth_access_token });

    const response = await client.databases.query({
      database_id: config.database_id,
      filter: config.filter,
      start_cursor: cursor,
      page_size: 100,
    });

    const objects = response.results.map((page: any) => ({
      id: page.id,
      title: page.properties.Name?.title?.[0]?.plain_text || '',
      properties: page.properties,
      created_at: page.created_time,
      updated_at: page.last_edited_time,
    }));

    return {
      objects,
      nextCursor: response.next_cursor || undefined,
    };
  }

  async pushChanges(
    integration: Integration,
    config: { database_id: string },
    changes: TransformedChangeSet,
  ): Promise<PushResult> {
    const client = new Client({ auth: integration.oauth_access_token });

    for (const obj of changes.toCreate) {
      await client.pages.create({
        parent: { database_id: config.database_id },
        properties: this.transformToNotionProperties(obj),
      });
    }

    for (const obj of changes.toUpdate) {
      await client.pages.update({
        page_id: obj.id,
        properties: this.transformToNotionProperties(obj),
      });
    }

    for (const obj of changes.toDelete) {
      await client.pages.update({
        page_id: obj.id,
        archived: true,
      });
    }

    return { success: true };
  }

  async registerWebhook(webhookUrl: string): Promise<WebhookRegistration> {
    // Note: Notion webhooks currently not available in public API
    // This would be implemented when available
    return {
      id: 'notion_webhook',
      status: 'pending',
    };
  }

  private transformToNotionProperties(obj: any) {
    // Convert external object to Notion property format
    return {
      Name: { title: [{ text: { content: obj.title } }] },
      // ... more properties
    };
  }
}
```

### Todoist Provider

```typescript
// src/providers/todoist/todoist.provider.ts

import axios from 'axios';
import { IProvider, FetchResult, TokenResponse } from '../provider.interface';

export class TodoistProvider implements IProvider {
  supportsBidirectional = true;
  supportsWebhooks = true;
  supportsFieldMapping = true;
  rateLimitInfo = { requestsPerMinute: 450, batchSize: 100 };

  async exchangeAuthorizationCode(code: string): Promise<TokenResponse> {
    const response = await axios.post('https://todoist.com/oauth/access_token', {
      client_id: process.env.TODOIST_OAUTH_CLIENT_ID,
      client_secret: process.env.TODOIST_OAUTH_CLIENT_SECRET,
      code,
    });

    return {
      accessToken: response.data.access_token,
    };
  }

  async fetch(
    integration: Integration,
    config: { project_id?: string },
    cursor?: string,
  ): Promise<FetchResult> {
    const response = await axios.get('https://api.todoist.com/rest/v2/tasks', {
      headers: { Authorization: `Bearer ${integration.oauth_access_token}` },
      params: {
        project_id: config.project_id,
        lang: 'en',
      },
    });

    const objects = response.data.map((task: any) => ({
      id: task.id,
      title: task.content,
      description: task.description,
      priority: task.priority,
      completed: task.is_completed,
      due_date: task.due?.date,
      created_at: task.created_at,
      updated_at: task.updated_at,
    }));

    return {
      objects,
      nextCursor: undefined, // Todoist doesn't use cursors
    };
  }

  async pushChanges(
    integration: Integration,
    config: { project_id?: string },
    changes: TransformedChangeSet,
  ): Promise<PushResult> {
    const api = axios.create({
      baseURL: 'https://api.todoist.com/rest/v2',
      headers: { Authorization: `Bearer ${integration.oauth_access_token}` },
    });

    // Batch create
    for (const obj of changes.toCreate) {
      await api.post('/tasks', {
        content: obj.title,
        description: obj.description,
        project_id: config.project_id,
        due_string: obj.due_date,
        priority: obj.priority,
      });
    }

    // Batch update
    for (const obj of changes.toUpdate) {
      await api.post(`/tasks/${obj.id}`, {
        content: obj.title,
        description: obj.description,
        due_string: obj.due_date,
        priority: obj.priority,
      });
    }

    // Batch delete
    for (const obj of changes.toDelete) {
      await api.delete(`/tasks/${obj.id}`);
    }

    return { success: true };
  }

  async registerWebhook(webhookUrl: string): Promise<WebhookRegistration> {
    // Note: Todoist webhooks require manual setup via API
    // This would register a Todoist project webhook
    const response = await axios.post(
      'https://api.todoist.com/sync/v9/webhooks/add',
      {
        url: webhookUrl,
      },
      {
        headers: { Authorization: `Bearer ${process.env.TODOIST_OAUTH_TOKEN}` },
      },
    );

    return {
      id: response.data.webhook_id,
      secret: response.data.webhook_secret,
      status: 'active',
    };
  }

  verifyWebhookSignature(signature: string, payload: Buffer): boolean {
    const crypto = require('crypto');
    const secret = process.env.TODOIST_WEBHOOK_SECRET;
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64');
    return hmac === signature;
  }

  parseWebhookPayload(payload: Record<string, any>): ParsedWebhookEvent[] {
    return payload.events.map((event: any) => ({
      type: event.event_type, // 'item:added', 'item:updated', etc.
      objectId: event.data.id,
      data: event.data,
      timestamp: event.timestamp,
    }));
  }
}
```

---

## 🔌 REST API Design

### Core Endpoints

```typescript
// src/routes/auth.routes.ts
POST   /auth/signup                    # Register with email
POST   /auth/login                     # Login
POST   /auth/logout                    # Logout
POST   /auth/refresh                   # Refresh JWT

// src/routes/integrations.routes.ts
GET    /integrations                   # List user's integrations
POST   /integrations/:provider/authorize   # Start OAuth flow
GET    /integrations/:provider/callback    # OAuth callback
GET    /integrations/:id               # Get integration details
PUT    /integrations/:id               # Update integration
DELETE /integrations/:id               # Disconnect integration

// src/routes/syncs.routes.ts
GET    /syncs                          # List syncs
POST   /syncs                          # Create new sync
GET    /syncs/:id                      # Get sync details
PUT    /syncs/:id                      # Update sync config
DELETE /syncs/:id                      # Delete sync
POST   /syncs/:id/run                  # Manually trigger sync
GET    /syncs/:id/status               # Get sync status
GET    /syncs/:id/logs                 # Get sync logs

// src/routes/mappings.routes.ts
GET    /syncs/:syncId/mappings         # List object mappings
GET    /syncs/:syncId/conflicts        # List conflicts
POST   /syncs/:syncId/conflicts/:id/resolve  # Resolve conflict

// src/routes/webhooks.routes.ts
POST   /webhooks/:provider/:integrationId   # Receive webhook event
GET    /webhooks/health                # Health check

// src/routes/user.routes.ts
GET    /user/profile                   # Get user profile
PUT    /user/profile                   # Update profile
GET    /user/settings                  # Get settings
POST   /user/settings                  # Update settings
```

### Request/Response Examples

```json
// POST /syncs
{
  "name": "Notion Tasks → Todoist",
  "source_integration_id": "uuid-1",
  "source_type": "notion_database",
  "source_config": {
    "database_id": "notion-db-123"
  },
  "destination_integration_id": "uuid-2",
  "destination_type": "todoist_project",
  "destination_config": {
    "project_id": "todoist-project-456"
  },
  "direction": "bidirectional",
  "conflict_resolution": "last_write_wins",
  "field_mapping": {
    "Name": { "destination_field": "content" },
    "Due Date": { "destination_field": "due_date", "transform": "parse_date" },
    "Priority": { "destination_field": "priority", "transform": "map_priority_notion_to_todoist" }
  }
}

// Response
{
  "id": "sync-uuid",
  "name": "Notion Tasks → Todoist",
  "status": "active",
  "created_at": "2025-01-30T10:00:00Z",
  "next_sync_at": "2025-01-30T10:05:00Z"
}
```

---

## 🎨 Frontend Architecture

### Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Layout/                 # Header, nav, sidebar
│   │   ├── Dashboard/              # Main dashboard
│   │   ├── Onboarding/             # Integration setup flows
│   │   ├── SyncConfig/             # Sync creation & editing
│   │   ├── Logs/                   # Sync logs & history
│   │   ├── ConflictResolver/       # Conflict UI
│   │   └── Common/                 # Reusable components
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useSyncs.ts
│   │   ├── useIntegrations.ts
│   │   └── useApi.ts
│   ├── services/
│   │   ├── api.service.ts
│   │   ├── auth.service.ts
│   │   └── storage.service.ts
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── IntegrationPage.tsx
│   │   ├── SyncDetailPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── 404.tsx
│   ├── types/
│   │   ├── index.ts                # Global types
│   ├── styles/
│   │   └── globals.css
│   ├── utils/
│   ├── App.tsx
│   └── main.tsx
├── tailwind.config.js
├── vite.config.ts
└── package.json
```

### Key Pages

#### Dashboard (Main Hub)

```tsx
// src/pages/DashboardPage.tsx

import React, { useEffect, useState } from 'react';
import { useSyncs, useIntegrations } from '../hooks';
import SyncCard from '../components/Dashboard/SyncCard';
import CreateSyncButton from '../components/Dashboard/CreateSyncButton';

export const DashboardPage: React.FC = () => {
  const { syncs, loading, error } = useSyncs();
  const { integrations } = useIntegrations();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Syncs</h1>
        <CreateSyncButton />
      </div>

      {loading && <div>Loading...</div>}
      {error && <div className="text-red-600">{error}</div>}

      <div className="grid gap-4">
        {syncs.map((sync) => (
          <SyncCard
            key={sync.id}
            sync={sync}
            sourceIntegration={integrations.find((i) => i.id === sync.source_integration_id)}
            destIntegration={integrations.find((i) => i.id === sync.destination_integration_id)}
          />
        ))}
      </div>

      {syncs.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 mb-4">No syncs yet</p>
          <CreateSyncButton />
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
```

#### Integration Onboarding

```tsx
// src/components/Onboarding/IntegrationFlow.tsx

import React, { useState } from 'react';
import NotionOnboarding from './providers/NotionOnboarding';
import TodoistOnboarding from './providers/TodoistOnboarding';
import GoogleOnboarding from './providers/GoogleOnboarding';

const PROVIDERS = [
  { id: 'notion', name: 'Notion', icon: '🔷' },
  { id: 'todoist', name: 'Todoist', icon: '✓' },
  { id: 'google_calendar', name: 'Google Calendar', icon: '📅' },
  // ... more
];

export const IntegrationFlow: React.FC = () => {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  const handleStartAuth = (providerId: string) => {
    setSelectedProvider(providerId);
    // Trigger OAuth flow or API key entry based on provider
    const authUrl = `/api/integrations/${providerId}/authorize`;
    window.location.href = authUrl;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {PROVIDERS.map((provider) => (
        <button
          key={provider.id}
          onClick={() => handleStartAuth(provider.id)}
          className="p-6 border rounded-lg hover:shadow-lg transition"
        >
          <div className="text-4xl mb-2">{provider.icon}</div>
          <div className="font-semibold">{provider.name}</div>
        </button>
      ))}
    </div>
  );
};
```

---

## 🚀 Deployment Configuration

### Docker Setup

```dockerfile
# Dockerfile.backend
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

```dockerfile
# Dockerfile.frontend
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      REDIS_URL: redis://redis:6379
      NODE_ENV: production
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
    volumes:
      - ./src:/app/src

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.frontend
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres_data:
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: 0sync-backend
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
        image: 0sync:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: 0sync-secrets
              key: database-url
        - name: REDIS_URL
          value: redis://redis-service:6379
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10

---
apiVersion: v1
kind: Service
metadata:
  name: 0sync-backend-service
spec:
  selector:
    app: 0sync-backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

---

## 🔒 Security Checklist

- [ ] **Token Encryption**: All OAuth tokens encrypted at rest (AES-256)
- [ ] **HTTPS Enforced**: All traffic encrypted in transit
- [ ] **CORS**: Properly configured for frontend domain only
- [ ] **Rate Limiting**: Per-user, per-IP limits on API
- [ ] **Input Validation**: All inputs validated & sanitized
- [ ] **SQL Injection Prevention**: Parameterized queries, ORM
- [ ] **XSS Prevention**: Content Security Policy headers
- [ ] **CSRF Protection**: Anti-CSRF tokens on state-changing endpoints
- [ ] **Webhook Signature Verification**: HMAC signatures verified
- [ ] **JWT Expiration**: Short-lived tokens (15 min), refresh tokens (7 days)
- [ ] **Password Hashing**: bcrypt with salt rounds ≥12
- [ ] **Audit Logging**: All sensitive actions logged with user context
- [ ] **Data Retention**: PII deletion policies, GDPR compliance
- [ ] **Secrets Management**: Environment variables, no hardcoding

---

## 📊 Observability & Monitoring

```typescript
// src/common/logger.ts

import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

// Usage in services
logger.info({ syncId: sync.id }, 'Sync started');
logger.error({ error, syncId }, 'Sync failed');
```

### Metrics to Track

- Sync success rate (%)
- Average sync duration (ms)
- Conflict frequency
- API rate limit utilization
- Webhook delivery latency
- Integration disconnections
- Error rates by provider
- User retention & churn
- API endpoint response times

---

## 🎯 Next Steps (Implementation Order)

1. **Database & Schema**: Set up PostgreSQL, run migrations
2. **Auth System**: JWT, OAuth middleware, user management
3. **Core API**: CRUD endpoints for syncs, integrations, sync states
4. **Notion Provider**: Implement Notion OAuth + sync logic (proof of concept)
5. **Todoist Provider**: Second provider integration
6. **Sync Engine**: Core sync loop, change detection, conflict resolution
7. **Job Queue**: Redis Bull setup, polling & webhook processing
8. **Frontend**: Basic dashboard, integration setup, sync creation
9. **Google Services**: Calendar, Tasks, Contacts, Sheets, Gmail
10. **Microsoft Services**: To-Do, Calendar, Contacts, Mail
11. **Additional Providers**: Apple, GitHub, Trello, Asana, Linear, Jira, TickTick
12. **Testing**: Unit, integration, E2E tests
13. **Deployment**: Docker, Kubernetes, CI/CD
14. **Polish**: UI/UX refinement, documentation, security audit

---

## 📝 Development Guidelines

### Code Style
- **Language**: TypeScript (strict mode)
- **Formatter**: Prettier
- **Linter**: ESLint
- **Naming**: camelCase for functions/vars, PascalCase for classes/types
- **Comments**: JSDoc for public APIs

### Testing
- Unit test coverage: ≥80%
- Integration tests for all providers
- E2E tests for critical flows
- Load tests for sync engine

### Git Workflow
- Feature branches: `feature/sync-google-calendar`
- Commit messages: Conventional commits
- PRs required before merge
- CI/CD checks before deploy

---

**This design is production-ready and can be implemented incrementally, starting with Notion + 2-3 providers and expanding to the full 15+ provider ecosystem.**

