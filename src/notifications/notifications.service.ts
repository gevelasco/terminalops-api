import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityEventsService } from 'src/activity-events/activity-events.service';
import { ExpensesService } from 'src/expenses/expenses.service';
import { Trip } from 'src/trips/entities/trip.entity';
import { OPERATIONAL_TZ } from 'src/reports/reports-filter.util';
import { NotificationsQueryDto } from './dto/notifications-query.dto';
import {
  notificationOverdueFetchFrom,
  resolveNotificationPeriodRange,
} from './notification-period.util';
import {
  buildComputedPaymentNotifications,
  buildReceivableDueNotifications,
  type NotificationFeedItemDto,
} from './notifications-computed.util';
import {
  mergeNotificationFeedItems,
  serializeActivityEventRow,
} from './notifications.serializer';

export interface NotificationsFeedResult {
  period: 'day' | 'week' | 'month';
  from: string;
  to: string;
  total: number;
  items: NotificationFeedItemDto[];
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly activityEvents: ActivityEventsService,
    private readonly expensesService: ExpensesService,
    @InjectRepository(Trip)
    private readonly tripsRepo: Repository<Trip>,
  ) {}

  async getFeed(
    companyId: number,
    query: NotificationsQueryDto,
  ): Promise<NotificationsFeedResult> {
    const period = query.period ?? 'day';
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const range = resolveNotificationPeriodRange(period);

    const [eventRows, computedRows] = await Promise.all([
      this.activityEvents.listForCompany(
        companyId,
        range.fromAt,
        range.toAt,
        limit,
      ),
      this.loadComputedNotifications(companyId, range),
    ]);

    const events = eventRows.map(serializeActivityEventRow);
    const items = mergeNotificationFeedItems(events, computedRows, limit);

    if (query.countOnly) {
      return {
        period: range.period,
        from: range.from,
        to: range.to,
        total: items.length,
        items: [],
      };
    }

    return {
      period: range.period,
      from: range.from,
      to: range.to,
      total: items.length,
      items,
    };
  }

  private async loadComputedNotifications(
    companyId: number,
    range: ReturnType<typeof resolveNotificationPeriodRange>,
  ): Promise<NotificationFeedItemDto[]> {
    const paymentFetchFrom = notificationOverdueFetchFrom(range.today);
    const [calendar, receivableRows] = await Promise.all([
      this.expensesService.getCalendar(companyId, {
        from: paymentFetchFrom,
        to: range.to,
        page: 1,
        limit: 0,
      }),
      this.queryReceivablesDue(companyId, range.from, range.to),
    ]);

    const payments = buildComputedPaymentNotifications(calendar.items, {
      from: range.from,
      to: range.to,
      today: range.today,
    });
    const receivables = buildReceivableDueNotifications(receivableRows);
    return [...payments, ...receivables];
  }

  private async queryReceivablesDue(
    companyId: number,
    from: string,
    to: string,
  ): Promise<
    Array<{
      trip_id: number;
      maneuver_code: string;
      client_name: string;
      due_date: string;
    }>
  > {
    return this.tripsRepo.query(
      `
      SELECT
        trip.id AS trip_id,
        COALESCE(NULLIF(TRIM(trip.maneuver_code), ''), CONCAT('M-', trip.id)) AS maneuver_code,
        COALESCE(NULLIF(TRIM(trip.client_name), ''), 'Sin cliente') AS client_name,
        ((trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date + trip.credit_days)::text AS due_date
      FROM ${this.tripsRepo.metadata.schema}.trips trip
      WHERE trip.company_id = $1
        AND trip.deleted_at IS NULL
        AND trip.client_collected_at IS NULL
        AND trip.completed_at IS NOT NULL
        AND trip.client_charge IS NOT NULL
        AND trip.client_charge::numeric > 0
        AND ((trip.completed_at AT TIME ZONE '${OPERATIONAL_TZ}')::date + trip.credit_days)
          BETWEEN $2::date AND $3::date
      ORDER BY due_date DESC, trip.id DESC
      LIMIT 100
      `,
      [companyId, from, to],
    );
  }
}
