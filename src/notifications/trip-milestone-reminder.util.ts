import type { Trip } from 'src/trips/entities/trip.entity';
import {
  tripOperativeArrivalAt,
  tripOperativeCompletionAt,
  tripOperativeDepartureAt,
} from 'src/trips/trip-operative-schedule.util';

export type TripMilestoneReminderId =
  | 'load'
  | 'departure'
  | 'arrival'
  | 'completion'
  | 'empty_delivery';

const ONE_HOUR_MS = 60 * 60 * 1000;

export const TRIP_MILESTONE_REMINDER_KIND: Record<
  TripMilestoneReminderId,
  string
> = {
  load: 'trip.reminder.load',
  departure: 'trip.reminder.departure',
  arrival: 'trip.reminder.arrival',
  completion: 'trip.reminder.completion',
  empty_delivery: 'trip.reminder.empty_delivery',
};

export const TRIP_MILESTONE_REMINDER_BODY: Record<
  TripMilestoneReminderId,
  string
> = {
  load: 'Confirma que el operador ya está en camino a cargar.',
  departure: 'Revisa que no haga falta nada; la unidad está por salir a ruta.',
  arrival: 'La unidad está por llegar con el cliente; coordina su llegada.',
  completion: 'La unidad está por llegar al origen.',
  empty_delivery: 'La unidad está por entregar vacío; coordina la cita.',
};

function tripManeuverSubject(trip: Trip): string {
  const code = trip.maneuverCode?.trim() || `M-${trip.id}`;
  const client = trip.clientName?.trim() || 'Sin cliente';
  return `${code} · ${client}`;
}

export function tripMilestoneReminderDedupeKey(
  tripId: number,
  milestone: TripMilestoneReminderId,
  eventAtIso: string,
): string {
  return `trip_milestone:${tripId}:${milestone}:${eventAtIso}`;
}

/**
 * Recordatorio preventivo desde T−1h hasta el hito.
 * El cron puede reintentar cada minuto; `dedupeKey` evita duplicados.
 * Si el horario se acorta a menos de 1 h, dispara en el siguiente tick.
 */
export function isInTripMilestoneReminderWindow(
  eventAt: Date,
  nowMs: number,
): boolean {
  const eventMs = eventAt.getTime();
  if (!Number.isFinite(eventMs) || eventMs <= nowMs) {
    return false;
  }
  const remindAt = eventMs - ONE_HOUR_MS;
  return nowMs >= remindAt;
}

type MilestoneCandidate = {
  id: TripMilestoneReminderId;
  at: Date | null | undefined;
};

function milestonesForTrip(trip: Trip): MilestoneCandidate[] {
  const status = trip.status?.trim();
  const items: MilestoneCandidate[] = [];

  if (status === 'scheduled' && trip.loadDate) {
    items.push({ id: 'load', at: trip.loadDate });
  }
  if (status === 'scheduled' || status === 'in_transit') {
    items.push({ id: 'departure', at: tripOperativeDepartureAt(trip) });
    items.push({ id: 'arrival', at: tripOperativeArrivalAt(trip) });
    items.push({ id: 'completion', at: tripOperativeCompletionAt(trip) });
  }
  if (trip.emptyDeliveryAt && trip.emptyDeliveryPlace?.trim()) {
    items.push({ id: 'empty_delivery', at: trip.emptyDeliveryAt });
  }
  return items;
}

export function tripMilestoneRemindersDue(
  trip: Trip,
  nowMs: number,
): Array<{
  milestone: TripMilestoneReminderId;
  kind: string;
  title: string;
  subjectLabel: string;
  eventAt: Date;
  dedupeKey: string;
}> {
  if (trip.status !== 'scheduled' && trip.status !== 'in_transit') {
    return [];
  }
  const subjectLabel = tripManeuverSubject(trip);
  const out: Array<{
    milestone: TripMilestoneReminderId;
    kind: string;
    title: string;
    subjectLabel: string;
    eventAt: Date;
    dedupeKey: string;
  }> = [];

  for (const { id, at } of milestonesForTrip(trip)) {
    if (!at || !(at instanceof Date) || Number.isNaN(at.getTime())) {
      continue;
    }
    if (!isInTripMilestoneReminderWindow(at, nowMs)) {
      continue;
    }
    const eventAtIso = at.toISOString();
    out.push({
      milestone: id,
      kind: TRIP_MILESTONE_REMINDER_KIND[id],
      title: TRIP_MILESTONE_REMINDER_BODY[id],
      subjectLabel,
      eventAt: at,
      dedupeKey: tripMilestoneReminderDedupeKey(trip.id, id, eventAtIso),
    });
  }
  return out;
}

/**
 * SQL: hitos en la hora previa (T−1h ya pasó y el evento aún no).
 * event ∈ (now, now+1h]
 */
export function tripMilestoneReminderWindowSql(alias: string): string {
  const a = alias;
  return `(
    (${a}.status = 'scheduled' AND ${a}.load_date IS NOT NULL AND ${a}.load_date > :now AND ${a}.load_date <= :nowPlus1h)
    OR (COALESCE(${a}.departure_at, ${a}.planned_departure_at) > :now AND COALESCE(${a}.departure_at, ${a}.planned_departure_at) <= :nowPlus1h)
    OR (COALESCE(${a}.arrived_at, ${a}.planned_arrival_at) > :now AND COALESCE(${a}.arrived_at, ${a}.planned_arrival_at) <= :nowPlus1h)
    OR (COALESCE(${a}.return_at, ${a}.planned_completion_at) > :now AND COALESCE(${a}.return_at, ${a}.planned_completion_at) <= :nowPlus1h)
    OR (
      ${a}.empty_delivery_at IS NOT NULL
      AND NULLIF(TRIM(${a}.empty_delivery_place), '') IS NOT NULL
      AND ${a}.empty_delivery_at > :now
      AND ${a}.empty_delivery_at <= :nowPlus1h
    )
  )`;
}
