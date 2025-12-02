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

const logger = createChildLogger('JiraProvider');

@Injectable()
export class JiraProvider implements IProvider {
  supportsBidirectional = true;
  supportsWebhooks = true;
  supportsFieldMapping = true;
  rateLimitInfo: RateLimitInfo = {
    requestsPerMinute: 180, // Jira cloud rate limit
    batchSize: 50,
  };

  constructor(private encryptionService: EncryptionService) {}

  getAuthorizationUrl(): string {
    const clientId = process.env.JIRA_OAUTH_CLIENT_ID;
    const redirectUri = `${process.env.API_URL}/oauth/jira/callback`;

    const params = new URLSearchParams({
      client_id: clientId || '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'read:jira-work write:jira-work manage:jira-webhook',
    });

    return `https://auth.atlassian.com/authorize?${params.toString()}`;
  }

  async exchangeAuthorizationCode(code: string): Promise<TokenResponse> {
    const response = await axios.post('https://auth.atlassian.com/oauth/token', {
      client_id: process.env.JIRA_OAUTH_CLIENT_ID,
      client_secret: process.env.JIRA_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: `${process.env.API_URL}/oauth/jira/callback`,
      grant_type: 'authorization_code',
    });

    logger.info('Jira OAuth exchange successful');

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const response = await axios.post('https://auth.atlassian.com/oauth/token', {
      client_id: process.env.JIRA_OAUTH_CLIENT_ID,
      client_secret: process.env.JIRA_OAUTH_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    logger.info('Jira token refreshed');
    return response.data.access_token;
  }

  private getClient(accessToken: string, instanceUrl: string): AxiosInstance {
    return axios.create({
      baseURL: `${instanceUrl}/rest/api/3`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async fetch(
    integration: Integration,
    config: Record<string, unknown>,
    cursor?: string,
  ): Promise<FetchResult> {
    try {
      const accessToken = this.encryptionService.decrypt(
        integration.oauth_access_token || '',
      );

      const cloudId =
        (config.cloud_id as string) ||
        (integration.additional_config as Record<string, unknown>)?.cloud_id;
      const instanceUrl = `https://api.atlassian.com/site/${cloudId}/rest/api/3`;

      const client = axios.create({
        baseURL: instanceUrl,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const startAt = cursor ? parseInt(cursor, 10) : 0;

      const response = await client.get('/search', {
        params: {
          jql:
            (config.jql as string) ||
            `project = ${config.project_key as string}`,
          startAt,
          maxResults: 100,
          expand: 'changelog',
        },
      });

      const issues = (response.data.issues as Array<Record<string, unknown>>).map(
        (issue) => ({
          id: issue.key as string,
          title: (issue.fields as Record<string, unknown>)?.summary as string,
          description:
            ((issue.fields as Record<string, unknown>)?.description as string) ||
            '',
          status:
            (
              (issue.fields as Record<string, unknown>)?.status as Record<
                string,
                unknown
              >
            )?.name || 'Unknown',
          priority:
            (
              (issue.fields as Record<string, unknown>)?.priority as Record<
                string,
                unknown
              >
            )?.name || 'Medium',
          assignee:
            (
              (issue.fields as Record<string, unknown>)?.assignee as Record<
                string,
                unknown
              >
            )?.displayName || '',
          labels:
            ((issue.fields as Record<string, unknown>)?.labels as string[]) ||
            [],
          created_at: (
            issue.fields as Record<string, unknown>
          )?.created as string,
          updated_at: (
            issue.fields as Record<string, unknown>
          )?.updated as string,
        }),
      );

      const nextCursor =
        startAt +
          (response.data.issues as Array<Record<string, unknown>>).length <
        (response.data.total as number)
          ? String(
              startAt +
                (response.data.issues as Array<Record<string, unknown>>).length,
            )
          : undefined;

      logger.info(`Fetched ${issues.length} issues from Jira`);

      return {
        objects: issues,
        nextCursor,
      };
    } catch (error) {
      logger.error(error, 'Failed to fetch from Jira');
      throw error;
    }
  }

  async pushChanges(
    integration: Integration,
    config: Record<string, unknown>,
    changes: TransformedChangeSet,
  ): Promise<PushResult> {
    const accessToken = this.encryptionService.decrypt(
      integration.oauth_access_token || '',
    );

    const cloudId =
      (config.cloud_id as string) ||
      (integration.additional_config as Record<string, unknown>)?.cloud_id;
    const instanceUrl = `https://api.atlassian.com/site/${cloudId}/rest/api/3`;

    const client = axios.create({
      baseURL: instanceUrl,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

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
          await client.post('/issues', {
            fields: {
              project: { key: config.project_key as string },
              summary: obj.title,
              description: {
                version: 3,
                type: 'doc',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        type: 'text',
                        text: obj.description || '',
                      },
                    ],
                  },
                ],
              },
              priority: { name: obj.priority || 'Medium' },
              labels: obj.labels || [],
            },
          });
          result.created = (result.created || 0) + 1;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          result.errors?.push({
            id: String(obj.id || 'unknown'),
            error: errorMessage,
          });
        }
      }

      // Update
      for (const obj of changes.toUpdate) {
        try {
          await client.put(`/issues/${obj.id}`, {
            fields: {
              summary: obj.title,
              description: {
                version: 3,
                type: 'doc',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {
                        type: 'text',
                        text: obj.description || '',
                      },
                    ],
                  },
                ],
              },
              priority: { name: obj.priority || 'Medium' },
              labels: obj.labels || [],
            },
          });
          result.updated = (result.updated || 0) + 1;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          result.errors?.push({
            id: String(obj.id),
            error: errorMessage,
          });
        }
      }

      // Delete (transition to closed)
      for (const obj of changes.toDelete) {
        try {
          await client.post(`/issues/${obj.id}/transitions`, {
            transition: {
              id: (config.close_transition_id as string) || '10000',
            },
          });
          result.deleted = (result.deleted || 0) + 1;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          result.errors?.push({
            id: String(obj.id),
            error: errorMessage,
          });
        }
      }

      logger.info(
        `Pushed changes to Jira: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`,
      );
    } catch (error) {
      logger.error(error, 'Failed to push changes to Jira');
      result.success = false;
    }

    return result;
  }

  async registerWebhook(_webhookUrl: string): Promise<WebhookRegistration> {
    return {
      id: 'jira_webhook',
      status: 'pending',
    };
  }

  verifyWebhookSignature(signature: string, payload: Buffer): boolean {
    // Jira uses HMAC SHA256 for webhook verification
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', process.env.JIRA_WEBHOOK_SECRET || '')
      .update(payload)
      .digest('base64');

    return signature === expectedSignature;
  }

  parseWebhookPayload(
    payload: Record<string, unknown>,
  ): ParsedWebhookEvent[] {
    return [
      {
        type: (payload.webhookEvent as string) || 'jira:issue_updated',
        objectId:
          ((payload.issue as Record<string, unknown>)?.key as string) ||
          'unknown',
        data: payload,
        timestamp: (payload.timestamp as string | undefined)
          ? new Date(payload.timestamp as string).toISOString()
          : new Date().toISOString(),
      },
    ];
  }
}
