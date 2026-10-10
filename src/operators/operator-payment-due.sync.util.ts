import { IsNull, type EntityManager } from 'typeorm';
import { Expense } from 'src/expenses/entities/expense.entity';
import { parseOperationalIncurredAt } from 'src/expenses/expenses-incurred-at.util';
import { Operator } from 'src/operators/entities/operator.entity';
import {
  resolveOperatorPaymentDueYmd,
  tripCompletionAnchorOperationalYmd,
} from 'src/operators/operator-payment-schedule.util';
import type { Trip } from 'src/trips/entities/trip.entity';

function parseTripQuota(raw?: string | null): number {
  if (raw == null || raw === '') {
    return 0;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Ajusta `incurredAt` del gasto pendiente de pago a operador según fin de maniobra
 * y periodicidad (p. ej. semanal con día de pago).
 */
export async function syncOperatorPaymentDueForTrip(
  em: EntityManager,
  trip: Pick<
    Trip,
    | 'id'
    | 'companyId'
    | 'status'
    | 'operatorId'
    | 'operatorQuota'
    | 'returnAt'
    | 'plannedCompletionAt'
    | 'completedAt'
    | 'arrivedAt'
  >,
): Promise<void> {
  if (trip.status !== 'completed' || trip.operatorId == null) {
    return;
  }
  if (parseTripQuota(trip.operatorQuota) <= 0) {
    return;
  }

  const completionYmd = tripCompletionAnchorOperationalYmd(trip);
  if (!completionYmd) {
    return;
  }

  const operator = await em.getRepository(Operator).findOne({
    where: { companyId: trip.companyId, id: trip.operatorId },
    select: ['id', 'paymentSchedule', 'weeklyPayDay'],
  });
  const dueYmd = resolveOperatorPaymentDueYmd({
    completionYmd,
    paymentSchedule: operator?.paymentSchedule,
    weeklyPayDay: operator?.weeklyPayDay,
  });
  const incurredAt = parseOperationalIncurredAt(dueYmd);

  const expenseRepo = em.getRepository(Expense);
  const pending = await expenseRepo.find({
    where: {
      companyId: trip.companyId,
      tripId: trip.id,
      kind: 'operator_payment',
      paidAt: IsNull(),
      discardedAt: IsNull(),
    },
    select: ['id'],
  });
  if (pending.length === 0) {
    return;
  }
  for (const row of pending) {
    await expenseRepo.update(row.id, { incurredAt });
  }
}
