import { Integration } from '../modules/integrations/entities/integration.entity';

export interface FetchResult {
  objects: any[];
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
  data: Record<string, any>;
  timestamp: string;
}

export interface TransformedChangeSet {
  toCreate: any[];
  toUpdate: any[];
  toDelete: any[];
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
    config: Record<string, any>,
    cursor?: string,
  ): Promise<FetchResult>;

  // Data pushing
  pushChanges(
    integration: Integration,
    config: Record<string, any>,
    changes: TransformedChangeSet,
  ): Promise<PushResult>;

  // Webhook management
  registerWebhook?(webhookUrl: string): Promise<WebhookRegistration>;
  verifyWebhookSignature?(signature: string, payload: Buffer): boolean;
  parseWebhookPayload?(payload: Record<string, any>): ParsedWebhookEvent[];

  // Batch operations
  batchCreate?(objects: any[]): Promise<string[]>;
  batchUpdate?(objects: any[]): Promise<void>;
  batchDelete?(ids: string[]): Promise<void>;
}
