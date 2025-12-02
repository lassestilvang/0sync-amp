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

const logger = createChildLogger('GoogleSheetsProvider');

@Injectable()
export class GoogleSheetsProvider implements IProvider {
  supportsBidirectional = true;
  supportsWebhooks = false;
  supportsFieldMapping = true;
  rateLimitInfo: RateLimitInfo = {
    requestsPerMinute: 300,
    batchSize: 1000,
  };

  constructor(private encryptionService: EncryptionService) {}

  getAuthorizationUrl(): string {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const redirectUri = `${process.env.API_URL}/oauth/google/callback`;

    const params = new URLSearchParams({
      client_id: clientId || '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/spreadsheets',
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

    logger.info('Google OAuth exchange successful for Sheets');

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

    logger.info('Google Sheets token refreshed');
    return response.data.access_token;
  }

  private getClient(accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: 'https://sheets.googleapis.com/v4',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async fetch(
    integration: Integration,
    config: { spreadsheetId: string; range?: string },
    cursor?: string,
  ): Promise<FetchResult> {
    try {
      const accessToken = this.encryptionService.decrypt(
        integration.oauth_access_token || '',
      );

      const client = this.getClient(accessToken);
      const range = config.range || 'Sheet1';

      const response = await client.get(
        `/spreadsheets/${config.spreadsheetId}/values/${range}`,
      );

      const rows = response.data.values || [];
      const headers = rows[0] || [];

      const objects = rows.slice(1).map((row: string[], index: number) => {
        const obj: Record<string, any> = { id: `row_${index + 2}` };
        headers.forEach((header: string, colIndex: number) => {
          obj[header] = row[colIndex] || '';
        });
        return obj;
      });

      logger.info(`Fetched ${objects.length} rows from Google Sheets`);

      return {
        objects,
        nextCursor: undefined, // Sheets doesn't use pagination cursors
      };
    } catch (error) {
      logger.error(error, 'Failed to fetch from Google Sheets');
      throw error;
    }
  }

  async pushChanges(
    integration: Integration,
    config: { spreadsheetId: string; range?: string },
    changes: TransformedChangeSet,
  ): Promise<PushResult> {
    const accessToken = this.encryptionService.decrypt(
      integration.oauth_access_token || '',
    );

    const client = this.getClient(accessToken);
    const range = config.range || 'Sheet1';

    const result: PushResult = {
      success: true,
      created: 0,
      updated: 0,
      deleted: 0,
      errors: [],
    };

    try {
      // Get current data to understand structure
      const currentResponse = await client.get(
        `/spreadsheets/${config.spreadsheetId}/values/${range}`,
      );
      const headers = currentResponse.data.values?.[0] || [];

      // Create new rows
      if (changes.toCreate.length > 0) {
        const values = changes.toCreate.map((obj: any) => {
          return headers.map((header: string) => obj[header] || '');
        });

        await client.post(
          `/spreadsheets/${config.spreadsheetId}/values/${range}:append`,
          { values },
          { params: { valueInputOption: 'USER_ENTERED' } },
        );

        result.created = changes.toCreate.length;
      }

      // Update rows (replace entire range or update specific rows)
      if (changes.toUpdate.length > 0) {
        for (const obj of changes.toUpdate) {
          try {
            const rowIndex = parseInt(String(obj.id).split('_')[1]) || 0;
            const rowRange = `${range}!A${rowIndex}:${String.fromCharCode(64 + headers.length)}${rowIndex}`;
            const values = [headers.map((header: string) => obj[header] || '')];

            await client.put(
              `/spreadsheets/${config.spreadsheetId}/values/${rowRange}`,
              { values },
              { params: { valueInputOption: 'USER_ENTERED' } },
            );

            result.updated = (result.updated || 0) + 1;
          } catch (error: any) {
            result.errors?.push({
              id: String(obj.id),
              error: error.message,
            });
          }
        }
      }

      // Note: Sheets doesn't support direct row deletion through this API
      // Would need to implement via batchUpdate if needed
      if (changes.toDelete.length > 0) {
        logger.warn('Google Sheets: Row deletion not yet implemented via API');
      }

      logger.info(
        `Pushed changes to Google Sheets: ${result.created} created, ${result.updated} updated`,
      );
    } catch (error) {
      logger.error(error, 'Failed to push changes to Google Sheets');
      result.success = false;
    }

    return result;
  }

  registerWebhook?(webhookUrl: string): Promise<WebhookRegistration> {
    return Promise.resolve({
      id: 'google_sheets_webhook',
      status: 'pending',
    });
  }

  verifyWebhookSignature?(signature: string, payload: Buffer): boolean {
    return true;
  }

  parseWebhookPayload?(payload: Record<string, any>): ParsedWebhookEvent[] {
    return [];
  }
}
