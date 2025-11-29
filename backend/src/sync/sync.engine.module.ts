import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncEngine } from './sync.engine';
import { SyncsModule } from '../modules/syncs/syncs.module';
import { IntegrationsModule } from '../modules/integrations/integrations.module';
import { WebhooksModule } from '../modules/webhooks/webhooks.module';
import { ProvidersModule } from '../providers/providers.module';
import { Sync } from '../modules/syncs/entities/sync.entity';
import { ObjectMapping } from '../modules/syncs/entities/object-mapping.entity';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'sync-processor' },
      { name: 'webhook-processor' },
    ),
    TypeOrmModule.forFeature([Sync, ObjectMapping]),
    SyncsModule,
    IntegrationsModule,
    WebhooksModule,
    ProvidersModule,
  ],
  providers: [SyncEngine],
  exports: [SyncEngine],
})
export class SyncEngineModule {}
