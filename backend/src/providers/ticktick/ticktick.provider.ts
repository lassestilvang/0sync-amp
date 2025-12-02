import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
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

const logger = createChildLogger('TickTickProvider');

@Injectable()
export class TickTickProvider implements IProvider {
  supportsBidirectional = true;
  supportsWebhooks = false; // TickTick webhooks require enterprise plan
  supportsFieldMapping = true;
  rateLimitInfo: RateLimitInfo = {
    requestsPerMinute: 180,
    batchSize: 100,
  };

  constructor(private encryptionService: EncryptionService) {}

  getAuthorizationUrl(): string {
    const clientId = process.env.TICKTICK_OAUTH_CLIENT_ID;
    const redirectUri = `${process.env.API_URL}/oauth/ticktick/callback`;
    const scope = 'tasks:read tasks:write';

    const params = new URLSearchParams({
      client_id: clientId || '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
    });

    return `https://ticktick.com/oauth/authorize?${params.toString()}`;
  }

  async exchangeAuthorizationCode(code: string): Promise<TokenResponse> {
    const response = await axios.post('https://ticktick.com/oauth/token', {
      client_id: process.env.TICKTICK_OAUTH_CLIENT_ID,
      client_secret: process.env.TICKTICK_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: `${process.env.API_URL}/oauth/ticktick/callback`,
      grant_type: 'authorization_code',
      scope: 'tasks:read tasks:write',
    });

    logger.info('TickTick OAuth exchange successful');

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const response = await axios.post('https://ticktick.com/oauth/token', {
      client_id: process.env.TICKTICK_OAUTH_CLIENT_ID,
      client_secret: process.env.TICKTICK_OAUTH_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    logger.info('TickTick token refreshed');
    return response.data.access_token;
  }

  private getClient(accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: 'https://api.ticktick.com/v2',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async fetch(
    integration: Integration,
    config: Record<string, any>,
    cursor?: string,
  ): Promise<FetchResult> {
    try {
      const accessToken = this.encryptionService.decrypt(
        integration.oauth_access_token || '',
      );

      const client = this.getClient(accessToken);

      const response = await client.get('/tasks', {
        params: {
          projectId: config.project_id,
          includeArchived: false,
          pageNo: cursor ? parseInt(cursor, 10) : 1,
        },
      });

      const tasks = response.data.data.map((task: any) => ({
        id: task.id,
        title: task.title,
        description: task.content || '',
        status: task.status === 0 ? 'open' : 'closed',
        priority: task.priority || 0,
        dueDate: task.dueDate || '',
        assignees: task.assignees || [],
        tags: task.tags || [],
        created_at: new Date(task.createdTime).toISOString(),
        updated_at: new Date(task.modifiedTime).toISOString(),
      }));

      const pageNo = cursor ? parseInt(cursor, 10) : 1;
      const nextCursor = tasks.length > 0 ? String(pageNo + 1) : undefined;

      logger.info(`Fetched ${tasks.length} tasks from TickTick`);

      return {
        objects: tasks,
        nextCursor,
      };
    } catch (error) {
      logger.error(error, 'Failed to fetch from TickTick');
      throw error;
    }
  }

  async pushChanges(
    integration: Integration,
    config: Record<string, any>,
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
      // Create
      for (const obj of changes.toCreate) {
        try {
          await client.post('/tasks', {
            title: obj.title,
            content: obj.description,
            priority: obj.priority || 0,
            dueDate: obj.dueDate || '',
            projectId: config.project_id,
            tags: obj.tags || [],
          });
          result.created = (result.created || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: String(obj.id || 'unknown'),
            error: error.response?.data?.errorMsg || error.message,
          });
        }
      }

      // Update
      for (const obj of changes.toUpdate) {
        try {
          await client.post(`/tasks/${obj.id}`, {
            title: obj.title,
            content: obj.description,
            priority: obj.priority || 0,
            dueDate: obj.dueDate || '',
            tags: obj.tags || [],
          });
          result.updated = (result.updated || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: String(obj.id),
            error: error.response?.data?.errorMsg || error.message,
          });
        }
      }

      // Delete
      for (const obj of changes.toDelete) {
        try {
          await client.delete(`/tasks/${obj.id}`);
          result.deleted = (result.deleted || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: String(obj.id),
            error: error.response?.data?.errorMsg || error.message,
          });
        }
      }

      logger.info(
        `Pushed changes to TickTick: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`,
      );
    } catch (error) {
      logger.error(error, 'Failed to push changes to TickTick');
      result.success = false;
    }

    return result;
  }

  async registerWebhook(webhookUrl: string): Promise<WebhookRegistration> {
    // TickTick webhooks only available on enterprise plan
    return {
      id: 'ticktick_webhook',
      status: 'pending',
    };
  }

  verifyWebhookSignature(signature: string, payload: Buffer): boolean {
    // Webhook signature verification for TickTick
    return true;
  }

  parseWebhookPayload(payload: Record<string, any>): ParsedWebhookEvent[] {
    return [
      {
        type: payload.eventType || 'task.updated',
        objectId: payload.taskId || 'unknown',
        data: payload,
        timestamp: new Date().toISOString(),
      },
    ];
  }
}
