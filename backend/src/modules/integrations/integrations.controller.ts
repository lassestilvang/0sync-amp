import { Controller, Get, Post, Delete, UseGuards, Param, Query, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IntegrationsService } from './integrations.service';
import { OAuthService } from './services/oauth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('integrations')
export class IntegrationsController {
  constructor(
    private integrationsService: IntegrationsService,
    private oauthService: OAuthService,
  ) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async list(@CurrentUser() user: User) {
    return this.integrationsService.findByUser(user.id);
  }

  @Get(':provider/authorize')
  async startOAuth(@Param('provider') provider: string) {
    const authUrl = this.oauthService.getAuthorizationUrl(provider);
    return { authUrl };
  }

  @Post(':provider/callback')
  @HttpCode(200)
  async handleOAuthCallback(
    @Param('provider') provider: string,
    @Query() query: { code: string; state: string },
    @CurrentUser() user: User,
  ) {
    const { code, state } = query;

    const tokens = await this.oauthService.exchangeAuthorizationCode(provider, code, state);

    const integration = await this.integrationsService.create(user.id, {
      provider,
      name: provider,
      oauth_access_token: tokens.accessToken,
      oauth_refresh_token: tokens.refreshToken,
      oauth_expires_at: tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : undefined,
      status: 'active',
    });

    return {
      id: integration.id,
      provider: integration.provider,
      status: integration.status,
    };
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  async disconnect(@Param('id') id: string, @CurrentUser() user: User) {
    const integration = await this.integrationsService.findById(id);
    if (!integration || integration.user_id !== user.id) {
      throw new Error('Integration not found');
    }

    await this.integrationsService.delete(id);
    return { message: 'Integration disconnected' };
  }
}
