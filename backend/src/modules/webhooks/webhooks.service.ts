/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webhook } from './entities/webhook.entity';
import { WebhookEvent } from './entities/webhook-event.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(Webhook)
    private webhookRepository: Repository<Webhook>,
    @InjectRepository(WebhookEvent)
    private webhookEventRepository: Repository<WebhookEvent>,
  ) {}

  async create(webhookData: Partial<Webhook>): Promise<Webhook> {
    const webhook = this.webhookRepository.create({
      ...webhookData,
      webhook_url: `${process.env.API_URL}/webhooks/${webhookData.provider}/${uuidv4()}`,
      webhook_secret: uuidv4(),
    });
    return this.webhookRepository.save(webhook);
  }
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

  async findById(id: string): Promise<Webhook | null> {
    return this.webhookRepository.findOne({
      where: { id },
      relations: ['integration'],
    });
  }

  async findByIntegration(integrationId: string): Promise<Webhook[]> {
    return this.webhookRepository.find({
      where: { integration_id: integrationId },
    });
  }

  async update(id: string, updates: Partial<Webhook>): Promise<Webhook> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
    await this.webhookRepository.update({ id }, updates as any);
    const webhook = await this.findById(id);
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    return webhook;
  }

  async delete(id: string): Promise<void> {
    await this.webhookRepository.delete(id);
  }

  async recordEvent(
    webhookId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<WebhookEvent> {
    const event = this.webhookEventRepository.create({
      webhook_id: webhookId,
      event_type: eventType,
      payload: payload,
      processed: false,
    });

    // Update webhook last_received_at
    await this.webhookRepository.update(webhookId, {
      last_received_at: new Date(),
    });

    return this.webhookEventRepository.save(event);
  }

  async findUnprocessedEvents(limit: number = 100): Promise<WebhookEvent[]> {
    return this.webhookEventRepository.find({
      where: { processed: false },
      relations: ['webhook'],
      take: limit,
      order: { created_at: 'ASC' },
    });
  }

  async markEventProcessed(eventId: string, error?: string): Promise<void> {
    await this.webhookEventRepository.update({ id: eventId }, {
      processed: true,
      processed_at: new Date(),
      error: error || undefined,
    });
  }
}
