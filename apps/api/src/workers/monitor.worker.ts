import { DataSource, LessThanOrEqual } from 'typeorm';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Monitor, MonitorStatus } from '../modules/monitors/entities/monitor.entity';
import { Check } from '../modules/checks/entities/check.entity';
import { Incident } from '../modules/incidents/entities/incident.entity';

const sqs = new SQSClient({ region: process.env.AWS_REGION ?? 'us-east-1' });

async function pingUrl(url: string): Promise<{ isUp: boolean; statusCode: number | null; responseTimeMs: number; error: string | null }> {
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    return {
      isUp: res.status < 500,
      statusCode: res.status,
      responseTimeMs: Date.now() - start,
      error: null,
    };
  } catch (err: unknown) {
    return {
      isUp: false,
      statusCode: null,
      responseTimeMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

async function processMonitor(ds: DataSource, monitor: Monitor): Promise<void> {
  const result = await pingUrl(monitor.url);

  const checkRepo = ds.getRepository(Check);
  const incidentRepo = ds.getRepository(Incident);
  const monitorRepo = ds.getRepository(Monitor);

  await checkRepo.save({
    monitorId: monitor.id,
    isUp: result.isUp,
    statusCode: result.statusCode,
    responseTimeMs: result.responseTimeMs,
    error: result.error,
  });

  const wasDown = monitor.status === MonitorStatus.DOWN;
  const isNowDown = !result.isUp;

  if (!wasDown && isNowDown) {
    const incident = incidentRepo.create({
      monitorId: monitor.id,
      startedAt: new Date(),
      cause: result.error ?? `HTTP ${result.statusCode}`,
    });
    await incidentRepo.save(incident);

    if (process.env.SQS_ALERT_QUEUE_URL) {
      await sqs.send(new SendMessageCommand({
        QueueUrl: process.env.SQS_ALERT_QUEUE_URL,
        MessageBody: JSON.stringify({ type: 'incident.opened', monitorId: monitor.id, url: monitor.url }),
      }));
    }
  }

  if (wasDown && result.isUp) {
    const openIncident = await incidentRepo.findOne({
      where: { monitorId: monitor.id, resolvedAt: undefined },
      order: { startedAt: 'DESC' },
    });
    if (openIncident) {
      openIncident.resolvedAt = new Date();
      openIncident.durationMs = openIncident.resolvedAt.getTime() - openIncident.startedAt.getTime();
      await incidentRepo.save(openIncident);

      if (process.env.SQS_ALERT_QUEUE_URL) {
        await sqs.send(new SendMessageCommand({
          QueueUrl: process.env.SQS_ALERT_QUEUE_URL,
          MessageBody: JSON.stringify({ type: 'incident.resolved', monitorId: monitor.id, url: monitor.url }),
        }));
      }
    }
  }

  const nextCheck = new Date();
  nextCheck.setMinutes(nextCheck.getMinutes() + monitor.intervalMinutes);

  await monitorRepo.update(monitor.id, {
    status: result.isUp ? MonitorStatus.UP : MonitorStatus.DOWN,
    lastCheckedAt: new Date(),
    nextCheckAt: nextCheck,
  });
}

export async function handler(): Promise<void> {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [Monitor, Check, Incident],
    ssl: { rejectUnauthorized: false },
  });

  await ds.initialize();

  try {
    const monitors = await ds.getRepository(Monitor).find({
      where: {
        isActive: true,
        nextCheckAt: LessThanOrEqual(new Date()),
      },
    });

    await Promise.allSettled(monitors.map((m) => processMonitor(ds, m)));
  } finally {
    await ds.destroy();
  }
}
