import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Integration } from '../../integrations/entities/integration.entity';
import { WebhookEvent } from './webhook-event.entity';

@Entity('webhooks')
export class Webhook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  integration_id: string;

  @Column()
  provider: string;

  @Column({ unique: true })
  webhook_url: string;

  @Column({ nullable: true })
  webhook_secret: string;

  @Column('text', { array: true, default: () => "'{}'::text[]" })
  events: string[];

  @Column({ default: 'active' })
  status: 'active' | 'inactive' | 'error';

  @Column({ nullable: true })
  last_received_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Integration, (integ) => integ.webhooks)
  integration: Integration;

  @OneToMany(() => WebhookEvent, (event) => event.webhook)
  events_received: WebhookEvent[];
}
