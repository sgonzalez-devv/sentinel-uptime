import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Monitor, MonitorStatus } from './entities/monitor.entity';
import { CreateMonitorDto } from './dto/create-monitor.dto';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class MonitorsService {
  constructor(
    @InjectRepository(Monitor) private readonly monitors: Repository<Monitor>,
  ) {}

  async create(user: User, dto: CreateMonitorDto): Promise<Monitor> {
    const monitor = this.monitors.create({
      ...dto,
      userId: user.id,
      status: MonitorStatus.PENDING,
      nextCheckAt: new Date(),
    });
    return this.monitors.save(monitor);
  }

  findAll(user: User): Promise<Monitor[]> {
    return this.monitors.find({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(user: User, id: string): Promise<Monitor> {
    const monitor = await this.monitors.findOne({ where: { id } });
    if (!monitor) throw new NotFoundException('Monitor not found');
    if (monitor.userId !== user.id) throw new ForbiddenException();
    return monitor;
  }

  async update(user: User, id: string, dto: Partial<CreateMonitorDto>): Promise<Monitor> {
    const monitor = await this.findOne(user, id);
    Object.assign(monitor, dto);
    return this.monitors.save(monitor);
  }

  async togglePause(user: User, id: string): Promise<Monitor> {
    const monitor = await this.findOne(user, id);
    monitor.isActive = !monitor.isActive;
    monitor.status = monitor.isActive ? MonitorStatus.PENDING : MonitorStatus.PAUSED;
    return this.monitors.save(monitor);
  }

  async remove(user: User, id: string): Promise<void> {
    const monitor = await this.findOne(user, id);
    await this.monitors.remove(monitor);
  }

  async getMetrics(user: User, id: string, days = 30) {
    const monitor = await this.findOne(user, id);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const result = await this.monitors.manager.query(
      `SELECT
        COUNT(*) FILTER (WHERE is_up) AS up_count,
        COUNT(*) AS total_count,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time_ms) AS p50_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) AS p95_ms,
        AVG(response_time_ms) AS avg_ms
       FROM checks
       WHERE monitor_id = $1 AND checked_at >= $2`,
      [monitor.id, since],
    );

    const row = result[0];
    return {
      monitorId: monitor.id,
      uptimePercentage: row.total_count > 0
        ? ((row.up_count / row.total_count) * 100).toFixed(2)
        : null,
      p50Ms: row.p50_ms ? Math.round(row.p50_ms) : null,
      p95Ms: row.p95_ms ? Math.round(row.p95_ms) : null,
      avgMs: row.avg_ms ? Math.round(row.avg_ms) : null,
      totalChecks: parseInt(row.total_count),
      periodDays: days,
    };
  }
}
