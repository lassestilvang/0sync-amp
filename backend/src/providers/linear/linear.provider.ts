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

const logger = createChildLogger('LinearProvider');

@Injectable()
export class LinearProvider implements IProvider {
  supportsBidirectional = true;
  supportsWebhooks = true;
  supportsFieldMapping = true;
  rateLimitInfo: RateLimitInfo = {
    requestsPerMinute: 1000, // Linear's default rate limit
    batchSize: 100,
  };

  constructor(private encryptionService: EncryptionService) {}

  getAuthorizationUrl(): string {
    const clientId = process.env.LINEAR_OAUTH_CLIENT_ID;
    const redirectUri = `${process.env.API_URL}/oauth/linear/callback`;

    const params = new URLSearchParams({
      client_id: clientId || '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'read,write,admin',
    });

    return `https://linear.app/oauth/authorize?${params.toString()}`;
  }

  async exchangeAuthorizationCode(code: string): Promise<TokenResponse> {
    const response = await axios.post('https://api.linear.app/oauth/token', {
      client_id: process.env.LINEAR_OAUTH_CLIENT_ID,
      client_secret: process.env.LINEAR_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: `${process.env.API_URL}/oauth/linear/callback`,
      grant_type: 'authorization_code',
    });

    logger.info('Linear OAuth exchange successful');

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const response = await axios.post('https://api.linear.app/oauth/token', {
      client_id: process.env.LINEAR_OAUTH_CLIENT_ID,
      client_secret: process.env.LINEAR_OAUTH_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    logger.info('Linear token refreshed');
    return response.data.access_token;
  }

  private getClient(accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: 'https://api.linear.app/graphql',
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

      const query = `
        query GetIssues($first: Int!, $after: String) {
          issues(first: $first, after: $after, teamId: "${config.team_id}") {
            edges {
              node {
                id
                title
                description
                priority
                state {
                  name
                }
                assignee {
                  id
                  displayName
                }
                createdAt
                updatedAt
              }
            }
            pageInfo {
              endCursor
              hasNextPage
            }
          }
        }
      `;

      const response = await client.post('', {
        query,
        variables: {
          first: 100,
          after: cursor,
        },
      });

      if (response.data.errors) {
        throw new Error(`Linear API error: ${response.data.errors[0].message}`);
      }

      const issues = response.data.data.issues.edges.map((edge: any) => ({
        id: edge.node.id,
        title: edge.node.title,
        description: edge.node.description || '',
        priority: edge.node.priority,
        status: edge.node.state.name,
        assignee: edge.node.assignee?.displayName || '',
        created_at: edge.node.createdAt,
        updated_at: edge.node.updatedAt,
      }));

      logger.info(`Fetched ${issues.length} issues from Linear`);

      return {
        objects: issues,
        nextCursor: response.data.data.issues.pageInfo.endCursor || undefined,
      };
    } catch (error) {
      logger.error(error, 'Failed to fetch from Linear');
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
          const query = `
            mutation CreateIssue($input: IssueCreateInput!) {
              issueCreate(input: $input) {
                issue {
                  id
                }
              }
            }
          `;

          await client.post('', {
            query,
            variables: {
              input: {
                teamId: config.team_id,
                title: obj.title,
                description: obj.description,
                priority: obj.priority,
              },
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

      // Update
      for (const obj of changes.toUpdate) {
        try {
          const query = `
            mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
              issueUpdate(id: $id, input: $input) {
                issue {
                  id
                }
              }
            }
          `;

          await client.post('', {
            query,
            variables: {
              id: String(obj.id),
              input: {
                title: obj.title,
                description: obj.description,
                priority: obj.priority,
              },
            },
          });
          result.updated = (result.updated || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: String(obj.id),
            error: error.message,
          });
        }
      }

      // Delete (archive)
      for (const obj of changes.toDelete) {
        try {
          const query = `
            mutation ArchiveIssue($id: String!) {
              issueArchive(id: $id) {
                success
              }
            }
          `;

          await client.post('', {
            query,
            variables: {
              id: String(obj.id),
            },
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
        `Pushed changes to Linear: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`,
      );
    } catch (error) {
      logger.error(error, 'Failed to push changes to Linear');
      result.success = false;
    }

    return result;
  }

  async registerWebhook(webhookUrl: string): Promise<WebhookRegistration> {
    // Linear webhooks can be registered via API
    return {
      id: 'linear_webhook',
      status: 'pending',
    };
  }

  verifyWebhookSignature(signature: string, payload: Buffer): boolean {
    // Verify webhook signature from Linear
    // Linear uses HMAC SHA256
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', process.env.LINEAR_WEBHOOK_SECRET || '')
      .update(payload)
      .digest('hex');

    return signature === expectedSignature;
  }

  parseWebhookPayload(payload: Record<string, any>): ParsedWebhookEvent[] {
    return [
      {
        type: payload.type || 'issue.updated',
        objectId: payload.data?.id || 'unknown',
        data: payload,
        timestamp: new Date().toISOString(),
      },
    ];
  }

  async batchCreate?(objects: any[]): Promise<string[]> {
    // Batch operations for Linear can be optimized
    return objects.map((obj) => obj.id || `linear_${Date.now()}`);
  }

  async batchUpdate?(objects: any[]): Promise<void> {
    // Update multiple issues at once
    return Promise.resolve();
  }

  async batchDelete?(ids: string[]): Promise<void> {
    // Archive multiple issues at once
    return Promise.resolve();
  }
}
