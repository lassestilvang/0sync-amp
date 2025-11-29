import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncsService } from './syncs.service';
import { SyncsController } from './syncs.controller';
import { Sync } from './entities/sync.entity';
import { SyncState } from './entities/sync-state.entity';
import { ObjectMapping } from './entities/object-mapping.entity';
import { SyncStateService } from './services/sync-state.service';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sync, SyncState, ObjectMapping]),
    IntegrationsModule,
  ],
  providers: [SyncsService, SyncStateService],
  controllers: [SyncsController],
  exports: [SyncsService, SyncStateService],
})
export class SyncsModule {}
