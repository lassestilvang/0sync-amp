import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import { Integration } from '../../modules/integrations/entities/integration.entity';
import {
  IProvider,
  FetchResult,
  TokenResponse,
  PushResult,
  WebhookRegistration,
  ParsedWebhookEvent,
  TransformedChangeSet,
  RateLimitInfo,
} from '../provider.interface';
import { createChildLogger } from '../../common/logger';
import { EncryptionService } from '../../common/services/encryption.service';

const logger = createChildLogger('TodoistProvider');

@Injectable()
export class TodoistProvider implements IProvider {
  supportsBidirectional = true;
  supportsWebhooks = true;
  supportsFieldMapping = true;
  rateLimitInfo: RateLimitInfo = {
    requestsPerMinute: 450,
    batchSize: 100,
  };

  constructor(private encryptionService: EncryptionService) {}

  getAuthorizationUrl(): string {
    const clientId = process.env.TODOIST_OAUTH_CLIENT_ID;
    const redirectUri = `${process.env.API_URL}/oauth/todoist/callback`;

    const params = new URLSearchParams({
      client_id: clientId || '',
      scope: 'data:read_write',
      state: crypto.randomBytes(16).toString('hex'),
    });

    return `https://todoist.com/oauth/authorize?${params.toString()}`;
  }

  async exchangeAuthorizationCode(code: string): Promise<TokenResponse> {
    const response = await axios.post('https://todoist.com/oauth/access_token', {
      client_id: process.env.TODOIST_OAUTH_CLIENT_ID,
      client_secret: process.env.TODOIST_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: `${process.env.API_URL}/oauth/todoist/callback`,
    });

    logger.info('Todoist OAuth exchange successful');

    return {
      accessToken: response.data.access_token,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    // Todoist doesn't use refresh tokens
    throw new Error('Todoist does not support token refresh');
  }

  private getClient(accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: 'https://api.todoist.com/rest/v2',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async fetch(
    integration: Integration,
    config: { project_id?: string; filter?: string },
    cursor?: string,
  ): Promise<FetchResult> {
    try {
      const accessToken = this.encryptionService.decrypt(
        integration.oauth_access_token || '',
      );

      const client = this.getClient(accessToken);

      const params: any = {};
      if (config.project_id) {
        params.project_id = config.project_id;
      }
      if (config.filter) {
        params.filter = config.filter;
      }

      const response = await client.get('/tasks', { params });

      const objects = response.data.map((task: any) => ({
        id: task.id,
        title: task.content,
        description: task.description,
        priority: task.priority,
        due_date: task.due?.date,
        completed: task.is_completed,
        labels: task.labels,
        project_id: task.project_id,
        created_at: task.created_at,
        updated_at: task.updated_at,
      }));

      logger.info(`Fetched ${objects.length} tasks from Todoist`);

      return {
        objects,
        // Todoist doesn't use cursors, fetch all each time
        nextCursor: undefined,
      };
    } catch (error) {
      logger.error(error, 'Failed to fetch from Todoist');
      throw error;
    }
  }

  async pushChanges(
    integration: Integration,
    config: { project_id?: string },
    changes: TransformedChangeSet,
  ): Promise<PushResult> {
    const accessToken = this.encryptionService.decrypt(
      integration.oauth_access_token || '',
    );

    const client = this.getClient(accessToken);

    const result: PushResult = {
      success: true,
      created: 0,
      updated: 0,
      deleted: 0,
      errors: [],
    };

    try {
      // Create new tasks
      for (const obj of changes.toCreate) {
        try {
          await client.post('/tasks', {
            content: obj.title,
            description: obj.description,
            project_id: config.project_id,
            due_string: obj.due_date,
            priority: obj.priority,
            labels: obj.labels || [],
          });
          result.created = (result.created || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: obj.id || 'unknown',
            error: error.message,
          });
        }
      }

      // Update tasks
      for (const obj of changes.toUpdate) {
        try {
          await client.post(`/tasks/${obj.id}`, {
            content: obj.title,
            description: obj.description,
            due_string: obj.due_date,
            priority: obj.priority,
            labels: obj.labels || [],
          });
          result.updated = (result.updated || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: obj.id,
            error: error.message,
          });
        }
      }

      // Delete tasks
      for (const obj of changes.toDelete) {
        try {
          await client.delete(`/tasks/${obj.id}`);
          result.deleted = (result.deleted || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: obj.id,
            error: error.message,
          });
        }
      }

      logger.info(`Pushed changes to Todoist: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`);
    } catch (error) {
      logger.error(error, 'Failed to push changes to Todoist');
      result.success = false;
    }

    return result;
  }

  async registerWebhook(webhookUrl: string): Promise<WebhookRegistration> {
    // TODO: Implement Todoist webhook registration
    return Promise.resolve({
      id: 'todoist_webhook',
      status: 'pending',
    });
  }

  verifyWebhookSignature(signature: string, payload: Buffer): boolean {
    const secret = process.env.TODOIST_WEBHOOK_SECRET || '';
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64');
    return hmac === signature;
  }

  parseWebhookPayload(payload: Record<string, any>): ParsedWebhookEvent[] {
    return payload.events?.map((event: any) => ({
      type: event.event_type,
      objectId: event.data?.id,
      data: event.data,
      timestamp: event.timestamp,
    })) || [];
  }
}
