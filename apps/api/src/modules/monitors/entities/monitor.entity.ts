import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Check } from '../../checks/entities/check.entity';
import { Incident } from '../../incidents/entities/incident.entity';

export enum MonitorStatus {
  UP = 'up',
  DOWN = 'down',
  PAUSED = 'paused',
  PENDING = 'pending',
}

@Entity('monitors')
export class Monitor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column()
  name: string;

  @Column()
  url: string;

  @Column({ name: 'interval_minutes', default: 5 })
  intervalMinutes: number;

  @Column({
    type: 'enum',
    enum: MonitorStatus,
    default: MonitorStatus.PENDING,
  })
  status: MonitorStatus;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'next_check_at', type: 'timestamptz', nullable: true })
  nextCheckAt: Date | null;

  @Column({ name: 'last_checked_at', type: 'timestamptz', nullable: true })
  lastCheckedAt: Date | null;

  @Column({ name: 'uptime_percentage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  uptimePercentage: number | null;

  @Column({ name: 'avg_response_ms', type: 'integer', nullable: true })
  avgResponseMs: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.monitors, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Check, (check) => check.monitor)
  checks: Check[];

  @OneToMany(() => Incident, (incident) => incident.monitor)
  incidents: Incident[];
}
