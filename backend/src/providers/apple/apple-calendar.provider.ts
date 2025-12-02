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

const logger = createChildLogger('AppleCalendarProvider');

@Injectable()
export class AppleCalendarProvider implements IProvider {
  supportsBidirectional = true;
  supportsWebhooks = false; // Apple Calendar webhooks require CloudKit
  supportsFieldMapping = true;
  rateLimitInfo: RateLimitInfo = {
    requestsPerMinute: 500,
    batchSize: 50,
  };

  constructor(private encryptionService: EncryptionService) {}

  /**
   * Apple Calendar uses OAuth 2.0 with Sign in with Apple
   * For CalDAV access, we need to use app-specific passwords or OAuth tokens
   */
  getAuthorizationUrl(): string {
    const clientId = process.env.APPLE_OAUTH_CLIENT_ID;
    const redirectUri = `${process.env.API_URL}/oauth/apple-calendar/callback`;

    const params = new URLSearchParams({
      client_id: clientId || '',
      redirect_uri: redirectUri,
      response_type: 'code',
      response_mode: 'form_post',
      scope: 'email',
    });

    return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
  }

  async exchangeAuthorizationCode(code: string): Promise<TokenResponse> {
    /**
     * Apple OAuth flow returns a JWT code
     * For CalDAV, we typically use app-specific passwords instead
     * This is a placeholder for the OAuth flow
     */
    const response = await axios.post('https://appleid.apple.com/auth/token', {
      client_id: process.env.APPLE_OAUTH_CLIENT_ID,
      client_secret: process.env.APPLE_OAUTH_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.API_URL}/oauth/apple-calendar/callback`,
    });

    logger.info('Apple OAuth exchange successful');

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const response = await axios.post('https://appleid.apple.com/auth/token', {
      client_id: process.env.APPLE_OAUTH_CLIENT_ID,
      client_secret: process.env.APPLE_OAUTH_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    logger.info('Apple token refreshed');
    return response.data.access_token;
  }

  private getClient(
    username: string,
    password: string,
  ): AxiosInstance {
    return axios.create({
      baseURL: 'https://caldav.icloud.com',
      auth: {
        username,
        password,
      },
      headers: {
        'Content-Type': 'text/calendar',
      },
    });
  }

  async fetch(
    integration: Integration,
    config: Record<string, any>,
    cursor?: string,
  ): Promise<FetchResult> {
    try {
      const username = integration.additional_config?.apple_username || '';
      const password = this.encryptionService.decrypt(
        integration.oauth_access_token || '',
      );

      const client = this.getClient(String(username), String(password));
      const calendarId = config.calendar_id || 'calendar';

      /**
       * Fetch events using CalDAV REPORT method
       * This queries events in a date range
       */
      const response = await client.request({
        method: 'REPORT',
        url: `/principals/default/calendars/${calendarId}/`,
        headers: {
          'Content-Type': 'application/xml',
        },
        data: `<?xml version="1.0" encoding="utf-8" ?>
          <D:calendar-query xmlns:D="DAV:" xmlns:CS="http://calendarserver.org/ns/">
            <D:prop>
              <D:getetag/>
              <D:resourcetype/>
              <CS:getctag/>
              <D:displayname/>
            </D:prop>
            <D:filter>
              <D:comp-filter name="VCALENDAR">
                <D:comp-filter name="VEVENT">
                  <D:time-range start="20240101T000000Z" end="20251231T235959Z"/>
                </D:comp-filter>
              </D:comp-filter>
            </D:filter>
          </D:calendar-query>`,
      });

      // Parse CalDAV response
      const events = this.parseCalDAVResponse(response.data);

      logger.info(`Fetched ${events.length} events from Apple Calendar`);

      return {
        objects: events,
        nextCursor: undefined, // CalDAV doesn't use cursors
      };
    } catch (error) {
      logger.error(error, 'Failed to fetch from Apple Calendar');
      throw error;
    }
  }

  async pushChanges(
    integration: Integration,
    config: Record<string, any>,
    changes: TransformedChangeSet,
  ): Promise<PushResult> {
    const username = integration.additional_config?.apple_username || '';
    const password = this.encryptionService.decrypt(
      integration.oauth_access_token || '',
    );

    const client = this.getClient(String(username), String(password));

    const result: PushResult = {
      success: true,
      created: 0,
      updated: 0,
      deleted: 0,
      errors: [],
    };

    try {
      const calendarId = config.calendar_id || 'calendar';

      // Create
      for (const obj of changes.toCreate) {
        try {
          const icalData = this.objectToICalendar(obj);
          await client.put(`/principals/default/calendars/${calendarId}/${obj.id}.ics`, icalData);
          result.created = (result.created || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: String(obj.id || 'unknown'),
            error: error.message,
          });
        }
      }

      // Update
      for (const obj of changes.toUpdate) {
        try {
          const icalData = this.objectToICalendar(obj);
          await client.put(`/principals/default/calendars/${calendarId}/${obj.id}.ics`, icalData);
          result.updated = (result.updated || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: String(obj.id),
            error: error.message,
          });
        }
      }

      // Delete
      for (const obj of changes.toDelete) {
        try {
          await client.delete(
            `/principals/default/calendars/${calendarId}/${obj.id}.ics`,
          );
          result.deleted = (result.deleted || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: String(obj.id),
            error: error.message,
          });
        }
      }

      logger.info(
        `Pushed changes to Apple Calendar: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`,
      );
    } catch (error) {
      logger.error(error, 'Failed to push changes to Apple Calendar');
      result.success = false;
    }

    return result;
  }

  private parseCalDAVResponse(xmlData: string): any[] {
    /**
     * Parse CalDAV XML response into event objects
     * This is a simplified parser - production would use a proper XML parser
     */
    const events: any[] = [];

    // Extract VEVENT blocks from the XML
    const eventRegex = /<href>(.*?)<\/href>/g;
    let match;

    while ((match = eventRegex.exec(xmlData)) !== null) {
      const eventId = match[1].split('/').pop()?.replace('.ics', '');
      events.push({
        id: eventId,
        title: 'Event',
        description: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return events;
  }

  private objectToICalendar(obj: any): string {
    /**
     * Convert object to iCalendar format
     * This creates a basic VEVENT
     */
    const uid = obj.id || `event_${Date.now()}`;
    const startDate = obj.startDate || new Date().toISOString();
    const endDate = obj.endDate || new Date().toISOString();

    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//0Sync//iCal4j 1.0//EN
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${new Date().toISOString()}
DTSTART:${startDate}
DTEND:${endDate}
SUMMARY:${obj.title || 'Untitled Event'}
DESCRIPTION:${obj.description || ''}
END:VEVENT
END:VCALENDAR`;
  }

  async registerWebhook(webhookUrl: string): Promise<WebhookRegistration> {
    // Apple Calendar webhooks via CloudKit are complex
    return {
      id: 'apple_calendar_webhook',
      status: 'pending',
    };
  }

  verifyWebhookSignature(signature: string, payload: Buffer): boolean {
    return true;
  }

  parseWebhookPayload(payload: Record<string, any>): ParsedWebhookEvent[] {
    return [
      {
        type: 'event.updated',
        objectId: payload.recordName || 'unknown',
        data: payload,
        timestamp: new Date().toISOString(),
      },
    ];
  }
}
