import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TripMilestoneReminderService } from './trip-milestone-reminder.service';

@Injectable()
export class TripMilestoneReminderScheduler {
  private readonly logger = new Logger(TripMilestoneReminderScheduler.name);

  constructor(private readonly reminders: TripMilestoneReminderService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleTripMilestoneTick(): Promise<void> {
    try {
      const result = await this.reminders.runScheduledReminders();
      if (result.recorded > 0) {
        this.logger.debug(
          `Trip milestone tick: scanned=${result.scanned} recorded=${result.recorded}`,
        );
      }
    } catch (err) {
      this.logger.error(
        'Trip milestone reminder cron failed',
        err instanceof Error ? err.stack : err,
      );
    }
  }
}