import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ActivityEventsService } from 'src/activity-events/activity-events.service';
import { Company } from 'src/companies/entities/company.entity';
import { Expense } from 'src/expenses/entities/expense.entity';
import { formatOperationalIncurredDateYmd } from 'src/expenses/expenses-incurred-at.util';
import { applyUnpaidScheduledLedgerRange } from 'src/expenses/unpaid-scheduled-ledger.query';
import {
  notificationOverdueFetchFrom,
  ymdAddDays,
} from './notification-period.util';
import {
  classifyPaymentReminder,
  isLedgerScheduledPaymentKind,
  normalizePaymentReminderDays,
  PAYMENT_REMINDER_DAYS_MAX,
  paymentReminderDedupeKey,
  paymentReminderEventKind,
  paymentReminderTitle,
} from './payment-reminder.util';

/** Distinto de migrate (002), lifecycle (001) y fleet bootstrap (003). */
const PAYMENT_REMINDER_CRON_LOCK_KEY = 74_027_004;

function operationalTodayYmd(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

@Injectable()
export class PaymentReminderService {
  private readonly logger = new Logger(PaymentReminderService.name);
  private cronInProgress = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly activityEvents: ActivityEventsService,
    @InjectRepository(Company)
    private readonly companies: Repository<Company>,
    @InjectRepository(Expense)
    private readonly expenses: Repository<Expense>,
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
    const today = operationalTodayYmd(now);
    const fetchFrom = notificationOverdueFetchFrom(today);
    const fetchTo = ymdAddDays(today, PAYMENT_REMINDER_DAYS_MAX);
    const [companies, expenses] = await Promise.all([
      this.companies.find({ select: ['id', 'paymentReminderDaysBefore'] }),
      applyUnpaidScheduledLedgerRange(
        this.expenses.createQueryBuilder('e'),
        { from: fetchFrom, to: fetchTo },
      ).getMany(),
    ]);

    const daysByCompany = new Map(
      companies.map((company) => [
        company.id,
        normalizePaymentReminderDays(company.paymentReminderDaysBefore),
      ]),
    );

    let recorded = 0;
    for (const expense of expenses) {
      if (!isLedgerScheduledPaymentKind(expense.kind)) {
        continue;
      }
      const daysBefore = daysByCompany.get(expense.companyId);
      if (daysBefore == null) {
        continue;
      }
      const dueYmd = formatOperationalIncurredDateYmd(expense.incurredAt);
      const soonUntil = ymdAddDays(today, daysBefore);
      const urgency = classifyPaymentReminder(dueYmd, today, soonUntil);
      if (!urgency) {
        continue;
      }
      const inserted = await this.activityEvents.record({
        companyId: expense.companyId,
        kind: paymentReminderEventKind(urgency),
        entityType: 'expense',
        entityId: expense.id,
        subjectLabel: expense.description?.trim() || expense.category || '—',
        title: paymentReminderTitle(expense.kind, urgency),
        occurredAt: now,
        metadata: {
          expenseKind: expense.kind,
          dueYmd,
          urgency,
        },
        dedupeKey: paymentReminderDedupeKey(urgency, expense.id, dueYmd),
      });
      if (inserted) {
        recorded += 1;
      }
    }

    if (recorded > 0) {
      this.logger.debug(
        `Payment reminders: scanned=${expenses.length} recorded=${recorded}`,
      );
    }
    return { scanned: expenses.length, recorded };
  }

  private async tryAcquireCronLock(): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT pg_try_advisory_lock($1) AS acquired`,
      [PAYMENT_REMINDER_CRON_LOCK_KEY],
    );
    return Boolean(rows?.[0]?.acquired);
  }

  private async releaseCronLock(): Promise<void> {
    await this.dataSource.query(`SELECT pg_advisory_unlock($1)`, [
      PAYMENT_REMINDER_CRON_LOCK_KEY,
    ]);
  }
}
