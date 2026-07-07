export type TripActualScheduleExposure = {
  departureAt: Date | null;
  arrivedAt: Date | null;
  returnAt: Date | null;
};

export type TripForActualScheduleExposure = {
  status: string;
  createdAt?: Date | null;
  departureAt?: Date | null;
  arrivedAt?: Date | null;
  returnAt?: Date | null;
};

const MS_TOLERANCE = 1000;

function sameInstant(a?: Date | null, b?: Date | null): boolean {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return Math.abs(a.getTime() - b.getTime()) < MS_TOLERANCE;
}

/** Varias fechas reales idénticas = datos heredados/default, no ejecución registrada. */
export function hasSpuriousActualScheduleCluster(
  trip: TripForActualScheduleExposure,
): boolean {
  const values = [trip.departureAt, trip.arrivedAt, trip.returnAt].filter(
    (value): value is Date => value != null,
  );
  if (values.length < 2) {
    return false;
  }
  const first = values[0]!;
  return values.every((value) => sameInstant(value, first));
}

/**
 * Fechas reales expuestas al cliente: null hasta que exista ejecución registrada.
 * Maniobras programadas nunca exponen real_* (solo planned_*).
 */
export function exposeTripActualSchedule(
  trip: TripForActualScheduleExposure,
): TripActualScheduleExposure {
  const empty: TripActualScheduleExposure = {
    departureAt: null,
    arrivedAt: null,
    returnAt: null,
  };

  if (trip.status === 'scheduled') {
    return empty;
  }

  if (hasSpuriousActualScheduleCluster(trip)) {
    return empty;
  }

  const expose = (value?: Date | null): Date | null => {
    if (!value) {
      return null;
    }
    if (trip.createdAt && sameInstant(value, trip.createdAt)) {
      return null;
    }
    return value;
  };

  return sanitizeExposedActualSchedule({
    departureAt: expose(trip.departureAt),
    arrivedAt: expose(trip.arrivedAt),
    returnAt: expose(trip.returnAt),
  });
}

function isStrictlyBefore(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime();
}

/** No exponer reales que rompen salida → entrega → fin. */
export function sanitizeExposedActualSchedule(
  values: TripActualScheduleExposure,
): TripActualScheduleExposure {
  const { departureAt: dep, arrivedAt: arr, returnAt: ret } = values;
  let arrivedAt = arr;
  let returnAt = ret;

  if (dep && arrivedAt && isStrictlyBefore(arrivedAt, dep)) {
    arrivedAt = null;
  }
  if (dep && returnAt && isStrictlyBefore(returnAt, dep)) {
    returnAt = null;
  }
  if (arrivedAt && returnAt && isStrictlyBefore(returnAt, arrivedAt)) {
    returnAt = null;
  }

  return {
    departureAt: dep,
    arrivedAt,
    returnAt,
  };
}
