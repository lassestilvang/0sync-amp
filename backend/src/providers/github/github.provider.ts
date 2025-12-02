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

const logger = createChildLogger('GitHubProvider');

@Injectable()
export class GitHubProvider implements IProvider {
  supportsBidirectional = false; // GitHub is primarily read-only for issues
  supportsWebhooks = true;
  supportsFieldMapping = true;
  rateLimitInfo: RateLimitInfo = {
    requestsPerMinute: 60,
    batchSize: 100,
  };

  constructor(private encryptionService: EncryptionService) {}

  getAuthorizationUrl(): string {
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    const redirectUri = `${process.env.API_URL}/oauth/github/callback`;

    const params = new URLSearchParams({
      client_id: clientId || '',
      redirect_uri: redirectUri,
      scope: 'repo read:user',
      state: Math.random().toString(36).substring(7),
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeAuthorizationCode(code: string): Promise<TokenResponse> {
    const response = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
      client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
      code,
    });

    const params = new URLSearchParams(response.data);
    const accessToken = params.get('access_token');

    if (!accessToken) {
      throw new Error('Failed to exchange authorization code');
    }

    logger.info('GitHub OAuth exchange successful');

    return {
      accessToken,
      refreshToken: undefined, // GitHub doesn't use refresh tokens
      expiresIn: undefined,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    // GitHub tokens don't expire, no refresh needed
    throw new Error('GitHub does not support token refresh');
  }

  private getClient(accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      },
    });
  }

  async fetch(
    integration: Integration,
    config: { owner: string; repo: string; state?: string },
    cursor?: string,
  ): Promise<FetchResult> {
    try {
      const accessToken = this.encryptionService.decrypt(
        integration.oauth_access_token || '',
      );

      const client = this.getClient(accessToken);

      const response = await client.get(`/repos/${config.owner}/${config.repo}/issues`, {
        params: {
          state: config.state || 'open',
          per_page: 100,
          page: cursor ? parseInt(cursor) : 1,
        },
      });

      const objects = response.data.map((issue: any) => ({
        id: issue.number.toString(),
        title: issue.title,
        description: issue.body,
        state: issue.state,
        labels: issue.labels?.map((l: any) => l.name) || [],
        assignees: issue.assignees?.map((a: any) => a.login) || [],
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        html_url: issue.html_url,
      }));

      logger.info(`Fetched ${objects.length} issues from GitHub`);

      return {
        objects,
        nextCursor: cursor ? String(parseInt(cursor) + 1) : '2',
      };
    } catch (error) {
      logger.error(error, 'Failed to fetch from GitHub');
      throw error;
    }
  }

  async pushChanges(
    integration: Integration,
    config: { owner: string; repo: string },
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
      // Create new issues
      for (const obj of changes.toCreate) {
        try {
          await client.post(`/repos/${config.owner}/${config.repo}/issues`, {
            title: obj.title,
            body: obj.description,
            labels: obj.labels || [],
            assignees: obj.assignees || [],
          });
          result.created = (result.created || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: String(obj.id || 'unknown'),
            error: error.message,
          });
        }
      }

      // Update existing issues
      for (const obj of changes.toUpdate) {
        try {
          await client.patch(`/repos/${config.owner}/${config.repo}/issues/${obj.id}`, {
            title: obj.title,
            body: obj.description,
            state: obj.state,
            labels: obj.labels || [],
            assignees: obj.assignees || [],
          });
          result.updated = (result.updated || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: String(obj.id || 'unknown'),
            error: error.message,
          });
        }
        }

        logger.info(
        `Pushed changes to GitHub: ${result.created} created, ${result.updated} updated`,
        );
    } catch (error) {
      logger.error(error, 'Failed to push changes to GitHub');
      result.success = false;
    }

    return result;
  }

  async registerWebhook(webhookUrl: string): Promise<WebhookRegistration> {
    return Promise.resolve({
      id: 'github_webhook',
      status: 'pending',
    });
  }

  verifyWebhookSignature(signature: string, payload: Buffer): boolean {
    // GitHub uses HMAC SHA256 signatures
    // Implementation would verify X-Hub-Signature header
    return true;
  }

  parseWebhookPayload(payload: Record<string, any>): ParsedWebhookEvent[] {
    if (payload.action && payload.issue) {
      return [
        {
          type: `issue_${payload.action}`,
          objectId: payload.issue.number.toString(),
          data: payload,
          timestamp: payload.issue.updated_at || new Date().toISOString(),
        },
      ];
    }
    return [];
  }
}
