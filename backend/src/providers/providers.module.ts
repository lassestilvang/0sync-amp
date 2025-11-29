import { Module } from '@nestjs/common';
import { ProvidersRegistry } from './providers.registry';
import { NotionProvider } from './notion/notion.provider';
import { EncryptionService } from '../common/services/encryption.service';

@Module({
  providers: [ProvidersRegistry, NotionProvider, EncryptionService],
  exports: [ProvidersRegistry, NotionProvider, EncryptionService],
})
export class ProvidersModule {}
