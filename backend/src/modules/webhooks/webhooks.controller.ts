import { Controller, Post, Body, Param, Headers, BadRequestException, RawBody } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { ProvidersRegistry } from '../../providers/providers.registry';
import { createChildLogger } from '../../common/logger';

const logger = createChildLogger('WebhooksController');

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private webhooksService: WebhooksService,
    private providersRegistry: ProvidersRegistry,
  ) {}

  @Post(':provider/:id')
  @ApiOperation({ summary: 'Handle incoming webhook events from providers' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 400, description: 'Invalid signature or payload' })
  async handleWebhook(
    @Param('provider') provider: string,
    @Param('id') webhookId: string,
    @Body() payload: Record<string, unknown>,
    @RawBody() rawBody: Buffer,
    @Headers('x-signature') signature?: string,
    @Headers('x-todoist-hmac-sha256') todoistSignature?: string,
    @Headers('x-hub-signature-256') githubSignature?: string,
  ) {
    try {
      logger.info(`Received webhook from ${provider}: ${webhookId}`);

      // Get provider instance
      if (this.providersRegistry.has(provider)) {
        const providerInstance = this.providersRegistry.get(provider);

        // Verify webhook signature (provider-specific)
        if (providerInstance.verifyWebhookSignature) {
          const sig = signature || todoistSignature || githubSignature || '';
          const isValid = providerInstance.verifyWebhookSignature(sig, rawBody);

          if (!isValid) {
            logger.warn(`Invalid signature for ${provider} webhook: ${webhookId}`);
            throw new BadRequestException('Invalid webhook signature');
          }
        }
      }

      // Get event type from payload (varies by provider)
      const eventType =
        (payload.type as string | undefined) ||
        (payload.event as string | undefined) ||
        (payload.event_type as string | undefined) ||
        'unknown';

      // Record webhook event for async processing
      await this.webhooksService.recordEvent(webhookId, eventType, payload);

      logger.info(`Webhook recorded: ${provider}/${webhookId}`);

      return { success: true };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      logger.error(error, `Webhook processing failed: ${provider}/${webhookId}`);
      throw new BadRequestException('Webhook processing failed');
    }
  }
}
