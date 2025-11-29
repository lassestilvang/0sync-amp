import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Webhook } from '../../webhooks/entities/webhook.entity';

@Entity('integrations')
export class Integration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @Column()
  provider: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  oauth_access_token: string;

  @Column({ nullable: true })
  oauth_refresh_token: string;

  @Column({ nullable: true })
  oauth_expires_at: Date;

  @Column({ type: 'jsonb', default: {} })
  additional_config: Record<string, any>;

  @Column({ default: 'active' })
  status: 'active' | 'paused' | 'error';

  @Column({ nullable: true })
  last_error: string;

  @Column({ nullable: true })
  last_error_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ nullable: true })
  deleted_at: Date;

  @ManyToOne(() => User, (user) => user.integrations)
  user: User;

  @OneToMany(() => Webhook, (webhook) => webhook.integration)
  webhooks: Webhook[];
}
