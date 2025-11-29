import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Sync } from './sync.entity';

@Entity('sync_states')
export class SyncState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sync_id: string;

  @Column({ nullable: true })
  last_sync_at: Date;

  @Column({ nullable: true })
  source_cursor: string;

  @Column({ nullable: true })
  destination_cursor: string;

  @Column({ nullable: true })
  last_conflict_at: Date;

  @Column({ default: 0 })
  conflict_count: number;

  @Column({ nullable: true })
  backoff_until: Date;

  @Column({ default: 0 })
  retry_count: number;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Sync, (sync) => sync.sync_states)
  sync: Sync;
}
