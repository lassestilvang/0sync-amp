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

const logger = createChildLogger('GoogleCalendarProvider');

@Injectable()
export class GoogleCalendarProvider implements IProvider {
  supportsBidirectional = true;
  supportsWebhooks = true;
  supportsFieldMapping = true;
  rateLimitInfo: RateLimitInfo = {
    requestsPerMinute: 1000,
    batchSize: 100,
  };

  constructor(private encryptionService: EncryptionService) {}

  getAuthorizationUrl(): string {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const redirectUri = `${process.env.API_URL}/oauth/google/callback`;

    const params = new URLSearchParams({
      client_id: clientId || '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar',
      access_type: 'offline',
      prompt: 'consent',
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

    logger.info('Google token refreshed');
    return response.data.access_token;
  }

  private getClient(accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: 'https://www.googleapis.com/calendar/v3',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async fetch(
    integration: Integration,
    config: { calendar_id: string; sync_token?: string },
    cursor?: string,
  ): Promise<FetchResult> {
    try {
      const accessToken = this.encryptionService.decrypt(
        integration.oauth_access_token || '',
      );

      const client = this.getClient(accessToken);

      const params: any = {
        maxResults: 100,
      };

      if (cursor) {
        params.syncToken = cursor;
      }

      const response = await client.get(`/calendars/${config.calendar_id}/events`, {
        params,
      });

      const objects = response.data.items?.map((event: any) => ({
        id: event.id,
        title: event.summary,
        description: event.description,
        start: event.start,
        end: event.end,
        attendees: event.attendees,
        location: event.location,
        created: event.created,
        updated: event.updated,
      })) || [];

      logger.info(`Fetched ${objects.length} events from Google Calendar`);

      return {
        objects,
        nextCursor: response.data.nextSyncToken,
      };
    } catch (error) {
      logger.error(error, 'Failed to fetch from Google Calendar');
      throw error;
    }
  }

  async pushChanges(
    integration: Integration,
    config: { calendar_id: string },
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
      // Create events
      for (const obj of changes.toCreate) {
        try {
          await client.post(`/calendars/${config.calendar_id}/events`, {
            summary: obj.title,
            description: obj.description,
            start: obj.start,
            end: obj.end,
            attendees: obj.attendees,
            location: obj.location,
          });
          result.created = (result.created || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: String(obj.id || 'unknown'),
            error: error.message,
          });
        }
      }

      // Update events
      for (const obj of changes.toUpdate) {
        try {
          await client.put(`/calendars/${config.calendar_id}/events/${obj.id}`, {
            summary: obj.title,
            description: obj.description,
            start: obj.start,
            end: obj.end,
            attendees: obj.attendees,
            location: obj.location,
          });
          result.updated = (result.updated || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: String(obj.id),
            error: error.message,
          });
        }
      }

      // Delete events
      for (const obj of changes.toDelete) {
        try {
          await client.delete(`/calendars/${config.calendar_id}/events/${obj.id}`);
          result.deleted = (result.deleted || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: String(obj.id),
            error: error.message,
          });
        }
      }

      logger.info(`Pushed changes to Google Calendar: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`);
    } catch (error) {
      logger.error(error, 'Failed to push changes to Google Calendar');
      result.success = false;
    }

    return result;
  }

  registerWebhook(webhookUrl: string): Promise<WebhookRegistration> {
    // TODO: Google Calendar webhook registration
    return Promise.resolve({
      id: 'google_calendar_webhook',
      status: 'pending',
    });
  }

  verifyWebhookSignature(signature: string, payload: Buffer): boolean {
    // Google uses different signature verification
    return true;
  }

  parseWebhookPayload(payload: Record<string, any>): ParsedWebhookEvent[] {
    // Parse Google Calendar webhook payload
    return [];
  }
}
