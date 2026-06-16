import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TripLifecycleService } from './trip-lifecycle.service';

@Injectable()
export class TripLifecycleScheduler {
  private readonly logger = new Logger(TripLifecycleScheduler.name);

  constructor(private readonly lifecycleService: TripLifecycleService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleLifecycleTick(): Promise<void> {
    try {
      const result = await this.lifecycleService.runScheduledEvaluation();
      if (result.scanned > 0) {
        this.logger.debug(
          `Lifecycle tick: scanned=${result.scanned} transitioned=${result.transitioned}`,
        );
      }
    } catch (err) {
      this.logger.error('Lifecycle cron failed', err instanceof Error ? err.stack : err);
    }
  }
}
