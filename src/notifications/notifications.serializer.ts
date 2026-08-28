import { CompanyActivityEvent } from 'src/activity-events/entities/company-activity-event.entity';
import type { NotificationFeedItemDto } from './notifications-computed.util';

function iconForActivityKind(kind: string): string {
  if (kind.startsWith('bitacora.')) {
    return 'document';
  }
  if (kind.startsWith('incident.')) {
    return 'warning';
  }
  if (kind.includes('unit.')) {
    return 'unit';
  }
  if (kind.includes('equipment.')) {
    return 'equipment';
  }
  if (kind.startsWith('client.')) {
    return 'client';
  }
  if (kind.startsWith('expense.')) {
    return 'settlement';
  }
  if (kind.startsWith('payment.')) {
    return 'settlement';
  }
  if (kind.startsWith('trip.')) {
    return 'route';
  }
  if (kind.startsWith('operator.')) {
    return 'person';
  }
  if (kind.startsWith('coverage.')) {
    return 'document';
  }
  return 'updates';
}

export function serializeActivityEventRow(
  row: CompanyActivityEvent,
): NotificationFeedItemDto {
  const tone = row.kind === 'payment.overdue'
    ? 'danger'
    : row.kind === 'payment.due_today' || row.kind === 'payment.due_soon'
      ? 'warning'
      : row.kind.startsWith('incident.')
        ? 'danger'
        : 'neutral';
  return {
    id: `event:${row.id}`,
    kind: row.kind,
    origin: 'event',
    icon: iconForActivityKind(row.kind),
    title: row.title,
    subjectLabel: row.subjectLabel,
    occurredAt: row.occurredAt.toISOString(),
    actorLabel: row.actorLabel?.trim() || 'Sistema',
    tone,
    entityType: row.entityType,
    entityId: row.entityId,
  };
}

export function mergeNotificationFeedItems(
  events: NotificationFeedItemDto[],
  computed: NotificationFeedItemDto[],
  limit: number,
): NotificationFeedItemDto[] {
  const persistedPaymentKeys = new Set(
    events
      .filter((item) => item.kind.startsWith('payment.') && item.entityId)
      .map((item) => `${item.kind}:${item.entityId}`),
  );
  const computedWithoutDupes = computed.filter((item) => {
    if (!item.kind.startsWith('payment.') || !item.entityId) {
      return true;
    }
    return !persistedPaymentKeys.has(`${item.kind}:${item.entityId}`);
  });
  const merged = [...events, ...computedWithoutDupes];
  merged.sort(
    (a, b) =>
      b.occurredAt.localeCompare(a.occurredAt) ||
      a.title.localeCompare(b.title, 'es'),
  );
  return merged.slice(0, limit);
}
