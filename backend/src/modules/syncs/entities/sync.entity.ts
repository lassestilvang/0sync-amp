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
import { Integration } from '../../integrations/entities/integration.entity';
import { SyncState } from './sync-state.entity';
import { ObjectMapping } from './object-mapping.entity';

@Entity('syncs')
@Index(['user_id', 'created_at'])
@Index(['status'])
export class Sync {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  user_id!: string;

  @Column()
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  description?: string;

  @Column()
  source_integration_id!: string;

  @Column()
  source_type!: string;

  @Column({ type: 'jsonb', default: {} })
  source_config!: Record<string, unknown>;

  @Column()
  destination_integration_id!: string;

  @Column()
  destination_type!: string;

  @Column({ type: 'jsonb', default: {} })
  destination_config!: Record<string, unknown>;

  @Column({ type: 'varchar', default: 'bidirectional' })
  direction!: 'one_way' | 'bidirectional';

  @Column({ type: 'varchar', default: 'active' })
  status!: 'active' | 'paused' | 'error';

  @Column({ type: 'varchar', default: 'last_write_wins' })
  conflict_resolution!: 'last_write_wins' | 'manual';

  @Column({ type: 'jsonb', default: {} })
  field_mapping!: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  filter_config?: Record<string, unknown>;

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

  @ManyToOne(() => User, (user) => user.syncs)
  user!: User;

  @ManyToOne(() => Integration)
  source_integration!: Integration;

  @ManyToOne(() => Integration)
  destination_integration!: Integration;

  @OneToMany(() => SyncState, (state) => state.sync)
  sync_states!: SyncState[];

  @OneToMany(() => ObjectMapping, (mapping) => mapping.sync)
  object_mappings!: ObjectMapping[];
}
