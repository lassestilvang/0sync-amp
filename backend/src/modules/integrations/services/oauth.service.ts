import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { createChildLogger } from '../../../common/logger';

const logger = createChildLogger('OAuthService');

export const OAUTH_PROVIDERS = {
  notion: {
    clientId: process.env.NOTION_OAUTH_CLIENT_ID,
    clientSecret: process.env.NOTION_OAUTH_CLIENT_SECRET,
    redirectUri: `${process.env.API_URL}/oauth/notion/callback`,
    authUrl: 'https://api.notion.com/v1/oauth/authorize',
    tokenUrl: 'https://api.notion.com/v1/oauth/token',
    scopes: ['read', 'write'],
  },
  google: {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: `${process.env.API_URL}/oauth/google/callback`,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/tasks',
      'https://www.googleapis.com/auth/contacts.readonly',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/gmail.readonly',
    ],
  },
  todoist: {
    clientId: process.env.TODOIST_OAUTH_CLIENT_ID,
    clientSecret: process.env.TODOIST_OAUTH_CLIENT_SECRET,
    redirectUri: `${process.env.API_URL}/oauth/todoist/callback`,
    authUrl: 'https://todoist.com/oauth/authorize',
    tokenUrl: 'https://todoist.com/oauth/access_token',
    scopes: ['data:read_write'],
  },
  microsoft: {
    clientId: process.env.MICROSOFT_OAUTH_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET,
    redirectUri: `${process.env.API_URL}/oauth/microsoft/callback`,
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: [
      'Calendars.ReadWrite',
      'Tasks.ReadWrite',
      'Contacts.Read',
      'Mail.Read',
    ],
  },
  linear: {
    clientId: process.env.LINEAR_OAUTH_CLIENT_ID,
    clientSecret: process.env.LINEAR_OAUTH_CLIENT_SECRET,
    redirectUri: `${process.env.API_URL}/oauth/linear/callback`,
    authUrl: 'https://linear.app/oauth/authorize',
    tokenUrl: 'https://api.linear.app/oauth/token',
    scopes: ['read', 'write', 'admin'],
  },
  jira: {
    clientId: process.env.JIRA_OAUTH_CLIENT_ID,
    clientSecret: process.env.JIRA_OAUTH_CLIENT_SECRET,
    redirectUri: `${process.env.API_URL}/oauth/jira/callback`,
    authUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    scopes: ['read:jira-work', 'write:jira-work', 'manage:jira-webhook'],
  },
  ticktick: {
    clientId: process.env.TICKTICK_OAUTH_CLIENT_ID,
    clientSecret: process.env.TICKTICK_OAUTH_CLIENT_SECRET,
    redirectUri: `${process.env.API_URL}/oauth/ticktick/callback`,
    authUrl: 'https://ticktick.com/oauth/authorize',
    tokenUrl: 'https://ticktick.com/oauth/token',
    scopes: ['tasks:read', 'tasks:write'],
  },
  apple: {
    clientId: process.env.APPLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.APPLE_OAUTH_CLIENT_SECRET,
    redirectUri: `${process.env.API_URL}/oauth/apple/callback`,
    authUrl: 'https://appleid.apple.com/auth/authorize',
    tokenUrl: 'https://appleid.apple.com/auth/token',
    scopes: ['email'],
  },
};

@Injectable()
export class OAuthService {
  private stateMap = new Map<string, { provider: string; expiresAt: number }>();

  getAuthorizationUrl(provider: string): string {
    const config = OAUTH_PROVIDERS[provider as keyof typeof OAUTH_PROVIDERS];
    if (!config) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    const state = uuidv4();
    const expiresAt = Date.now() + 300000; // 5 minutes
    this.stateMap.set(state, { provider, expiresAt });

    // Clean up expired states
    this.stateMap.forEach((value, key) => {
      if (value.expiresAt < Date.now()) {
        this.stateMap.delete(key);
      }
    });

    const params = new URLSearchParams({
      client_id: config.clientId || '',
      redirect_uri: config.redirectUri,
      response_type: 'code',
      scope: config.scopes.join(' '),
      state,
      access_type: 'offline',
    });

    logger.info(`Generated OAuth URL for provider: ${provider}`);
    return `${config.authUrl}?${params.toString()}`;
  }

  async exchangeAuthorizationCode(
    provider: string,
    code: string,
    state: string,
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }> {
    // Verify state
    const stateData = this.stateMap.get(state);
    if (!stateData || stateData.expiresAt < Date.now() || stateData.provider !== provider) {
      throw new Error('Invalid or expired state');
    }
    this.stateMap.delete(state);

    const config = OAUTH_PROVIDERS[provider as keyof typeof OAUTH_PROVIDERS];
    if (!config) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    const response = await axios.post(config.tokenUrl, {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    });

    logger.info(`OAuth exchange successful for provider: ${provider}`);

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
    };
  }

  async refreshAccessToken(
    provider: string,
    refreshToken: string,
  ): Promise<string> {
    const config = OAUTH_PROVIDERS[provider as keyof typeof OAUTH_PROVIDERS];
    if (!config || !refreshToken) {
      throw new Error(`Cannot refresh token for provider: ${provider}`);
    }

    const response = await axios.post(config.tokenUrl, {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    logger.info(`Token refreshed for provider: ${provider}`);
    return response.data.access_token;
  }
}
