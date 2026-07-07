type TripScheduleLike = {
  status: string;
  departureAt?: Date | string | null;
  arrivedAt?: Date | string | null;
  plannedDepartureAt?: Date | string | null;
  plannedArrivalAt?: Date | string | null;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null || value === '') {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Salida efectiva: real si existe; si no, plan operativo. */
export function effectiveManiobraDepartureAt(trip: TripScheduleLike): Date | null {
  if (trip.status !== 'scheduled') {
    const actual = toDate(trip.departureAt);
    if (actual) {
      return actual;
    }
  }
  return toDate(trip.plannedDepartureAt);
}

/** Llegada efectiva: real si existe; si no, plan operativo. En curso usa ahora. */
export function effectiveManiobraArrivalAt(
  trip: TripScheduleLike,
  now: Date = new Date(),
): Date | null {
  if (trip.status === 'in_transit') {
    return now;
  }

  if (trip.status === 'completed') {
    return toDate(trip.arrivedAt) ?? toDate(trip.plannedArrivalAt);
  }

  if (trip.status === 'scheduled') {
    return toDate(trip.plannedArrivalAt);
  }

  return toDate(trip.arrivedAt) ?? toDate(trip.plannedArrivalAt);
}

/** Días de salida a llegada (real o planificado). */
export function computeManiobraDurationDays(
  trip: TripScheduleLike,
  now: Date = new Date(),
): number | null {
  const start = effectiveManiobraDepartureAt(trip);
  const end = effectiveManiobraArrivalAt(trip, now);
  if (!start || !end || end.getTime() < start.getTime()) {
    return null;
  }
  const days = (end.getTime() - start.getTime()) / 86400000;
  return Math.round(days * 10) / 10;
}
