import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_logs')
@Index(['user_id', 'created_at'])
@Index(['created_at'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true })
  user_id?: string;

  @Column({ nullable: true })
  sync_id?: string;

  @Column()
  action!: string;

  @Column({ nullable: true })
  resource_type?: string;

  @Column({ nullable: true })
  resource_id?: string;

  @Column({ type: 'jsonb', nullable: true })
  changes?: Record<string, any>;

  @Column({ nullable: true })
  status?: 'success' | 'error';

  @Column({ nullable: true })
  error_message?: string;

  @CreateDateColumn()
  created_at!: Date;
}
