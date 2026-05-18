import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Webhook } from '../../webhooks/entities/webhook.entity';

@Entity('integrations')
@Index(['user_id', 'provider'])
@Index(['status'])
@Index(['created_at'])
export class Integration {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  user_id!: string;

  @Column()
  provider!: string;

  @Column({ type: 'varchar', nullable: true })
  name?: string;

  @Column({ type: 'varchar', nullable: true })
  oauth_access_token?: string;

  @Column({ type: 'varchar', nullable: true })
  oauth_refresh_token?: string;

  @Column({ type: 'timestamp', nullable: true })
  oauth_expires_at?: Date;

  @Column({ type: 'jsonb', default: {} })
  additional_config!: Record<string, unknown>;

  @Column({ type: 'varchar', default: 'active' })
  status!: 'active' | 'paused' | 'error';

  @Column({ type: 'varchar', nullable: true })
  last_error?: string;

  @Column({ type: 'timestamp', nullable: true })
  last_error_at?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  deleted_at?: Date;

  @ManyToOne(() => User, (user) => user.integrations)
  user!: User;

  @OneToMany(() => Webhook, (webhook) => webhook.integration)
  webhooks!: Webhook[];
}
