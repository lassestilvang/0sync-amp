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

const logger = createChildLogger('GoogleContactsProvider');

@Injectable()
export class GoogleContactsProvider implements IProvider {
  supportsBidirectional = true;
  supportsWebhooks = false; // Google Contacts doesn't support webhooks yet
  supportsFieldMapping = true;
  rateLimitInfo: RateLimitInfo = {
    requestsPerMinute: 600,
    batchSize: 200,
  };

  constructor(private encryptionService: EncryptionService) {}

  getAuthorizationUrl(): string {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const redirectUri = `${process.env.API_URL}/oauth/google/callback`;

    const params = new URLSearchParams({
      client_id: clientId || '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope:
        'https://www.googleapis.com/auth/contacts https://www.googleapis.com/auth/contacts.readonly',
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

    logger.info('Google OAuth exchange successful for Contacts');

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

    logger.info('Google Contacts token refreshed');
    return response.data.access_token;
  }

  private getClient(accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: 'https://people.googleapis.com/v1',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async fetch(
    integration: Integration,
    config: { resourceNames?: string[] },
    cursor?: string,
  ): Promise<FetchResult> {
    try {
      const accessToken = this.encryptionService.decrypt(
        integration.oauth_access_token || '',
      );

      const client = this.getClient(accessToken);

      const response = await client.get('/people/me/connections', {
        params: {
          pageSize: 100,
          pageToken: cursor,
          personFields:
            'names,emailAddresses,phoneNumbers,organizations,birthdays,addresses',
        },
      });

      const objects = (response.data.connections || []).map((contact: any) => ({
        id: contact.resourceName,
        name: contact.names?.[0]?.displayName || '',
        emails: contact.emailAddresses?.map((e: any) => e.value) || [],
        phones: contact.phoneNumbers?.map((p: any) => p.value) || [],
        organization: contact.organizations?.[0]?.name || '',
        birthday: contact.birthdays?.[0]?.date || null,
        addresses: contact.addresses?.map((a: any) => a.formattedValue) || [],
        etag: contact.etag,
        updated_at: contact.metadata?.sources?.[0]?.updateTime || new Date().toISOString(),
      }));

      logger.info(`Fetched ${objects.length} contacts from Google Contacts`);

      return {
        objects,
        nextCursor: response.data.nextPageToken || undefined,
      };
    } catch (error) {
      logger.error(error, 'Failed to fetch from Google Contacts');
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
      // Create new contacts
      for (const obj of changes.toCreate) {
        try {
          await client.post('/people:createContact', {
            names: [{ givenName: obj.name || 'Unnamed' }],
            emailAddresses: ((obj.emails as any) || []).map((email: string) => ({ value: email })),
            phoneNumbers: ((obj.phones as any) || []).map((phone: string) => ({ value: phone })),
            organizations: obj.organization
              ? [{ name: obj.organization }]
              : undefined,
            birthdays: obj.birthday ? [{ date: obj.birthday }] : undefined,
            addresses: ((obj.addresses as any) || []).map((addr: string) => ({ formattedValue: addr })),
          });
          result.created = (result.created || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: String(obj.id || 'unknown'),
            error: error.message,
          });
        }
      }

      // Update existing contacts
      for (const obj of changes.toUpdate) {
        try {
          await client.patch(`/${obj.id}`, {
            names: [{ givenName: obj.name || 'Unnamed' }],
            emailAddresses: ((obj.emails as any) || []).map((email: string) => ({ value: email })),
            phoneNumbers: ((obj.phones as any) || []).map((phone: string) => ({ value: phone })),
            organizations: obj.organization
              ? [{ name: obj.organization }]
              : undefined,
            birthdays: obj.birthday ? [{ date: obj.birthday }] : undefined,
            addresses: ((obj.addresses as any) || []).map((addr: string) => ({ formattedValue: addr })),
          });
          result.updated = (result.updated || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: String(obj.id),
            error: error.message,
          });
        }
      }

      // Delete contacts
      for (const obj of changes.toDelete) {
        try {
          await client.delete(`/${obj.id}`);
          result.deleted = (result.deleted || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: String(obj.id),
            error: error.message,
          });
        }
      }

      logger.info(
        `Pushed changes to Google Contacts: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`,
      );
    } catch (error) {
      logger.error(error, 'Failed to push changes to Google Contacts');
      result.success = false;
    }

    return result;
  }

  registerWebhook?(webhookUrl: string): Promise<WebhookRegistration> {
    // Google Contacts doesn't support webhooks
    return Promise.resolve({
      id: 'google_contacts_webhook',
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
