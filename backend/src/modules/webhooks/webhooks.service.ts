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
    await this.webhookRepository.update(id, updates);
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
    payload: Record<string, any>,
  ): Promise<WebhookEvent> {
    const event = this.webhookEventRepository.create({
      webhook_id: webhookId,
      event_type: eventType,
      payload,
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
    await this.webhookEventRepository.update(eventId, {
      processed: true,
      processed_at: new Date(),
      error: error || null,
    });
  }
}
