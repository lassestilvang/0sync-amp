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

const logger = createChildLogger('AsanaProvider');

@Injectable()
export class AsanaProvider implements IProvider {
  supportsBidirectional = true;
  supportsWebhooks = true;
  supportsFieldMapping = true;
  rateLimitInfo: RateLimitInfo = {
    requestsPerMinute: 600,
    batchSize: 50,
  };

  constructor(private encryptionService: EncryptionService) {}

  getAuthorizationUrl(): string {
    const clientId = process.env.ASANA_OAUTH_CLIENT_ID;
    const redirectUri = `${process.env.API_URL}/oauth/asana/callback`;

    const params = new URLSearchParams({
      client_id: clientId || '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'default',
    });

    return `https://app.asana.com/-/oauth_authorize?${params.toString()}`;
  }

  async exchangeAuthorizationCode(code: string): Promise<TokenResponse> {
    const response = await axios.post('https://app.asana.com/-/oauth_token', {
      client_id: process.env.ASANA_OAUTH_CLIENT_ID,
      client_secret: process.env.ASANA_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: `${process.env.API_URL}/oauth/asana/callback`,
      grant_type: 'authorization_code',
    });

    logger.info('Asana OAuth exchange successful');

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const response = await axios.post('https://app.asana.com/-/oauth_token', {
      client_id: process.env.ASANA_OAUTH_CLIENT_ID,
      client_secret: process.env.ASANA_OAUTH_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    logger.info('Asana token refreshed');
    return response.data.access_token;
  }

  private getClient(accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: 'https://app.asana.com/api/1.0',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async fetch(
    integration: Integration,
    config: { projectId: string },
    cursor?: string,
  ): Promise<FetchResult> {
    try {
      const accessToken = this.encryptionService.decrypt(
        integration.oauth_access_token || '',
      );

      const client = this.getClient(accessToken);

      const response = await client.get(`/projects/${config.projectId}/tasks`, {
        params: {
          limit: 100,
          offset: cursor,
        },
      });

      const objects = (
        (response.data.data as Array<Record<string, unknown>>) || []
      ).map((task) => ({
        id: task.gid as string,
        title: task.name as string,
        description: (task.notes as string) || '',
        completed: (task.completed as boolean) || false,
        assignee: (
          task.assignee as Record<string, unknown> | undefined
        )?.name,
        due_on: task.due_on as string | undefined,
        created_at: (task.created_at as string) || '',
        modified_at: (task.modified_at as string) || '',
      }));

      logger.info(`Fetched ${objects.length} tasks from Asana`);

      return {
         objects,
         nextCursor: String(
           (
             response.data.next_page as Record<string, unknown> | undefined
           )?.offset || '',
         ) || undefined,
       };
    } catch (error) {
      logger.error(error, 'Failed to fetch from Asana');
      throw error;
    }
  }

  async pushChanges(
    integration: Integration,
    config: { projectId: string },
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
            data: {
              name: obj.title,
              notes: obj.description,
              projects: [config.projectId],
              due_on: obj.due_on,
            },
          });
          result.created = (result.created || 0) + 1;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          result.errors?.push({
            id: String(obj.id || 'unknown'),
            error: errorMessage,
          });
        }
      }

      // Update existing tasks
      for (const obj of changes.toUpdate) {
        try {
          await client.put(`/tasks/${obj.id}`, {
            data: {
              name: obj.title,
              notes: obj.description,
              completed: obj.completed,
              due_on: obj.due_on,
            },
          });
          result.updated = (result.updated || 0) + 1;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          result.errors?.push({
            id: String(obj.id || 'unknown'),
            error: errorMessage,
          });
        }
        }

        // Delete tasks
        for (const obj of changes.toDelete) {
        try {
          await client.delete(`/tasks/${obj.id}`);
          result.deleted = (result.deleted || 0) + 1;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          result.errors?.push({
            id: String(obj.id || 'unknown'),
            error: errorMessage,
          });
        }
        }

      logger.info(
        `Pushed changes to Asana: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`,
      );
    } catch (error) {
      logger.error(error, 'Failed to push changes to Asana');
      result.success = false;
    }

    return result;
  }

  async registerWebhook(_webhookUrl: string): Promise<WebhookRegistration> {
    return Promise.resolve({
      id: 'asana_webhook',
      status: 'pending',
    });
  }

  verifyWebhookSignature(_signature: string, _payload: Buffer): boolean {
    return true;
  }

  parseWebhookPayload(
    payload: Record<string, unknown>,
  ): ParsedWebhookEvent[] {
    const events = payload.events as Array<Record<string, unknown>> | undefined;
    return (
      events?.map((event) => ({
        type: (event.type as string) || 'unknown',
        objectId:
          ((event.resource as Record<string, unknown> | undefined)?.gid as
            | string
            | undefined) || 'unknown',
        data: event,
        timestamp: new Date().toISOString(),
      })) || []
    );
  }
}
