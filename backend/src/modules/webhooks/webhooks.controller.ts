import { Controller, Post, Body, Param, Headers, BadRequestException } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import { createChildLogger } from '../../common/logger';

const logger = createChildLogger('WebhooksController');

@Controller('webhooks')
export class WebhooksController {
  constructor(private webhooksService: WebhooksService) {}

  @Post(':provider/:id')
  async handleWebhook(
    @Param('provider') provider: string,
    @Param('id') webhookId: string,
    @Body() payload: Record<string, unknown>,
    @Headers('x-signature') signature?: string,
  ) {
    try {
      logger.info(`Received webhook from ${provider}: ${webhookId}`);

      // Verify webhook signature (provider-specific)
      // TODO: Implement per-provider signature verification
      void signature; // Mark as used to avoid unused variable warning

      // Get event type from payload (varies by provider)
      const eventType =
        (payload.type as string | undefined) ||
        (payload.event as string | undefined) ||
        'unknown';

      // Record webhook event for async processing
      await this.webhooksService.recordEvent(webhookId, eventType, payload);

      logger.info(`Webhook recorded: ${provider}/${webhookId}`);

      return { success: true };
    } catch (error) {
      logger.error(error, `Webhook processing failed: ${provider}/${webhookId}`);
      throw new BadRequestException('Webhook processing failed');
    }
  }
}
