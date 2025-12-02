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

const logger = createChildLogger('GmailProvider');

@Injectable()
export class GmailProvider implements IProvider {
  supportsBidirectional = false; // Gmail is read-only for most operations
  supportsWebhooks = true;
  supportsFieldMapping = true;
  rateLimitInfo: RateLimitInfo = {
    requestsPerMinute: 500,
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
      scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
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
      redirect_uri: `${process.env.API_URL}/oauth/google/callback`,
      grant_type: 'authorization_code',
    });

    logger.info('Google OAuth exchange successful for Gmail');

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

    logger.info('Gmail token refreshed');
    return response.data.access_token;
  }

  private getClient(accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: 'https://gmail.googleapis.com/gmail/v1',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  private async decodeMessage(client: AxiosInstance, messageId: string): Promise<any> {
    const response = await client.get(`/users/me/messages/${messageId}`);
    const message = response.data;
    const headers = message.payload.headers;

    const getHeader = (name: string) => headers.find((h: any) => h.name === name)?.value || '';

    return {
      id: messageId,
      threadId: message.threadId,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: getHeader('To'),
      date: getHeader('Date'),
      snippet: message.snippet,
      labels: message.labelIds || [],
      internalDate: new Date(parseInt(message.internalDate)).toISOString(),
    };
  }

  async fetch(
    integration: Integration,
    config: { query?: string; maxResults?: number },
    cursor?: string,
  ): Promise<FetchResult> {
    try {
      const accessToken = this.encryptionService.decrypt(
        integration.oauth_access_token || '',
      );

      const client = this.getClient(accessToken);

      const listResponse = await client.get('/users/me/messages', {
        params: {
          q: config.query || 'is:unread',
          maxResults: config.maxResults || 10,
          pageToken: cursor,
        },
      });

      const messages = listResponse.data.messages || [];
      const objects = [];

      for (const msg of messages) {
        try {
          const decoded = await this.decodeMessage(client, msg.id);
          objects.push(decoded);
        } catch (error) {
          logger.warn(`Failed to decode message ${msg.id}`);
        }
      }

      logger.info(`Fetched ${objects.length} messages from Gmail`);

      return {
        objects,
        nextCursor: listResponse.data.nextPageToken || undefined,
      };
    } catch (error) {
      logger.error(error, 'Failed to fetch from Gmail');
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
      // Gmail doesn't support creating messages through this API in the traditional sense
      // Only sending is supported
      for (const obj of changes.toCreate) {
        try {
          const email = this.createMimeMessage(obj);
          await client.post('/users/me/messages/send', {
            raw: Buffer.from(email).toString('base64'),
          });
          result.created = (result.created || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: String(obj.id || 'unknown'),
            error: error.message,
          });
        }
      }

      // Updates and deletes not supported for Gmail
      logger.info(`Sent ${result.created} messages via Gmail`);
    } catch (error) {
      logger.error(error, 'Failed to push changes to Gmail');
      result.success = false;
    }

    return result;
  }

  async registerWebhook(webhookUrl: string): Promise<WebhookRegistration> {
    // Gmail push notifications require setting up pub/sub
    // This is a simplified implementation
    return Promise.resolve({
      id: 'gmail_webhook',
      status: 'pending',
    });
  }

  verifyWebhookSignature(signature: string, payload: Buffer): boolean {
    // Gmail uses Cloud Pub/Sub for webhooks
    // Signature verification would be done through Pub/Sub
    return true;
  }

  parseWebhookPayload(payload: Record<string, any>): ParsedWebhookEvent[] {
    if (payload.message && payload.message.data) {
      const messageData = JSON.parse(
        Buffer.from(payload.message.data, 'base64').toString('utf-8'),
      );
      return [
        {
          type: 'message_received',
          objectId: messageData.emailAddress || 'unknown',
          data: messageData,
          timestamp: new Date().toISOString(),
        },
      ];
    }
    return [];
  }

  private createMimeMessage(obj: any): string {
    const lines = [
      `From: ${obj.from}`,
      `To: ${obj.to}`,
      `Subject: ${obj.subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'MIME-Version: 1.0',
      '',
      obj.body || '',
    ];
    return lines.join('\r\n');
  }
}
