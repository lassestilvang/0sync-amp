import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { Integration } from '../../modules/integrations/entities/integration.entity';
import { IProvider, FetchResult, TokenResponse, PushResult, TransformedChangeSet, RateLimitInfo } from '../provider.interface';
import { createChildLogger } from '../../common/logger';
import { EncryptionService } from '../../common/services/encryption.service';

const logger = createChildLogger('MicrosoftToDoProvider');

@Injectable()
export class MicrosoftToDoProvider implements IProvider {
  supportsBidirectional = true;
  supportsWebhooks = false;
  supportsFieldMapping = true;
  rateLimitInfo: RateLimitInfo = { requestsPerMinute: 2000, batchSize: 100 };

  constructor(private encryptionService: EncryptionService) {}

  getAuthorizationUrl(): string {
    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_OAUTH_CLIENT_ID || '',
      redirect_uri: `${process.env.API_URL}/oauth/microsoft/callback`,
      response_type: 'code',
      scope: 'Tasks.ReadWrite offline_access',
      response_mode: 'query',
    });
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeAuthorizationCode(code: string): Promise<TokenResponse> {
    const response = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        client_id: process.env.MICROSOFT_OAUTH_CLIENT_ID || '',
        client_secret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET || '',
        code,
        redirect_uri: `${process.env.API_URL}/oauth/microsoft/callback`,
        grant_type: 'authorization_code',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    logger.info('Microsoft OAuth exchange successful');
    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const response = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        client_id: process.env.MICROSOFT_OAUTH_CLIENT_ID || '',
        client_secret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET || '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    return response.data.access_token;
  }

  async fetch(
    integration: Integration,
    config: { list_id: string },
    cursor?: string,
  ): Promise<FetchResult> {
    try {
      const accessToken = this.encryptionService.decrypt(integration.oauth_access_token || '');
      const response = await axios.get(
        `https://graph.microsoft.com/v1.0/me/todo/lists/${config.list_id}/tasks`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const objects = response.data.value?.map((task: any) => ({
        id: task.id,
        title: task.title,
        body: task.body?.content,
        status: task.status,
        importance: task.importance,
        dueDateTime: task.dueDateTime,
        completedDateTime: task.completedDateTime,
        createdDateTime: task.createdDateTime,
        lastModifiedDateTime: task.lastModifiedDateTime,
      })) || [];

      logger.info(`Fetched ${objects.length} tasks from Microsoft To-Do`);
      return { objects };
    } catch (error) {
      logger.error(error, 'Failed to fetch from Microsoft To-Do');
      throw error;
    }
  }

  async pushChanges(
    integration: Integration,
    config: { list_id: string },
    changes: TransformedChangeSet,
  ): Promise<PushResult> {
    const accessToken = this.encryptionService.decrypt(integration.oauth_access_token || '');
    const result: PushResult = { success: true, created: 0, updated: 0, deleted: 0, errors: [] };

    try {
      for (const obj of changes.toCreate) {
        try {
          await axios.post(
            `https://graph.microsoft.com/v1.0/me/todo/lists/${config.list_id}/tasks`,
            {
              title: obj.title,
              body: { content: obj.body, contentType: 'text' },
              dueDateTime: obj.dueDateTime,
              importance: obj.importance,
            },
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          result.created = (result.created || 0) + 1;
        } catch (error: any) {
          result.errors?.push({ id: String(obj.id || 'unknown'), error: error.message });
        }
      }
      logger.info(`Pushed changes to Microsoft To-Do`);
    } catch (error) {
      logger.error(error, 'Failed to push changes to Microsoft To-Do');
      result.success = false;
    }
    return result;
  }
}
