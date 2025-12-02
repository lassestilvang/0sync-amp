/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';

/**
 * End-to-End Test: Complete Sync Flow
 *
 * Tests a complete sync workflow:
 * 1. User authentication
 * 2. Provider OAuth connection
 * 3. Sync configuration
 * 4. Data fetching
 * 5. Change detection
 * 6. Data pushing
 * 7. Sync state tracking
 */
describe.skip('Complete Sync Flow (E2E)', () => {
  let app: INestApplication;
  let authToken: string;
  let userId: string;
  let sourceIntegrationId: string;
  let destIntegrationId: string;
  let syncId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Step 1: User Authentication', () => {
    it('should register a new user', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'test@0sync.test',
          password: 'TestPassword123!',
          fullName: 'Test User',
        })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@0sync.test');

      authToken = response.body.accessToken;
      userId = response.body.user.id;
    });

    it('should login with credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@0sync.test',
          password: 'TestPassword123!',
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      authToken = response.body.accessToken;
    });
  });

  describe('Step 2: OAuth Integration', () => {
    it('should get OAuth URL for provider', async () => {
      const response = await request(app.getHttpServer())
        .get('/oauth/authorize?provider=notion')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('authUrl');
      expect(response.body.authUrl).toContain('notion.com');
    });

    it('should handle OAuth callback', async () => {
      // In real test, this would use a test OAuth provider
      const response = await request(app.getHttpServer())
        .post('/oauth/notion/callback')
        .send({
          code: 'test_auth_code_12345',
        })
        .expect(200);

      expect(response.body).toHaveProperty('integration');
      expect(response.body.integration).toHaveProperty('id');
      sourceIntegrationId = response.body.integration.id;
    });

    it('should store encrypted tokens', async () => {
      const response = await request(app.getHttpServer())
        .get(`/integrations/${sourceIntegrationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('oauth_access_token');
      // Token should be encrypted in DB
      expect(response.body.oauth_access_token).not.toContain('Bearer');
    });
  });

  describe('Step 3: Sync Configuration', () => {
    it('should create second integration for destination', async () => {
      const response = await request(app.getHttpServer())
        .post('/oauth/todoist/callback')
        .send({
          code: 'test_auth_code_todoist',
        })
        .expect(200);

      destIntegrationId = response.body.integration.id;
    });

    it('should configure sync between providers', async () => {
      const response = await request(app.getHttpServer())
        .post('/syncs')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Notion to Todoist',
          description: 'Sync Notion tasks to Todoist',
          source_integration_id: sourceIntegrationId,
          source_type: 'notion_database',
          source_config: { database_id: 'test_db_123' },
          destination_integration_id: destIntegrationId,
          destination_type: 'todoist_project',
          destination_config: { project_id: 'test_proj_123' },
          direction: 'bidirectional',
          conflict_resolution: 'last_write_wins',
          field_mapping: {
            title: { dest_field: 'content' },
            description: { dest_field: 'description' },
          },
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('active');
      syncId = response.body.id;
    });
  });

  describe('Step 4: Sync Execution', () => {
    it('should queue and process sync job', async () => {
      const response = await request(app.getHttpServer())
        .post(`/syncs/${syncId}/trigger`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(202);

      expect(response.body).toHaveProperty('job_id');
      expect(response.body.status).toBe('queued');
    });

    it('should track sync state', async () => {
      const response = await request(app.getHttpServer())
        .get(`/syncs/${syncId}/state`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('sync_id');
      expect(response.body).toHaveProperty('last_sync_at');
      expect(response.body).toHaveProperty('retry_count');
    });
  });

  describe('Step 5: Change Detection & Pushing', () => {
    it('should detect new objects', async () => {
      const response = await request(app.getHttpServer())
        .get(`/syncs/${syncId}/changes`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('toCreate');
      expect(response.body).toHaveProperty('toUpdate');
      expect(response.body).toHaveProperty('toDelete');
      expect(Array.isArray(response.body.toCreate)).toBe(true);
    });

    it('should track object mappings', async () => {
      const response = await request(app.getHttpServer())
        .get(`/syncs/${syncId}/mappings`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      // Each mapping should have checksums
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('source_checksum');
        expect(response.body[0]).toHaveProperty('destination_checksum');
      }
    });
  });

  describe('Step 6: Conflict Resolution', () => {
    it('should detect conflicts', async () => {
      const response = await request(app.getHttpServer())
        .get(`/syncs/${syncId}/conflicts`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should resolve conflicts manually', async () => {
      // Get conflicts first
      const conflictsRes = await request(app.getHttpServer())
        .get(`/syncs/${syncId}/conflicts`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (conflictsRes.body.length > 0) {
        const conflictId = conflictsRes.body[0].id;

        const response = await request(app.getHttpServer())
          .post(`/conflicts/${conflictId}/resolve`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ resolution: 'use_source' })
          .expect(200);

        expect(response.body).toHaveProperty('resolved_at');
      }
    });
  });

  describe('Step 7: Logs & Monitoring', () => {
    it('should retrieve sync logs', async () => {
      const response = await request(app.getHttpServer())
        .get(`/syncs/${syncId}/logs`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('level');
        expect(response.body[0]).toHaveProperty('message');
        expect(response.body[0]).toHaveProperty('timestamp');
      }
    });

    it('should export logs as CSV', async () => {
      const response = await request(app.getHttpServer())
        .get(`/syncs/${syncId}/logs/export?format=csv`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/csv');
    });
  });

  describe('Step 8: Sync Cleanup', () => {
    it('should pause sync', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/syncs/${syncId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'paused' })
        .expect(200);

      expect(response.body.status).toBe('paused');
    });

    it('should resume sync', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/syncs/${syncId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'active' })
        .expect(200);

      expect(response.body.status).toBe('active');
    });
  });
});
