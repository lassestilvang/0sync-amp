import { Injectable } from '@nestjs/common';
import { Client } from '@notionhq/client';
import axios from 'axios';
import * as crypto from 'crypto';
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

const logger = createChildLogger('NotionProvider');

@Injectable()
export class NotionProvider implements IProvider {
  supportsBidirectional = true;
  supportsWebhooks = true;
  supportsFieldMapping = true;
  rateLimitInfo: RateLimitInfo = {
    requestsPerMinute: 120,
    batchSize: 100,
  };

  constructor(private encryptionService: EncryptionService) {}

  getAuthorizationUrl(): string {
    const clientId = process.env.NOTION_OAUTH_CLIENT_ID;
    const redirectUri = `${process.env.API_URL}/oauth/notion/callback`;

    const params = new URLSearchParams({
      client_id: clientId || '',
      redirect_uri: redirectUri,
      response_type: 'code',
      owner: 'user',
    });

    return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
  }

  async exchangeAuthorizationCode(code: string): Promise<TokenResponse> {
    const response = await axios.post('https://api.notion.com/v1/oauth/token', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${process.env.API_URL}/oauth/notion/callback`,
      client_id: process.env.NOTION_OAUTH_CLIENT_ID,
      client_secret: process.env.NOTION_OAUTH_CLIENT_SECRET,
    });

    logger.info('Notion OAuth exchange successful');

    return {
      accessToken: response.data.access_token,
      // Notion doesn't provide refresh tokens for OAuth
      expiresIn: response.data.expires_in || 3600,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    // Notion OAuth doesn't support refresh tokens
    // Token validity depends on the integration configuration
    throw new Error('Notion OAuth does not support token refresh');
  }

  async fetch(
    integration: Integration,
    config: { database_id: string; filter?: any },
    cursor?: string,
  ): Promise<FetchResult> {
    try {
      const accessToken = this.encryptionService.decrypt(
        integration.oauth_access_token || '',
      );

      const client = new Client({ auth: accessToken });

      const response = await client.databases.query({
        database_id: config.database_id,
        filter: config.filter,
        start_cursor: cursor,
        page_size: 100,
      });

      const objects = response.results.map((page: any) => ({
        id: page.id,
        title: this.extractTitle(page.properties),
        properties: page.properties,
        created_at: page.created_time,
        updated_at: page.last_edited_time,
        archived: page.archived,
      }));

      logger.info(`Fetched ${objects.length} items from Notion database`);

      return {
        objects,
        nextCursor: response.next_cursor || undefined,
      };
    } catch (error) {
      logger.error(error, 'Failed to fetch from Notion');
      throw error;
    }
  }

  async pushChanges(
    integration: Integration,
    config: { database_id: string },
    changes: TransformedChangeSet,
  ): Promise<PushResult> {
    const accessToken = this.encryptionService.decrypt(
      integration.oauth_access_token || '',
    );

    const client = new Client({ auth: accessToken });

    const result: PushResult = {
      success: true,
      created: 0,
      updated: 0,
      deleted: 0,
      errors: [],
    };

    try {
      // Create new pages
      for (const obj of changes.toCreate) {
        try {
          await client.pages.create({
            parent: { database_id: config.database_id },
            properties: this.transformToNotionProperties(obj),
          });
          result.created = (result.created || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: obj.id || 'unknown',
            error: error.message,
          });
        }
      }

      // Update existing pages
      for (const obj of changes.toUpdate) {
        try {
          await client.pages.update({
            page_id: obj.id,
            properties: this.transformToNotionProperties(obj),
          });
          result.updated = (result.updated || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: obj.id,
            error: error.message,
          });
        }
      }

      // Delete (archive) pages
      for (const obj of changes.toDelete) {
        try {
          await client.pages.update({
            page_id: obj.id,
            archived: true,
          });
          result.deleted = (result.deleted || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: obj.id,
            error: error.message,
          });
        }
      }

      logger.info(`Pushed changes to Notion: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`);
    } catch (error) {
      logger.error(error, 'Failed to push changes to Notion');
      result.success = false;
    }

    return result;
  }

  registerWebhook(webhookUrl: string): Promise<WebhookRegistration> {
    // Notion webhooks not yet available in public API
    // Return pending status
    return Promise.resolve({
      id: 'notion_webhook',
      status: 'pending',
    });
  }

  verifyWebhookSignature(signature: string, payload: Buffer): boolean {
    // Implement when Notion webhooks available
    return true;
  }

  parseWebhookPayload(payload: Record<string, any>): ParsedWebhookEvent[] {
    // Implement when Notion webhooks available
    return [];
  }

  private extractTitle(properties: Record<string, any>): string {
    for (const [key, prop] of Object.entries(properties)) {
      if (prop.type === 'title' && (prop as any).title?.[0]) {
        return (prop as any).title[0].plain_text;
      }
    }
    return '';
  }

  private transformToNotionProperties(obj: any): Record<string, any> {
    const props: Record<string, any> = {};

    if (obj.title) {
      props.Name = {
        title: [{ text: { content: obj.title } }],
      };
    }

    // Handle other properties based on config
    if (obj.description) {
      props.Description = {
        rich_text: [{ text: { content: obj.description } }],
      };
    }

    if (obj.status) {
      props.Status = {
        select: { name: obj.status },
      };
    }

    return props;
  }
}
