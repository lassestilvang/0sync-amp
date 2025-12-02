export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
}

export interface SyncStatus {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'paused' | 'error';
  direction: 'bidirectional' | 'one-way';
  lastSyncAt?: Date;
  last_error?: string;
  last_error_at?: Date;
  conflictCount?: number;
  retryCount?: number;
}

export interface Conflict {
  id: string;
  syncId: string;
  sourceData: unknown;
  targetData: unknown;
  createdAt: Date;
}

export interface SyncLog {
  id: string;
  syncId: string;
  message: string;
  level: 'info' | 'warn' | 'error';
  timestamp: Date;
}

export interface Integration {
  id: string;
  provider: string;
  userId: string;
  isConnected: boolean;
  connectedAt?: Date;
}
