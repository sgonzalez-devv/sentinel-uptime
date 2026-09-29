import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Check } from './entities/check.entity';

@Injectable()
export class ChecksService {
  constructor(
    @InjectRepository(Check) private readonly checks: Repository<Check>,
  ) {}

  findByMonitor(monitorId: string, limit = 100, offset = 0): Promise<[Check[], number]> {
    return this.checks.findAndCount({
      where: { monitorId },
      order: { checkedAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  getResponseTimeHistory(monitorId: string, hours = 24) {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    return this.checks.manager.query(
      `SELECT
        date_trunc('hour', checked_at) AS hour,
        ROUND(AVG(response_time_ms)) AS avg_ms,
        COUNT(*) FILTER (WHERE is_up) AS up_count,
        COUNT(*) AS total_count
       FROM checks
       WHERE monitor_id = $1 AND checked_at >= $2
       GROUP BY hour
       ORDER BY hour ASC`,
      [monitorId, since],
    );
  }
}
