# Provider Implementation Guide

Complete guide for adding new providers to 0Sync.

## Quick Summary

Adding a new provider involves:
1. Creating a provider class implementing `IProvider`
2. Registering it in `ProvidersModule` and `ProvidersRegistry`
3. Adding OAuth config to `OAuthService`
4. Updating frontend provider list
5. Writing tests

Estimated time: 2-4 hours per provider

---

## Step 1: Create Provider Class

Create `backend/src/providers/[name]/[name].provider.ts`:

```typescript
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

const logger = createChildLogger('[ProviderName]Provider');

@Injectable()
export class [ProviderName]Provider implements IProvider {
  // Metadata - Required
  supportsBidirectional = true;    // Can sync in both directions
  supportsWebhooks = false;         // Supports webhooks
  supportsFieldMapping = true;      // Supports field mapping
  rateLimitInfo: RateLimitInfo = {
    requestsPerMinute: 300,         // Adjust per provider docs
    batchSize: 100,                 // Adjust per provider docs
  };

  constructor(private encryptionService: EncryptionService) {}

  // OAuth - Required
  getAuthorizationUrl(): string {
    const clientId = process.env.[PROVIDER]_OAUTH_CLIENT_ID;
    const redirectUri = `${process.env.API_URL}/oauth/[provider]/callback`;

    const params = new URLSearchParams({
      client_id: clientId || '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'required_scopes',
    });

    return `https://provider.com/oauth/authorize?${params.toString()}`;
  }

  async exchangeAuthorizationCode(code: string): Promise<TokenResponse> {
    const response = await axios.post('https://provider.com/oauth/token', {
      client_id: process.env.[PROVIDER]_OAUTH_CLIENT_ID,
      client_secret: process.env.[PROVIDER]_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: `${process.env.API_URL}/oauth/[provider]/callback`,
      grant_type: 'authorization_code',
    });

    logger.info('[Provider] OAuth exchange successful');

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,    // Optional
      expiresIn: response.data.expires_in,          // Optional
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const response = await axios.post('https://provider.com/oauth/token', {
      client_id: process.env.[PROVIDER]_OAUTH_CLIENT_ID,
      client_secret: process.env.[PROVIDER]_OAUTH_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    logger.info('[Provider] Token refreshed');
    return response.data.access_token;
  }

  // Helper - Get authenticated HTTP client
  private getClient(accessToken: string): AxiosInstance {
    return axios.create({
      baseURL: 'https://api.provider.com/v1',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // Data fetching - Required
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

      const response = await client.get('/items', {
        params: {
          limit: 100,
          offset: cursor,
        },
      });

      const objects = response.data.items.map((item: any) => ({
        id: item.id,
        title: item.name,
        description: item.description,
        created_at: item.created_at,
        updated_at: item.updated_at,
      }));

      logger.info(`Fetched ${objects.length} items from [Provider]`);

      return {
        objects,
        nextCursor: response.data.next_cursor || undefined,
      };
    } catch (error) {
      logger.error(error, 'Failed to fetch from [Provider]');
      throw error;
    }
  }

  // Push changes - Required
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
          await client.post('/items', {
            name: obj.title,
            description: obj.description,
          });
          result.created = (result.created || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: obj.id || 'unknown',
            error: error.message,
          });
        }
      }

      // Update
      for (const obj of changes.toUpdate) {
        try {
          await client.patch(`/items/${obj.id}`, {
            name: obj.title,
            description: obj.description,
          });
          result.updated = (result.updated || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: obj.id,
            error: error.message,
          });
        }
      }

      // Delete
      for (const obj of changes.toDelete) {
        try {
          await client.delete(`/items/${obj.id}`);
          result.deleted = (result.deleted || 0) + 1;
        } catch (error: any) {
          result.errors?.push({
            id: obj.id,
            error: error.message,
          });
        }
      }

      logger.info(
        `Pushed changes to [Provider]: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`,
      );
    } catch (error) {
      logger.error(error, 'Failed to push changes to [Provider]');
      result.success = false;
    }

    return result;
  }

  // Webhooks - Optional
  async registerWebhook(webhookUrl: string): Promise<WebhookRegistration> {
    // If provider supports webhooks, register here
    // If not, return pending status
    return Promise.resolve({
      id: '[provider]_webhook',
      status: 'pending',
    });
  }

  verifyWebhookSignature(signature: string, payload: Buffer): boolean {
    // Verify webhook signature from provider
    // Usually HMAC SHA256 or similar
    return true;
  }

  parseWebhookPayload(payload: Record<string, any>): ParsedWebhookEvent[] {
    // Parse webhook payload into standard event format
    return payload.events?.map((event: any) => ({
      type: event.event_type,
      objectId: event.resource?.id,
      data: event,
      timestamp: new Date().toISOString(),
    })) || [];
  }
}
```

---

## Step 2: Register Provider

### Update `backend/src/providers/providers.module.ts`

```typescript
import { [ProviderName]Provider } from './[folder]/[name].provider';

const PROVIDERS = [
  // ... existing providers
  [ProviderName]Provider,
];

@Module({
  providers: [ProvidersRegistry, ...PROVIDERS, EncryptionService],
  exports: [ProvidersRegistry, ...PROVIDERS, EncryptionService],
})
export class ProvidersModule {}
```

### Update `backend/src/providers/providers.registry.ts`

```typescript
import { [ProviderName]Provider } from './[folder]/[name].provider';

export class ProvidersRegistry {
  constructor(
    // ... existing providers
    private [nameProvider]: [ProviderName]Provider,
  ) {
    this.registerProviders();
  }

  private registerProviders() {
    // ... existing registrations
    this.register('[provider_id]', this.[nameProvider]);
  }
}
```

---

## Step 3: Add OAuth Configuration

### Update `backend/src/modules/integrations/services/oauth.service.ts`

```typescript
export const OAUTH_PROVIDERS = {
  // ... existing
  [provider]: {
    clientId: process.env.[PROVIDER]_OAUTH_CLIENT_ID,
    clientSecret: process.env.[PROVIDER]_OAUTH_CLIENT_SECRET,
    redirectUri: `${process.env.API_URL}/oauth/[provider]/callback`,
    authUrl: 'https://provider.com/oauth/authorize',
    tokenUrl: 'https://provider.com/oauth/token',
    scopes: ['scope1', 'scope2'],
  },
};
```

### Update `.env.example`

```env
[PROVIDER]_OAUTH_CLIENT_ID=your_client_id
[PROVIDER]_OAUTH_CLIENT_SECRET=your_client_secret
```

---

## Step 4: Update Frontend

### Update `frontend/src/pages/IntegrationPage.tsx`

```typescript
const PROVIDERS = [
  // ... existing
  { id: '[provider]', name: '[Provider Name]', icon: '🎯' },
];
```

---

## Step 5: Add Tests

### Create `backend/src/providers/__tests__/[name].provider.test.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { [ProviderName]Provider } from '../[folder]/[name].provider';
import { EncryptionService } from '../../common/services/encryption.service';

describe('[ProviderName]Provider', () => {
  let provider: [ProviderName]Provider;
  let encryptionService: EncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [[ProviderName]Provider, EncryptionService],
    }).compile();

    provider = module.get<[ProviderName]Provider>([ProviderName]Provider);
    encryptionService = module.get<EncryptionService>(EncryptionService);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('should have correct metadata', () => {
    expect(provider.supportsBidirectional).toBe(true);
    expect(provider.supportsWebhooks).toBe(false);
    expect(provider.supportsFieldMapping).toBe(true);
    expect(provider.rateLimitInfo.requestsPerMinute).toBeGreaterThan(0);
  });

  it('should generate authorization URL', () => {
    const url = provider.getAuthorizationUrl();
    expect(url).toContain('client_id');
    expect(url).toContain('redirect_uri');
  });

  it('should implement all required methods', () => {
    expect(typeof provider.fetch).toBe('function');
    expect(typeof provider.pushChanges).toBe('function');
    expect(typeof provider.exchangeAuthorizationCode).toBe('function');
    expect(typeof provider.refreshAccessToken).toBe('function');
  });
});
```

---

## Provider Checklist

Before submitting:

- [ ] Class implements `IProvider` interface
- [ ] All required methods implemented
- [ ] OAuth configured in `.env.example`
- [ ] OAuth registration in `OAuthService`
- [ ] Provider registered in `ProvidersModule`
- [ ] Provider registered in `ProvidersRegistry`
- [ ] Frontend provider list updated
- [ ] Tests written (unit + integration)
- [ ] Logging implemented
- [ ] Error handling complete
- [ ] Rate limits configured
- [ ] Documentation updated
- [ ] Webhook support (if applicable)

---

## Common Patterns

### Error Handling Pattern

```typescript
try {
  const result = await client.get('/endpoint');
  return processResult(result);
} catch (error) {
  logger.error(error, 'Failed to fetch from [Provider]');
  throw error;  // Propagate for retry logic
}
```

### Field Mapping Pattern

```typescript
// Standard object format
const objects = response.data.items.map((item: any) => ({
  id: item.id,
  title: item.name,
  description: item.description,
  status: item.state,
  assignees: item.assigned_to,
  due_date: item.due_on,
  updated_at: item.modified_at,
}));
```

### Pagination Pattern

```typescript
return {
  objects,
  nextCursor: response.data.nextPageToken || undefined,
};
```

### Webhook Pattern

```typescript
parseWebhookPayload(payload: Record<string, any>): ParsedWebhookEvent[] {
  return payload.events?.map((event: any) => ({
    type: event.type,
    objectId: event.resource?.id || 'unknown',
    data: event,
    timestamp: new Date().toISOString(),
  })) || [];
}
```

---

## Testing Providers

### Unit Test
```bash
npm test -- [name].provider.test.ts
```

### Integration Test
```bash
npm run test:integration -- --provider=[provider]
```

### Manual Testing
```typescript
// Manually test provider
const provider = new [ProviderName]Provider(encryptionService);
const url = provider.getAuthorizationUrl();
console.log('Auth URL:', url);
```

---

## Provider Capabilities Matrix

| Capability | Google | GitHub | Asana | Trello |
|-----------|--------|--------|-------|--------|
| OAuth 2.0 | ✅ | ✅ | ✅ | Partial |
| Bidirectional | ✅ | ✅ | ✅ | ✅ |
| Webhooks | ❌ | ✅ | ✅ | ✅ |
| Refresh Token | ✅ | ❌ | ✅ | ❌ |
| Pagination | ✅ | ✅ | ✅ | Limited |
| Field Mapping | ✅ | ✅ | ✅ | ✅ |

---

## API Rate Limits

Research and document:
- Requests per minute/second
- Batch operation limits
- Concurrent connection limits
- Rate limit headers
- Retry-after policies

Example:
```typescript
rateLimitInfo: RateLimitInfo = {
  requestsPerMinute: 300,    // From API docs
  batchSize: 100,            // From API docs
  retryAfter: 60,            // Seconds (optional)
};
```

---

## Troubleshooting

### OAuth Issues
- Verify redirect URI matches exactly
- Check client ID/secret in environment
- Test with curl or Postman first

### API Issues
- Check API endpoint URL
- Verify authentication header format
- Review API response structure
- Check rate limit headers

### Type Issues
- Ensure return types match `IProvider`
- Verify `FetchResult` structure
- Check `PushResult` properties
- Validate `TokenResponse` fields

---

## Real-World Examples

See implemented providers:
- Simple: `google-contacts.provider.ts` (basic CRUD)
- Medium: `notion.provider.ts` (complex properties)
- Advanced: `gmail.provider.ts` (special handling)

---

## Support

Questions or issues?
- Review existing provider implementations
- Check `IProvider` interface definition
- See TESTING.md for test patterns
- Check git history for example PRs

Good luck! 🚀
