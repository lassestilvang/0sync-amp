import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from './entities/integration.entity';
import { EncryptionService } from '../../common/services/encryption.service';
import { OAuthService } from './services/oauth.service';

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectRepository(Integration)
    private integrationsRepository: Repository<Integration>,
    private encryptionService: EncryptionService,
    private oauthService: OAuthService,
  ) {}

  async create(userId: string, integrationData: Partial<Integration>): Promise<Integration> {
    const integration = this.integrationsRepository.create({
      ...integrationData,
      user_id: userId,
    });

    // Encrypt tokens
    if (integration.oauth_access_token) {
      integration.oauth_access_token = this.encryptionService.encrypt(
        integration.oauth_access_token,
      );
    }
    if (integration.oauth_refresh_token) {
      integration.oauth_refresh_token = this.encryptionService.encrypt(
        integration.oauth_refresh_token,
      );
    }

    return this.integrationsRepository.save(integration);
  }

  async findById(id: string): Promise<Integration | null> {
    return this.integrationsRepository.findOneBy({ id });
  }

  async findByUser(userId: string): Promise<Integration[]> {
    return this.integrationsRepository.find({
      where: { user_id: userId },
    });
  }

  async findByUserAndProvider(userId: string, provider: string): Promise<Integration | null> {
    return this.integrationsRepository.findOneBy({
      user_id: userId,
      provider,
    });
  }

  async update(id: string, updateData: Partial<Integration>): Promise<Integration> {
    // Encrypt tokens if present
    if (updateData.oauth_access_token) {
      updateData.oauth_access_token = this.encryptionService.encrypt(
        updateData.oauth_access_token,
      );
    }
    if (updateData.oauth_refresh_token) {
      updateData.oauth_refresh_token = this.encryptionService.encrypt(
        updateData.oauth_refresh_token,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    await this.integrationsRepository.update({ id }, updateData as any);
    const integration = await this.findById(id);
    if (!integration) {
      throw new NotFoundException('Integration not found');
    }
    return integration;
  }

  async delete(id: string): Promise<void> {
    await this.integrationsRepository.update(id, { deleted_at: new Date() });
  }

  getAccessToken(integration: Integration): string {
    if (!integration.oauth_access_token) {
      throw new Error('No access token');
    }
    return this.encryptionService.decrypt(integration.oauth_access_token);
  }

  getRefreshToken(integration: Integration): string | null {
    if (!integration.oauth_refresh_token) {
      return null;
    }
    return this.encryptionService.decrypt(integration.oauth_refresh_token);
  }

  async refreshTokenIfNeeded(integration: Integration): Promise<string> {
    const now = new Date();
    if (integration.oauth_expires_at && integration.oauth_expires_at > now) {
      // Token still valid
      return this.getAccessToken(integration);
    }

    const refreshToken = this.getRefreshToken(integration);
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const newAccessToken = await this.oauthService.refreshAccessToken(
      integration.provider,
      refreshToken,
    );

    await this.update(integration.id, {
      oauth_access_token: newAccessToken,
      oauth_expires_at: new Date(Date.now() + 3600000), // 1 hour from now
    });

    return newAccessToken;
  }
}
