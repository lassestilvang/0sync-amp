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

const logger = createChildLogger('AppleNotesProvider');

@Injectable()
export class AppleNotesProvider implements IProvider {
  supportsBidirectional = true;
  supportsWebhooks = false;
  supportsFieldMapping = true;
  rateLimitInfo: RateLimitInfo = {
    requestsPerMinute: 1000,
    batchSize: 100,
  };

  constructor(private encryptionService: EncryptionService) {}

  /**
   * Apple Notes doesn't have a public API
   * This provider uses CloudKit JS or the iCloud Notes web interface
   * For production, this would need desktop/mobile automation or CloudKit integration
   */
  getAuthorizationUrl(): string {
    const clientId = process.env.APPLE_OAUTH_CLIENT_ID;
    const redirectUri = `${process.env.API_URL}/oauth/apple-notes/callback`;

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
      redirect_uri: `${process.env.API_URL}/oauth/apple-notes/callback`,
    });

    logger.info('Apple Notes OAuth exchange successful');

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

    logger.info('Apple Notes token refreshed');
    return response.data.access_token;
  }

  private getClient(accessToken: string): AxiosInstance {
    /**
     * Apple Notes can be accessed via CloudKit
     * This is a placeholder for the actual CloudKit API
     */
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
       * Query notes from CloudKit
       * This assumes CloudKit container and schema are configured
       */
      const response = await client.post('/zones/default/records/query', {
        recordType: 'Note',
        sortBy: [{ fieldName: 'modificationDate', ascending: false }],
        resultsLimit: 100,
        continuationMarker: cursor,
      });

      const notes = response.data.records.map((record: any) => ({
        id: record.recordName,
        title: record.fields.title?.value || 'Untitled',
        content: record.fields.content?.value || '',
        folder: record.fields.folder?.value || 'Default',
        isPinned: record.fields.isPinned?.value || false,
        color: record.fields.color?.value || 'default',
        created_at: new Date(record.created.timestamp).toISOString(),
        updated_at: new Date(record.lastModifiedDate.timestamp).toISOString(),
      }));

      logger.info(`Fetched ${notes.length} notes from Apple Notes`);

      return {
        objects: notes,
        nextCursor: response.data.continuationMarker,
      };
    } catch (error) {
      logger.error(error, 'Failed to fetch from Apple Notes');
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
                recordType: 'Note',
                fields: {
                  title: { value: obj.title },
                  content: { value: obj.content || obj.description },
                  folder: { value: config.folder_name || 'Default' },
                  isPinned: { value: obj.isPinned || false },
                  color: { value: obj.color || 'default' },
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
                recordType: 'Note',
                fields: {
                  title: { value: obj.title },
                  content: { value: obj.content || obj.description },
                  isPinned: { value: obj.isPinned || false },
                  color: { value: obj.color || 'default' },
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
                recordType: 'Note',
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
        `Pushed changes to Apple Notes: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`,
      );
    } catch (error) {
      logger.error(error, 'Failed to push changes to Apple Notes');
      result.success = false;
    }

    return result;
  }

  async registerWebhook(webhookUrl: string): Promise<WebhookRegistration> {
    return {
      id: 'apple_notes_webhook',
      status: 'pending',
    };
  }

  verifyWebhookSignature(signature: string, payload: Buffer): boolean {
    return true;
  }

  parseWebhookPayload(payload: Record<string, any>): ParsedWebhookEvent[] {
    return [
      {
        type: 'note.updated',
        objectId: payload.recordName || 'unknown',
        data: payload,
        timestamp: new Date().toISOString(),
      },
    ];
  }
}
