import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentReminderService } from './payment-reminder.service';

@Injectable()
export class PaymentReminderScheduler {
  private readonly logger = new Logger(PaymentReminderScheduler.name);

  constructor(private readonly reminders: PaymentReminderService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handlePaymentReminderTick(): Promise<void> {
    try {
      const result = await this.reminders.runScheduledReminders();
      if (result.recorded > 0) {
        this.logger.debug(
          `Payment reminder tick: scanned=${result.scanned} recorded=${result.recorded}`,
        );
      }
    } catch (err) {
      this.logger.error(
        'Payment reminder cron failed',
        err instanceof Error ? err.stack : err,
      );
    }
  }
}
