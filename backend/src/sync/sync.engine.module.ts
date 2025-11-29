import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SyncEngine } from './sync.engine';
import { SyncsModule } from '../modules/syncs/syncs.module';
import { IntegrationsModule } from '../modules/integrations/integrations.module';
import { WebhooksModule } from '../modules/webhooks/webhooks.module';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'sync-processor' },
      { name: 'webhook-processor' },
    ),
    SyncsModule,
    IntegrationsModule,
    WebhooksModule,
  ],
  providers: [SyncEngine],
  exports: [SyncEngine],
})
export class SyncEngineModule {}
