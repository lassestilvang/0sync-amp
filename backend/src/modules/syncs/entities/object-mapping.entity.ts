import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { Sync } from './sync.entity';

@Entity('object_mappings')
@Index(['sync_id', 'source_object_id', 'destination_object_id'], { unique: true })
@Index(['source_provider', 'source_object_id'])
@Index(['destination_provider', 'destination_object_id'])
export class ObjectMapping {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  sync_id!: string;

  @Column()
  source_object_id!: string;

  @Column()
  source_provider!: string;

  @Column()
  destination_object_id!: string;

  @Column()
  destination_provider!: string;

  @Column({ type: 'varchar', nullable: true })
  source_checksum!: string | null;

  @Column({ type: 'varchar', nullable: true })
  destination_checksum!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  synced_at!: Date | null;

  @Column({ default: false })
  conflict_flag!: boolean;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @ManyToOne(() => Sync, (sync) => sync.object_mappings)
  sync!: Sync;
}
