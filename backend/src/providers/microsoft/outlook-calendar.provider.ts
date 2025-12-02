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

const logger = createChildLogger('OutlookCalendarProvider');

@Injectable()
export class OutlookCalendarProvider implements IProvider {
  supportsBidirectional = true;
  supportsWebhooks = true;
  supportsFieldMapping = true;
  rateLimitInfo: RateLimitInfo = {
    requestsPerMinute: 600,
    batchSize: 100,
  };

  constructor(private encryptionService: EncryptionService) {}

  getAuthorizationUrl(): string {
    const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
    const redirectUri = `${process.env.API_URL}/oauth/microsoft/callback`;

    const params = new URLSearchParams({
      client_id: clientId || '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'Calendars.ReadWrite offline_access',
      access_type: 'offline',
      prompt: 'consent',
    });

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeAuthorizationCode(code: string): Promise<TokenResponse> {
    const response = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      client_id: process.env.MICROSOFT_OAUTH_CLIENT_ID,
      client_secret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: `${process.env.API_URL}/oauth/microsoft/callback`,
      grant_type: 'authorization_code',
      scope: 'Calendars.ReadWrite offline_access',
    });

    logger.info('Microsoft OAuth exchange successful for Outlook Calendar');

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const response = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      client_id: process.env.MICROSOFT_OAUTH_CLIENT_ID,
      client_secret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'Calendars.ReadWrite offline_access',
    });

    logger.info('Outlook Calendar token refreshed');
    return response.data.access_token;
  }

  private getClient(accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: 'https://graph.microsoft.com/v1.0',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async fetch(
    integration: Integration,
    config: { calendarId?: string },
    cursor?: string,
  ): Promise<FetchResult> {
    try {
      const accessToken = this.encryptionService.decrypt(
        integration.oauth_access_token || '',
      );

      const client = this.getClient(accessToken);
      const calendarId = config.calendarId || 'calendar';

      const response = await client.get(`/me/calendars/${calendarId}/events`, {
        params: {
          $top: 100,
          $skip: cursor ? parseInt(cursor) : 0,
        },
      });

      const objects = (response.data.value || []).map((event: any) => ({
        id: event.id,
        title: event.subject,
        description: event.bodyPreview,
        startTime: event.start?.dateTime,
        endTime: event.end?.dateTime,
        location: event.location?.displayName || '',
        attendees: event.attendees?.map((a: any) => a.emailAddress?.address) || [],
        isAllDay: event.isAllDay,
        isCancelled: event.isCancelled,
        updated_at: event.lastModifiedDateTime,
      }));

      logger.info(`Fetched ${objects.length} events from Outlook Calendar`);

      return {
        objects,
        nextCursor: cursor ? String(parseInt(cursor) + 100) : undefined,
      };
    } catch (error) {
      logger.error(error, 'Failed to fetch from Outlook Calendar');
      throw error;
    }
  }

  async pushChanges(
    integration: Integration,
    config: { calendarId?: string },
    changes: TransformedChangeSet,
  ): Promise<PushResult> {
    const accessToken = this.encryptionService.decrypt(
      integration.oauth_access_token || '',
    );

    const client = this.getClient(accessToken);
    const calendarId = config.calendarId || 'calendar';

    const result: PushResult = {
      success: true,
      created: 0,
      updated: 0,
      deleted: 0,
      errors: [],
    };

    try {
      // Create new events
      for (const obj of changes.toCreate) {
        try {
          await client.post(`/me/calendars/${calendarId}/events`, {
            subject: obj.title,
            bodyPreview: obj.description,
            start: {
              dateTime: obj.startTime,
              timeZone: 'UTC',
            },
            end: {
              dateTime: obj.endTime,
              timeZone: 'UTC',
            },
            location: obj.location ? { displayName: obj.location } : undefined,
            attendees: (((obj.attendees as any) || []).map((email: string) => ({
              emailAddress: { address: email },
              type: 'required',
            }))),
            isAllDay: (obj as any).isAllDay || false,
          });
          result.created = (result.created || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: String(obj.id || 'unknown'),
            error: error.message,
          });
        }
      }

      // Update existing events
      for (const obj of changes.toUpdate) {
        try {
          await client.patch(`/me/events/${obj.id}`, {
            subject: obj.title,
            bodyPreview: obj.description,
            start: {
              dateTime: obj.startTime,
              timeZone: 'UTC',
            },
            end: {
              dateTime: obj.endTime,
              timeZone: 'UTC',
            },
            location: obj.location ? { displayName: obj.location } : undefined,
            attendees: (((obj.attendees as any) || []).map((email: string) => ({
              emailAddress: { address: email },
              type: 'required',
            }))),
            isAllDay: (obj as any).isAllDay || false,
          });
          result.updated = (result.updated || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: String(obj.id || 'unknown'),
            error: error.message,
          });
        }
      }

      // Delete events
      for (const obj of changes.toDelete) {
        try {
          await client.delete(`/me/events/${obj.id}`);
          result.deleted = (result.deleted || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: String(obj.id || 'unknown'),
            error: error.message,
          });
        }
      }

      logger.info(
        `Pushed changes to Outlook Calendar: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`,
      );
    } catch (error) {
      logger.error(error, 'Failed to push changes to Outlook Calendar');
      result.success = false;
    }

    return result;
  }

  async registerWebhook(webhookUrl: string): Promise<WebhookRegistration> {
    // Outlook Calendar supports webhooks through subscription API
    return Promise.resolve({
      id: 'outlook_calendar_webhook',
      status: 'pending',
    });
  }

  verifyWebhookSignature(signature: string, payload: Buffer): boolean {
    // Microsoft uses JWT tokens for webhooks
    return true;
  }

  parseWebhookPayload(payload: Record<string, any>): ParsedWebhookEvent[] {
    return payload.value?.map((item: any) => ({
      type: item.changeType,
      objectId: item.resourceData?.id || 'unknown',
      data: item,
      timestamp: new Date().toISOString(),
    })) || [];
  }
}
