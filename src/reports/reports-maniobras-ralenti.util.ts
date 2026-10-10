/** Tramo operativo para ralenti de maniobra. */
export type ManiobraRalentiLeg = 'salida_cliente' | 'cliente_regreso';

export type ManiobraRalentiBaselineSource = 'rate' | 'planned';

export type ManiobraRalentiTripInput = {
  tripId: number;
  maneuverCode: string;
  clientName: string;
  destination: string;
  plannedDepartureAt: Date | string | null;
  plannedArrivalAt: Date | string | null;
  plannedCompletionAt: Date | string | null;
  departureAt: Date | string | null;
  arrivedAt: Date | string | null;
  returnAt: Date | string | null;
  estimatedArrivalTimeValue: string | number | null;
  estimatedReturnTimeValue: string | number | null;
  estimatedTimeUnit: string | null;
};

export type ManiobraRalentiEvent = {
  tripId: number;
  maneuverCode: string;
  clientName: string;
  destination: string;
  leg: ManiobraRalentiLeg;
  plannedHours: number;
  actualHours: number;
  baselineHours: number;
  baselineSource: ManiobraRalentiBaselineSource;
  ralentiHours: number;
};

export type ManiobraRalentiReport = {
  totalHours: number;
  salidaClienteHours: number;
  clienteRegresoHours: number;
  tripsEvaluated: number;
  tripsWithRalenti: number;
};

const MIN_RALENTI_HOURS = 0.05; // ~3 min — evita ruido de redondeo

function toDate(raw: Date | string | null | undefined): Date | null {
  if (raw == null || raw === '') {
    return null;
  }
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hoursBetween(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined,
): number | null {
  const from = toDate(start);
  const to = toDate(end);
  if (!from || !to) {
    return null;
  }
  const hours = (to.getTime() - from.getTime()) / 3_600_000;
  if (!Number.isFinite(hours) || hours <= 0) {
    return null;
  }
  return hours;
}

function parsePositiveNumber(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === '') {
    return null;
  }
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

/** Convierte tiempos estimados de tarifa a horas. */
export function rateEstimatedHours(
  value: string | number | null | undefined,
  unit: string | null | undefined,
): number | null {
  const amount = parsePositiveNumber(value);
  if (amount == null) {
    return null;
  }
  const normalized = String(unit ?? '')
    .trim()
    .toLowerCase();
  if (normalized === 'days') {
    return amount * 24;
  }
  if (normalized === 'hours') {
    return amount;
  }
  return null;
}

function roundHours(value: number): number {
  return Math.round(value * 10) / 10;
}

function buildLegEvent(
  trip: ManiobraRalentiTripInput,
  leg: ManiobraRalentiLeg,
  actualHours: number,
  plannedHours: number,
  rateHours: number | null,
): ManiobraRalentiEvent | null {
  const baselineSource: ManiobraRalentiBaselineSource =
    rateHours != null ? 'rate' : 'planned';
  const baselineHours = rateHours ?? plannedHours;
  const ralentiHours = actualHours - baselineHours;
  if (ralentiHours < MIN_RALENTI_HOURS) {
    return null;
  }
  return {
    tripId: trip.tripId,
    maneuverCode: trip.maneuverCode,
    clientName: trip.clientName,
    destination: trip.destination,
    leg,
    plannedHours: roundHours(plannedHours),
    actualHours: roundHours(actualHours),
    baselineHours: roundHours(baselineHours),
    baselineSource,
    ralentiHours: roundHours(ralentiHours),
  };
}

/**
 * Ralenti = exceso de duración real vs baseline.
 * Baseline = tiempos de tarifa (si existen) o duración planificada del tramo.
 */
export function buildManiobraRalentiReport(
  trips: readonly ManiobraRalentiTripInput[],
): ManiobraRalentiReport {
  const tripsWithRalenti = new Set<number>();
  let tripsEvaluated = 0;
  let salidaClienteHours = 0;
  let clienteRegresoHours = 0;

  const applyLegEvent = (event: ManiobraRalentiEvent | null): void => {
    if (!event) {
      return;
    }
    tripsWithRalenti.add(event.tripId);
    if (event.leg === 'salida_cliente') {
      salidaClienteHours += event.ralentiHours;
    } else {
      clienteRegresoHours += event.ralentiHours;
    }
  };

  for (const trip of trips) {
    const outboundActual = hoursBetween(trip.departureAt, trip.arrivedAt);
    const outboundPlanned = hoursBetween(
      trip.plannedDepartureAt,
      trip.plannedArrivalAt,
    );
    const returnActual = hoursBetween(trip.arrivedAt, trip.returnAt);
    const returnPlanned = hoursBetween(
      trip.plannedArrivalAt,
      trip.plannedCompletionAt,
    );

    const rateOutbound = rateEstimatedHours(
      trip.estimatedArrivalTimeValue,
      trip.estimatedTimeUnit,
    );
    const rateReturn = rateEstimatedHours(
      trip.estimatedReturnTimeValue,
      trip.estimatedTimeUnit,
    );

    let evaluated = false;

    if (outboundActual != null && outboundPlanned != null) {
      evaluated = true;
      applyLegEvent(
        buildLegEvent(
          trip,
          'salida_cliente',
          outboundActual,
          outboundPlanned,
          rateOutbound,
        ),
      );
    }

    if (returnActual != null && returnPlanned != null) {
      evaluated = true;
      applyLegEvent(
        buildLegEvent(
          trip,
          'cliente_regreso',
          returnActual,
          returnPlanned,
          rateReturn,
        ),
      );
    }

    if (evaluated) {
      tripsEvaluated += 1;
    }
  }

  return {
    totalHours: roundHours(salidaClienteHours + clienteRegresoHours),
    salidaClienteHours: roundHours(salidaClienteHours),
    clienteRegresoHours: roundHours(clienteRegresoHours),
    tripsEvaluated,
    tripsWithRalenti: tripsWithRalenti.size,
  };
}
