import type {
  TripLifecycleEvaluationInput,
  TripLifecycleEvaluationResult,
  TripLifecycleStatus,
} from './trip-lifecycle.types';

/**
 * Evaluación determinista del lifecycle. Sin efectos secundarios.
 * Reglas: scheduled→in_transit (now >= planned_departure);
 *         in_transit→completed (now >= planned_completion AND no open incidents).
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
    if (
      input.openIncidentCount === 0 &&
      now.getTime() >= input.plannedCompletionAt.getTime()
    ) {
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
