import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incident } from './entities/incident.entity';

@Injectable()
export class IncidentsService {
  constructor(
    @InjectRepository(Incident) private readonly incidents: Repository<Incident>,
  ) {}

  findByUser(userId: string, limit = 50): Promise<Incident[]> {
    return this.incidents
      .createQueryBuilder('incident')
      .innerJoin('incident.monitor', 'monitor')
      .where('monitor.user_id = :userId', { userId })
      .orderBy('incident.started_at', 'DESC')
      .take(limit)
      .getMany();
  }

  findByMonitor(monitorId: string): Promise<Incident[]> {
    return this.incidents.find({
      where: { monitorId },
      order: { startedAt: 'DESC' },
      take: 50,
    });
  }
}
