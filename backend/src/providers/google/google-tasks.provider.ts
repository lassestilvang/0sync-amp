import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { Integration } from '../../modules/integrations/entities/integration.entity';
import { IProvider, FetchResult, TokenResponse, PushResult, TransformedChangeSet, RateLimitInfo } from '../provider.interface';
import { createChildLogger } from '../../common/logger';
import { EncryptionService } from '../../common/services/encryption.service';

const logger = createChildLogger('GoogleTasksProvider');

@Injectable()
export class GoogleTasksProvider implements IProvider {
  supportsBidirectional = true;
  supportsWebhooks = false;
  supportsFieldMapping = true;
  rateLimitInfo: RateLimitInfo = { requestsPerMinute: 1000, batchSize: 100 };

  constructor(private encryptionService: EncryptionService) {}

  getAuthorizationUrl(): string {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
      redirect_uri: `${process.env.API_URL}/oauth/google/callback`,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/tasks',
      access_type: 'offline',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeAuthorizationCode(code: string): Promise<TokenResponse> {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.API_URL}/oauth/google/callback`,
    });
    logger.info('Google OAuth exchange successful');
    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });
    return response.data.access_token;
  }

  async fetch(
    integration: Integration,
    config: { tasklist_id: string },
    cursor?: string,
  ): Promise<FetchResult> {
    try {
      const accessToken = this.encryptionService.decrypt(integration.oauth_access_token || '');
      const response = await axios.get(
        `https://www.googleapis.com/tasks/v1/lists/${config.tasklist_id}/tasks`,
        { headers: { Authorization: `Bearer ${accessToken}` }, params: { maxResults: 100 } }
      );

      const objects = response.data.items?.map((task: any) => ({
        id: task.id,
        title: task.title,
        notes: task.notes,
        completed: task.status === 'completed',
        due: task.due,
        parent: task.parent,
        position: task.position,
        updated: task.updated,
      })) || [];

      logger.info(`Fetched ${objects.length} tasks from Google Tasks`);
      return { objects, nextCursor: response.data.nextPageToken };
    } catch (error) {
      logger.error(error, 'Failed to fetch from Google Tasks');
      throw error;
    }
  }

  async pushChanges(
    integration: Integration,
    config: { tasklist_id: string },
    changes: TransformedChangeSet,
  ): Promise<PushResult> {
    const accessToken = this.encryptionService.decrypt(integration.oauth_access_token || '');
    const result: PushResult = { success: true, created: 0, updated: 0, deleted: 0, errors: [] };

    try {
      for (const obj of changes.toCreate) {
        try {
          await axios.post(
            `https://www.googleapis.com/tasks/v1/lists/${config.tasklist_id}/tasks`,
            { title: obj.title, notes: obj.notes, due: obj.due },
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          result.created = (result.created || 0) + 1;
        } catch (error: any) {
          result.errors?.push({ id: String(obj.id || 'unknown'), error: error.message });
        }
      }
      logger.info(`Pushed changes to Google Tasks`);
    } catch (error) {
      logger.error(error, 'Failed to push changes to Google Tasks');
      result.success = false;
    }
    return result;
  }
}
