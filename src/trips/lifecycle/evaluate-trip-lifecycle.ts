import type {
  TripLifecycleEvaluationInput,
  TripLifecycleEvaluationResult,
  TripLifecycleStatus,
} from './trip-lifecycle.types';

/** Fin efectivo: real si existe; si no, planeado (maniobra sin retrasos registrados). */
export function resolveEffectiveCompletionAt(
  input: Pick<
    TripLifecycleEvaluationInput,
    'plannedCompletionAt' | 'actualCompletionAt'
  >,
): Date {
  return input.actualCompletionAt ?? input.plannedCompletionAt;
}

function isCompletionDue(
  input: TripLifecycleEvaluationInput,
  now: Date,
): boolean {
  const completionAt = resolveEffectiveCompletionAt(input);
  return now.getTime() >= completionAt.getTime();
}

/**
 * Evaluación determinista del lifecycle. Sin efectos secundarios.
 * Reglas: scheduled→in_transit (now >= planned_departure);
 *         in_transit→completed cuando now >= fin efectivo
 *           (fin real si fue capturado; si no, fin planeado).
 *         Los incidentes de bitácora no bloquean el cierre.
 */
export function evaluateTripLifecycle(
  input: TripLifecycleEvaluationInput,
): TripLifecycleEvaluationResult {
  const now = input.now ?? new Date();

  if (input.status === 'cancelled' || input.status === 'completed') {
    return { nextStatus: null };
  }

  if (input.status === 'scheduled') {
    if (now.getTime() >= input.plannedDepartureAt.getTime()) {
      return { nextStatus: 'in_transit' };
    }
    return { nextStatus: null };
  }

  if (input.status === 'in_transit') {
    if (isCompletionDue(input, now)) {
      return { nextStatus: 'completed' };
    }
    return { nextStatus: null };
  }

  return { nextStatus: null };
}

/** Aplica transiciones en cadena hasta estado estable (p. ej. create histórico). */
export function resolveTripLifecycleStatus(
  input: TripLifecycleEvaluationInput,
): TripLifecycleStatus {
  let status: TripLifecycleStatus = input.status;
  const maxSteps = 4;

  for (let step = 0; step < maxSteps; step += 1) {
    const evaluation = evaluateTripLifecycle({
      ...input,
      status,
    });
    if (!evaluation.nextStatus || evaluation.nextStatus === status) {
      break;
    }
    status = evaluation.nextStatus;
  }

  return status;
}
