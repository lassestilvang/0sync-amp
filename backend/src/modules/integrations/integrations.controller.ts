import { Controller, Get, Post, Delete, UseGuards, Param, Query, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { OAuthService } from './services/oauth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private integrationsService: IntegrationsService,
    private oauthService: OAuthService,
  ) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'List all integrations for the current user' })
  @ApiResponse({ status: 200, description: 'Return all integrations' })
  async list(@CurrentUser() user: User) {
    return this.integrationsService.findByUser(user.id);
  }

  @Get(':provider/authorize')
  @ApiOperation({ summary: 'Get the authorization URL for a provider' })
  @ApiResponse({ status: 200, description: 'Return the auth URL' })
  startOAuth(@Param('provider') provider: string) {
    const authUrl = this.oauthService.getAuthorizationUrl(provider);
    return { authUrl };
  }

  @Post(':provider/callback')
  @HttpCode(200)
  @ApiOperation({ summary: 'Handle OAuth callback and create integration' })
  @ApiResponse({ status: 200, description: 'Integration created' })
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
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Disconnect an integration' })
  @ApiResponse({ status: 200, description: 'Integration disconnected' })
  async disconnect(@Param('id') id: string, @CurrentUser() user: User) {
    const integration = await this.integrationsService.findById(id);
    if (!integration || integration.user_id !== user.id) {
      throw new Error('Integration not found');
    }

    await this.integrationsService.delete(id);
    return { message: 'Integration disconnected' };
  }
}
