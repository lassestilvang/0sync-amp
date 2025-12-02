import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Integration } from '../../integrations/entities/integration.entity';
import { Sync } from '../../syncs/entities/sync.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ type: 'varchar', nullable: true })
  password_hash!: string | null;

  @Column({ type: 'varchar', nullable: true })
  full_name!: string | null;

  @Column({ type: 'varchar', nullable: true })
  avatar_url!: string | null;

  @Column({ type: 'varchar', default: 'password' })
  auth_method!: 'password' | 'oauth' | 'saml';

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  deleted_at!: Date | null;

  @OneToMany(() => Integration, (integ) => integ.user)
  integrations!: Integration[];

  @OneToMany(() => Sync, (sync) => sync.user)
  syncs!: Sync[];
}
