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

const logger = createChildLogger('OutlookMailProvider');

@Injectable()
export class OutlookMailProvider implements IProvider {
  supportsBidirectional = false; // Mail is primarily read-only
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
      scope: 'Mail.ReadWrite offline_access',
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
      scope: 'Mail.ReadWrite offline_access',
    });

    logger.info('Microsoft OAuth exchange successful for Outlook Mail');

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
      scope: 'Mail.ReadWrite offline_access',
    });

    logger.info('Outlook Mail token refreshed');
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
    config: { folder?: string; filter?: string },
    cursor?: string,
  ): Promise<FetchResult> {
    try {
      const accessToken = this.encryptionService.decrypt(
        integration.oauth_access_token || '',
      );

      const client = this.getClient(accessToken);
      const folder = config.folder || 'inbox';

      const response = await client.get(`/me/mailFolders/${folder}/messages`, {
        params: {
          $top: 100,
          $skip: cursor ? parseInt(cursor) : 0,
          $filter: config.filter || "isRead eq false",
        },
      });

      const objects = (response.data.value || []).map((message: any) => ({
        id: message.id,
        subject: message.subject,
        from: message.from?.emailAddress?.address,
        to: message.toRecipients?.map((r: any) => r.emailAddress?.address) || [],
        bodyPreview: message.bodyPreview,
        body: message.body?.content,
        receivedDateTime: message.receivedDateTime,
        sentDateTime: message.sentDateTime,
        isRead: message.isRead,
        hasAttachments: message.hasAttachments,
        categories: message.categories || [],
        importance: message.importance,
        updated_at: message.lastModifiedDateTime,
      }));

      logger.info(`Fetched ${objects.length} messages from Outlook Mail`);

      return {
        objects,
        nextCursor: cursor ? String(parseInt(cursor) + 100) : undefined,
      };
    } catch (error) {
      logger.error(error, 'Failed to fetch from Outlook Mail');
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
      // Create/Send new messages
      for (const obj of changes.toCreate) {
        try {
          await client.post('/me/sendMail', {
            message: {
              subject: obj.subject,
              body: {
                contentType: 'HTML',
                content: obj.body || obj.bodyPreview || '',
              },
              toRecipients: ((obj.to as any) || []).map((email: string) => ({
                emailAddress: {
                  address: email,
                },
              })),
              ccRecipients: ((obj.cc as any) || []).map((email: string) => ({
                emailAddress: {
                  address: email,
                },
              })),
              importance: obj.importance || 'normal',
              categories: obj.categories || [],
            },
          });
          result.created = (result.created || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: String(obj.id || 'unknown'),
            error: error.message,
          });
        }
      }

      // Updates: Mark as read/unread or update categories
      for (const obj of changes.toUpdate) {
        try {
          const updatePayload: Record<string, any> = {};
          if (obj.isRead !== undefined) updatePayload.isRead = obj.isRead;
          if (obj.categories) updatePayload.categories = obj.categories;
          if (obj.importance) updatePayload.importance = obj.importance;

          if (Object.keys(updatePayload).length > 0) {
            await client.patch(`/me/messages/${obj.id}`, updatePayload);
            result.updated = (result.updated || 0) + 1;
          }
        } catch (error: any) {
          result.errors?.push({
            id: String(obj.id || 'unknown'),
            error: error.message,
          });
        }
        }

        // Delete messages
        for (const obj of changes.toDelete) {
        try {
          await client.delete(`/me/messages/${obj.id}`);
          result.deleted = (result.deleted || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: String(obj.id || 'unknown'),
            error: error.message,
          });
        }
        }

      logger.info(
        `Pushed changes to Outlook Mail: ${result.created} sent, ${result.updated} updated, ${result.deleted} deleted`,
      );
    } catch (error) {
      logger.error(error, 'Failed to push changes to Outlook Mail');
      result.success = false;
    }

    return result;
  }

  async registerWebhook(webhookUrl: string): Promise<WebhookRegistration> {
    return Promise.resolve({
      id: 'outlook_mail_webhook',
      status: 'pending',
    });
  }

  verifyWebhookSignature(signature: string, payload: Buffer): boolean {
    return true;
  }

  parseWebhookPayload(payload: Record<string, any>): ParsedWebhookEvent[] {
    return payload.value?.map((item: any) => ({
      type: 'message_received',
      objectId: item.resourceData?.id || 'unknown',
      data: item,
      timestamp: new Date().toISOString(),
    })) || [];
  }
}
