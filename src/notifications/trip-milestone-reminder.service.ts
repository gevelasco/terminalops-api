import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ActivityEventsService } from 'src/activity-events/activity-events.service';
import { Trip } from 'src/trips/entities/trip.entity';
import {
  tripMilestoneReminderWindowSql,
  tripMilestoneRemindersDue,
} from './trip-milestone-reminder.util';

const TRIP_MILESTONE_CRON_LOCK_KEY = 74_027_005;
const ONE_HOUR_MS = 60 * 60 * 1000;

@Injectable()
export class TripMilestoneReminderService {
  private readonly logger = new Logger(TripMilestoneReminderService.name);
  private cronInProgress = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly activityEvents: ActivityEventsService,
    @InjectRepository(Trip)
    private readonly tripsRepo: Repository<Trip>,
  ) {}

  async runScheduledReminders(now = new Date()): Promise<{
    scanned: number;
    recorded: number;
  }> {
    if (this.cronInProgress) {
      return { scanned: 0, recorded: 0 };
    }
    this.cronInProgress = true;
    try {
      const lockAcquired = await this.tryAcquireCronLock();
      if (!lockAcquired) {
        return { scanned: 0, recorded: 0 };
      }
      try {
        return await this.runScheduledRemindersLocked(now);
      } finally {
        await this.releaseCronLock();
      }
    } finally {
      this.cronInProgress = false;
    }
  }

  private async runScheduledRemindersLocked(now: Date): Promise<{
    scanned: number;
    recorded: number;
  }> {
    const nowMs = now.getTime();
    const nowPlus1h = new Date(nowMs + ONE_HOUR_MS);
    const trips = await this.tripsRepo
      .createQueryBuilder('trip')
      .where('trip.status IN (:...statuses)', {
        statuses: ['scheduled', 'in_transit'],
      })
      .andWhere('trip.deletedAt IS NULL')
      .andWhere(tripMilestoneReminderWindowSql('trip'), {
        now,
        nowPlus1h,
      })
      .getMany();

    let recorded = 0;
    for (const trip of trips) {
      const due = tripMilestoneRemindersDue(trip, nowMs);
      for (const item of due) {
        const inserted = await this.activityEvents.record({
          companyId: trip.companyId,
          kind: item.kind,
          entityType: 'trip',
          entityId: trip.id,
          subjectLabel: item.subjectLabel,
          title: item.title,
          occurredAt: now,
          actor: null,
          metadata: {
            tripId: trip.id,
            milestone: item.milestone,
            eventAt: item.eventAt.toISOString(),
            entityTab: 'tracking',
          },
          dedupeKey: item.dedupeKey,
        });
        if (inserted) {
          recorded += 1;
        }
      }
    }

    if (recorded > 0) {
      this.logger.debug(
        `Trip milestone reminders: scanned=${trips.length} recorded=${recorded}`,
      );
    }
    return { scanned: trips.length, recorded };
  }

  private async tryAcquireCronLock(): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT pg_try_advisory_lock($1) AS acquired`,
      [TRIP_MILESTONE_CRON_LOCK_KEY],
    );
    return Boolean(rows?.[0]?.acquired);
  }

  private async releaseCronLock(): Promise<void> {
    await this.dataSource.query(`SELECT pg_advisory_unlock($1)`, [
      TRIP_MILESTONE_CRON_LOCK_KEY,
    ]);
  }
}
