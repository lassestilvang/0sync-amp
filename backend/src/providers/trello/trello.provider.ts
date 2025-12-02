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

const logger = createChildLogger('TrelloProvider');

@Injectable()
export class TrelloProvider implements IProvider {
  supportsBidirectional = true;
  supportsWebhooks = true;
  supportsFieldMapping = true;
  rateLimitInfo: RateLimitInfo = {
    requestsPerMinute: 300,
    batchSize: 100,
  };

  constructor(private encryptionService: EncryptionService) {}

  getAuthorizationUrl(): string {
    const key = process.env.TRELLO_API_KEY;
    const redirectUri = `${process.env.API_URL}/oauth/trello/callback`;

    const params = new URLSearchParams({
      key: key || '',
      token: '',
      name: '0Sync',
      scope: 'read,write',
      expiration: 'never',
      response_type: 'token',
      redirect_uri: redirectUri,
    });

    return `https://trello.com/app-key?${params.toString()}`;
  }

  async exchangeAuthorizationCode(code: string): Promise<TokenResponse> {
    // Trello doesn't use traditional OAuth, it uses API key + token
    // The "code" here is actually the token from the callback
    logger.info('Trello token exchange successful');

    return {
      accessToken: code,
      refreshToken: undefined,
      expiresIn: undefined,
    };
  }

  async refreshAccessToken(_refreshToken: string): Promise<string> {
    // Trello tokens don't expire
    throw new Error('Trello does not support token refresh');
  }

  private getClient(accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: 'https://api.trello.com/1',
      headers: {
        'Content-Type': 'application/json',
      },
      params: {
        key: process.env.TRELLO_API_KEY,
        token: accessToken,
      },
    });
  }

  async fetch(
    integration: Integration,
    config: { boardId: string; cardFilter?: string },
    _cursor?: string,
  ): Promise<FetchResult> {
    try {
      const accessToken = this.encryptionService.decrypt(
        integration.oauth_access_token || '',
      );

      const client = this.getClient(accessToken);

      // Fetch lists
      const listsResponse = await client.get(`/boards/${config.boardId}/lists`);
      const lists = listsResponse.data as Array<
        Record<string, unknown>
      >;

      // Fetch cards from all lists
      const cards: Array<Record<string, unknown>> = [];
      for (const list of lists) {
        const cardsResponse = await client.get(
          `/lists/${(list.id as string) || ''}/cards`,
        );
        cards.push(
          ...(cardsResponse.data as Array<Record<string, unknown>>).map(
            (card) => ({
              ...card,
              listId: list.id,
              listName: list.name,
            }),
          ),
        );
      }

      const objects = cards.map((card) => ({
        id: card.id as string,
        title: card.name as string,
        description: (card.desc as string) || '',
        listId: card.listId as string,
        listName: card.listName as string,
        labels:
          (card.labels as Array<Record<string, unknown>> | undefined)?.map(
            (l) => (l.name as string) || '',
          ) || [],
        members: (card.idMembers as string[]) || [],
        due: card.due as string | undefined,
        closed: card.closed as boolean | undefined,
        url: card.url as string | undefined,
        updated_at: card.dateLastActivity as string | undefined,
      }));

      logger.info(`Fetched ${objects.length} cards from Trello`);

      return {
        objects,
        nextCursor: undefined,
      };
    } catch (error) {
      logger.error(error, 'Failed to fetch from Trello');
      throw error;
    }
  }

  async pushChanges(
    integration: Integration,
    config: { boardId: string },
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
      // Create new cards
      for (const obj of changes.toCreate) {
        try {
          await client.post('/cards', {
            name: obj.title,
            desc: obj.description,
            idList: obj.listId,
            labels: obj.labels || [],
            idMembers: obj.members || [],
            due: obj.due,
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

      // Update existing cards
      for (const obj of changes.toUpdate) {
        try {
          await client.put(`/cards/${obj.id}`, {
            name: obj.title,
            desc: obj.description,
            idList: obj.listId,
            labels: obj.labels || [],
            idMembers: obj.members || [],
            due: obj.due,
            closed: obj.closed,
          });
          result.updated = (result.updated || 0) + 1;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          result.errors?.push({
            id: String(obj.id || 'unknown'),
            error: errorMessage,
          });
        }
        }

        // Delete cards
        for (const obj of changes.toDelete) {
        try {
          await client.delete(`/cards/${obj.id}`);
          result.deleted = (result.deleted || 0) + 1;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          result.errors?.push({
            id: String(obj.id || 'unknown'),
            error: errorMessage,
          });
        }
        }

      logger.info(
        `Pushed changes to Trello: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`,
      );
    } catch (error) {
      logger.error(error, 'Failed to push changes to Trello');
      result.success = false;
    }

    return result;
  }

  async registerWebhook(_webhookUrl: string): Promise<WebhookRegistration> {
    return Promise.resolve({
      id: 'trello_webhook',
      status: 'pending',
    });
  }

  verifyWebhookSignature(_signature: string, _payload: Buffer): boolean {
    return true;
  }

  parseWebhookPayload(
    payload: Record<string, unknown>,
  ): ParsedWebhookEvent[] {
    const action = payload.action as Record<string, unknown> | undefined;
    if (action) {
      return [
        {
          type: (action.type as string) || 'unknown',
          objectId: String(
            ((action.data as Record<string, unknown> | undefined)?.card as
              | Record<string, unknown>
              | undefined)?.id || 'unknown',
          ),
          data: payload,
          timestamp:
            ((action.date as string) || undefined) ||
            new Date().toISOString(),
        },
      ];
    }
    return [];
  }
}
