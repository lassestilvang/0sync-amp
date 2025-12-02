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

const logger = createChildLogger('AppleRemindersProvider');

@Injectable()
export class AppleRemindersProvider implements IProvider {
  supportsBidirectional = true;
  supportsWebhooks = false;
  supportsFieldMapping = true;
  rateLimitInfo: RateLimitInfo = {
    requestsPerMinute: 1000,
    batchSize: 100,
  };

  constructor(private encryptionService: EncryptionService) {}

  /**
   * Apple Reminders integrates via CloudKit or local API
   * This implementation uses CloudKit for cloud-based reminders
   */
  getAuthorizationUrl(): string {
    const clientId = process.env.APPLE_OAUTH_CLIENT_ID;
    const redirectUri = `${process.env.API_URL}/oauth/apple-reminders/callback`;

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
    const response = await axios.post('https://appleid.apple.com/auth/token', {
      client_id: process.env.APPLE_OAUTH_CLIENT_ID,
      client_secret: process.env.APPLE_OAUTH_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${process.env.API_URL}/oauth/apple-reminders/callback`,
    });

    logger.info('Apple Reminders OAuth exchange successful');

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

    logger.info('Apple Reminders token refreshed');
    return response.data.access_token;
  }

  private getClient(accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: 'https://api.apple-cloudkit.com',
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

      /**
       * Query reminders from CloudKit
       * Records are filtered by list if configured
       */
      const listFilter =
        config.list_name ?
          [
            {
              fieldName: 'list',
              comparator: 'EQUALS',
              fieldValue: { value: config.list_name },
            },
          ]
        : [];

      const response = await client.post('/zones/default/records/query', {
        recordType: 'Reminder',
        sortBy: [{ fieldName: 'dueDate', ascending: true }],
        filterBy: listFilter,
        resultsLimit: 100,
        continuationMarker: cursor,
      });

      const reminders = response.data.records.map((record: any) => ({
        id: record.recordName,
        title: record.fields.title?.value || 'Untitled',
        description: record.fields.notes?.value || '',
        dueDate: record.fields.dueDate?.value || '',
        dueTime: record.fields.dueTime?.value || '',
        isCompleted: record.fields.isCompleted?.value || false,
        priority: record.fields.priority?.value || 0,
        list: record.fields.list?.value || 'Reminders',
        url: record.fields.url?.value || '',
        created_at: new Date(record.created.timestamp).toISOString(),
        updated_at: new Date(record.lastModifiedDate.timestamp).toISOString(),
      }));

      logger.info(`Fetched ${reminders.length} reminders from Apple Reminders`);

      return {
        objects: reminders,
        nextCursor: response.data.continuationMarker,
      };
    } catch (error) {
      logger.error(error, 'Failed to fetch from Apple Reminders');
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
          await client.post('/zones/default/records/create', {
            records: [
              {
                recordType: 'Reminder',
                fields: {
                  title: { value: obj.title },
                  notes: { value: obj.description || '' },
                  dueDate: { value: obj.dueDate || '' },
                  dueTime: { value: obj.dueTime || '' },
                  isCompleted: { value: obj.isCompleted || false },
                  priority: { value: obj.priority || 0 },
                  list: { value: config.list_name || 'Reminders' },
                  url: { value: obj.url || '' },
                },
              },
            ],
          });
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
          await client.post('/zones/default/records/update', {
            records: [
              {
                recordName: obj.id,
                recordType: 'Reminder',
                fields: {
                  title: { value: obj.title },
                  notes: { value: obj.description || '' },
                  dueDate: { value: obj.dueDate || '' },
                  dueTime: { value: obj.dueTime || '' },
                  isCompleted: { value: obj.isCompleted || false },
                  priority: { value: obj.priority || 0 },
                  url: { value: obj.url || '' },
                },
              },
            ],
          });
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
          await client.post('/zones/default/records/delete', {
            records: [
              {
                recordName: obj.id,
                recordType: 'Reminder',
              },
            ],
          });
          result.deleted = (result.deleted || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: String(obj.id),
            error: error.message,
          });
        }
      }

      logger.info(
        `Pushed changes to Apple Reminders: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`,
      );
    } catch (error) {
      logger.error(error, 'Failed to push changes to Apple Reminders');
      result.success = false;
    }

    return result;
  }

  async registerWebhook(webhookUrl: string): Promise<WebhookRegistration> {
    return {
      id: 'apple_reminders_webhook',
      status: 'pending',
    };
  }

  verifyWebhookSignature(signature: string, payload: Buffer): boolean {
    return true;
  }

  parseWebhookPayload(payload: Record<string, any>): ParsedWebhookEvent[] {
    return [
      {
        type: 'reminder.updated',
        objectId: payload.recordName || 'unknown',
        data: payload,
        timestamp: new Date().toISOString(),
      },
    ];
  }
}
