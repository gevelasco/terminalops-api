import type { DestinationRate } from 'src/destination-rates/entities/destination-rate.entity';

/** Jornada operativa de referencia para convertir horas → días en resumen de operador. */
export const OPERATOR_WORKED_HOURS_PER_DAY = 16;

type RateTimeFields = Pick<
  DestinationRate,
  'estimatedArrivalTimeValue' | 'estimatedReturnTimeValue'
>;

export function parseEstimatedRateHours(raw?: string | null): number {
  if (raw == null || raw === '') {
    return 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Horas redondas (ida + vuelta) según tiempos de la tarifa destino. */
export function roundTripHoursFromDestinationRate(rate: RateTimeFields): number {
  const arrival = parseEstimatedRateHours(rate.estimatedArrivalTimeValue);
  const ret = parseEstimatedRateHours(rate.estimatedReturnTimeValue);
  if (arrival <= 0 || ret <= 0) {
    return 0;
  }
  return arrival + ret;
}

export function computeOperatorWorkedHoursFromTrips(
  completedTrips: readonly { destinationRateId?: number | null }[],
  ratesById: ReadonlyMap<number, RateTimeFields>,
): { workedHours: number; workedDays: number } {
  let totalHours = 0;
  for (const trip of completedTrips) {
    const rateId = trip.destinationRateId;
    if (rateId == null) {
      continue;
    }
    const rate = ratesById.get(rateId);
    if (!rate) {
      continue;
    }
    totalHours += roundTripHoursFromDestinationRate(rate);
  }
  const workedHours = Math.round(totalHours * 10) / 10;
  const workedDays =
    workedHours > 0
      ? Math.round((workedHours / OPERATOR_WORKED_HOURS_PER_DAY) * 10) / 10
      : 0;
  return { workedHours, workedDays };
}