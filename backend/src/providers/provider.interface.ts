import { Integration } from '../modules/integrations/entities/integration.entity';

export interface FetchResult {
  objects: Array<Record<string, unknown>>;
  nextCursor?: string;
}

export interface PushResult {
  success: boolean;
  created?: number;
  updated?: number;
  deleted?: number;
  errors?: Array<{ id: string; error: string }>;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface WebhookRegistration {
  id: string;
  secret?: string;
  status: 'active' | 'pending';
}

export interface RateLimitInfo {
  requestsPerMinute: number;
  batchSize: number;
  retryAfter?: number;
}

export interface ParsedWebhookEvent {
  type: string;
  objectId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface TransformedChangeSet {
  toCreate: Array<Record<string, unknown>>;
  toUpdate: Array<Record<string, unknown>>;
  toDelete: Array<Record<string, unknown>>;
}

export interface IProvider {
  // Metadata
  supportsBidirectional: boolean;
  supportsWebhooks: boolean;
  supportsFieldMapping: boolean;
  rateLimitInfo: RateLimitInfo;

  // Authentication
  getAuthorizationUrl(): string;
  exchangeAuthorizationCode(code: string): Promise<TokenResponse>;
  refreshAccessToken(refreshToken: string): Promise<string>;

  // Data fetching
  fetch(
    integration: Integration,
    config: Record<string, unknown>,
    cursor?: string,
  ): Promise<FetchResult>;

  // Data pushing
  pushChanges(
    integration: Integration,
    config: Record<string, unknown>,
    changes: TransformedChangeSet,
  ): Promise<PushResult>;

  // Webhook management
  registerWebhook?(webhookUrl: string): Promise<WebhookRegistration>;
  verifyWebhookSignature?(signature: string, payload: Buffer): boolean;
  parseWebhookPayload?(
    payload: Record<string, unknown>,
  ): ParsedWebhookEvent[];

  // Batch operations
  batchCreate?(objects: Array<Record<string, unknown>>): Promise<string[]>;
  batchUpdate?(objects: Array<Record<string, unknown>>): Promise<void>;
  batchDelete?(ids: string[]): Promise<void>;
}
