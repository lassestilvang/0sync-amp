import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Webhook } from './webhook.entity';

@Entity('webhook_events')
@Index(['processed'])
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  webhook_id: string;

  @Column()
  event_type: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ default: false })
  processed: boolean;

  @Column({ nullable: true })
  error: string;

  @Column({ nullable: true })
  processed_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Webhook, (webhook) => webhook.events_received)
  webhook: Webhook;
}
