import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../modules/users/entities/user.entity';
import { Integration } from '../modules/integrations/entities/integration.entity';
import { Sync } from '../modules/syncs/entities/sync.entity';
import { SyncState } from '../modules/syncs/entities/sync-state.entity';
import { ObjectMapping } from '../modules/syncs/entities/object-mapping.entity';
import { Webhook } from '../modules/webhooks/entities/webhook.entity';
import { WebhookEvent } from '../modules/webhooks/entities/webhook-event.entity';
import { AuditLog } from '../common/entities/audit-log.entity';

export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    User,
    Integration,
    Sync,
    SyncState,
    ObjectMapping,
    Webhook,
    WebhookEvent,
    AuditLog,
  ],
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  migrations: ['src/migrations/**/*.ts'],
  migrationsRun: true,
};
