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

const logger = createChildLogger('OutlookContactsProvider');

@Injectable()
export class OutlookContactsProvider implements IProvider {
  supportsBidirectional = true;
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
      scope: 'Contacts.ReadWrite offline_access',
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
      scope: 'Contacts.ReadWrite offline_access',
    });

    logger.info('Microsoft OAuth exchange successful for Outlook Contacts');

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
      scope: 'Contacts.ReadWrite offline_access',
    });

    logger.info('Outlook Contacts token refreshed');
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
    config: Record<string, any>,
    cursor?: string,
  ): Promise<FetchResult> {
    try {
      const accessToken = this.encryptionService.decrypt(
        integration.oauth_access_token || '',
      );

      const client = this.getClient(accessToken);

      const response = await client.get('/me/contacts', {
        params: {
          $top: 100,
          $skip: cursor ? parseInt(cursor) : 0,
        },
      });

      const objects = (response.data.value || []).map((contact: any) => ({
        id: contact.id,
        displayName: contact.displayName,
        givenName: contact.givenName,
        surname: contact.surname,
        emailAddresses: contact.emailAddresses?.map((e: any) => e.address) || [],
        mobilePhone: contact.mobilePhone,
        businessPhones: contact.businessPhones || [],
        jobTitle: contact.jobTitle,
        companyName: contact.companyName,
        updated_at: contact.lastModifiedDateTime,
      }));

      logger.info(`Fetched ${objects.length} contacts from Outlook Contacts`);

      return {
        objects,
        nextCursor: cursor ? String(parseInt(cursor) + 100) : undefined,
      };
    } catch (error) {
      logger.error(error, 'Failed to fetch from Outlook Contacts');
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
          await client.post('/me/contacts', {
            displayName: obj.displayName || obj.name || 'Unnamed',
            givenName: obj.givenName,
            surname: obj.surname,
            emailAddresses: ((obj.emailAddresses as any) || (obj.emails as any) || []).map((email: string) => ({
              address: email,
              type: 'other',
            })),
            mobilePhone: obj.mobilePhone || (obj.phones as any)?.[0],
            businessPhones: obj.businessPhones || [],
            jobTitle: obj.jobTitle,
            companyName: obj.companyName,
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
          await client.patch(`/me/contacts/${obj.id}`, {
            displayName: obj.displayName || obj.name || 'Unnamed',
            givenName: obj.givenName,
            surname: obj.surname,
            emailAddresses: ((obj.emailAddresses as any) || (obj.emails as any) || []).map((email: string) => ({
              address: email,
              type: 'other',
            })),
            mobilePhone: obj.mobilePhone || (obj.phones as any)?.[0],
            businessPhones: obj.businessPhones || [],
            jobTitle: obj.jobTitle,
            companyName: obj.companyName,
          });
          result.updated = (result.updated || 0) + 1;
          } catch (error: any) {
          result.errors?.push({
            id: String(obj.id || 'unknown'),
            error: error.message,
          });
        }
      }

      // Delete contacts
      for (const obj of changes.toDelete) {
        try {
          await client.delete(`/me/contacts/${obj.id}`);
          result.deleted = (result.deleted || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: String(obj.id || 'unknown'),
            error: error.message,
          });
        }
      }

      logger.info(
        `Pushed changes to Outlook Contacts: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`,
      );
    } catch (error) {
      logger.error(error, 'Failed to push changes to Outlook Contacts');
      result.success = false;
    }

    return result;
  }

  async registerWebhook(webhookUrl: string): Promise<WebhookRegistration> {
    return Promise.resolve({
      id: 'outlook_contacts_webhook',
      status: 'pending',
    });
  }

  verifyWebhookSignature(signature: string, payload: Buffer): boolean {
    return true;
  }

  parseWebhookPayload(payload: Record<string, any>): ParsedWebhookEvent[] {
    return payload.value?.map((item: any) => ({
      type: item.changeType,
      objectId: item.resourceData?.id || 'unknown',
      data: item,
      timestamp: new Date().toISOString(),
    })) || [];
  }
}
