import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Monitor } from '../../monitors/entities/monitor.entity';

@Entity('checks')
export class Check {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'monitor_id' })
  monitorId: string;

  @Column({ name: 'status_code', nullable: true })
  statusCode: number | null;

  @Column({ name: 'response_time_ms', nullable: true })
  responseTimeMs: number | null;

  @Column({ name: 'is_up' })
  isUp: boolean;

  @Column({ nullable: true, type: 'text' })
  error: string | null;

  @CreateDateColumn({ name: 'checked_at' })
  checkedAt: Date;

  @ManyToOne(() => Monitor, (monitor) => monitor.checks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'monitor_id' })
  monitor: Monitor;
}
