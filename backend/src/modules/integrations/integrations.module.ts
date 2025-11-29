import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { Integration } from './entities/integration.entity';
import { OAuthService } from './services/oauth.service';
import { EncryptionService } from '../../common/services/encryption.service';

@Module({
  imports: [TypeOrmModule.forFeature([Integration])],
  providers: [IntegrationsService, OAuthService, EncryptionService],
  controllers: [IntegrationsController],
  exports: [IntegrationsService, OAuthService, EncryptionService],
})
export class IntegrationsModule {}
