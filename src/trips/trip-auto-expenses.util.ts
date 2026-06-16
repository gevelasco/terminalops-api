import type { Trip } from 'src/trips/entities/trip.entity';

/** Tipos de gasto automático al crear maniobra (kind en tabla expenses). */
export const TRIP_AUTO_EXPENSE_KIND = {
  DIESEL: 'fuel',
  CASETAS: 'tolls',
  OPERATOR_FEE: 'operator_payment',
  MAINTENANCE: 'maintenance',
} as const;

export interface TripAutoExpenseDraft {
  category: string;
  amount: string;
  currency: string;
  incurredAt: Date;
  kind: string;
  description?: string;
  relatedUnitId?: number;
  relatedOperatorId?: number;
  isOperationalProvision: boolean;
}

export function parseTripMoneyAmount(raw?: string | null): number {
  if (raw == null || !String(raw).trim()) {
    return 0;
  }
  const n = Number(String(raw).replace(/\s/g, '').replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Costo total de la maniobra para provisión de mantenimiento (cobro al cliente). */
export function resolveTripTotalCost(
  trip: Pick<Trip, 'clientCharge'>,
): number {
  return parseTripMoneyAmount(trip.clientCharge);
}

function formatExpenseAmount(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function resolveIncurredAt(trip: Trip): Date {
  return trip.plannedDepartureAt ?? trip.createdAt ?? new Date();
}

export function buildTripAutoExpenses(trip: Trip): TripAutoExpenseDraft[] {
  const incurredAt = resolveIncurredAt(trip);
  const maneuverRef = trip.maneuverCode?.trim() || `#${trip.id}`;
  const drafts: TripAutoExpenseDraft[] = [];

  const dieselAmount = parseTripMoneyAmount(trip.dieselAmount);
  if (dieselAmount > 0) {
    drafts.push({
      category: 'Combustible',
      amount: formatExpenseAmount(dieselAmount),
      currency: 'MXN',
      incurredAt,
      kind: TRIP_AUTO_EXPENSE_KIND.DIESEL,
      description: `Diesel — maniobra ${maneuverRef}`,
      relatedUnitId: trip.unitId,
      isOperationalProvision: false,
    });
  }

  const tollAmount = parseTripMoneyAmount(trip.casetasAmount);
  if (tollAmount > 0) {
    drafts.push({
      category: 'Casetas',
      amount: formatExpenseAmount(tollAmount),
      currency: 'MXN',
      incurredAt,
      kind: TRIP_AUTO_EXPENSE_KIND.CASETAS,
      description: `Casetas — maniobra ${maneuverRef}`,
      isOperationalProvision: false,
    });
  }

  const operatorAmount = parseTripMoneyAmount(trip.operatorQuota);
  if (operatorAmount > 0) {
    drafts.push({
      category: 'Pago a operador',
      amount: formatExpenseAmount(operatorAmount),
      currency: 'MXN',
      incurredAt,
      kind: TRIP_AUTO_EXPENSE_KIND.OPERATOR_FEE,
      description: `Cuota operador — maniobra ${maneuverRef}`,
      relatedOperatorId: trip.operatorId,
      relatedUnitId: trip.unitId,
      isOperationalProvision: false,
    });
  }

  const totalCost = resolveTripTotalCost(trip);
  const maintenanceAmount = totalCost * 0.05;
  if (maintenanceAmount > 0) {
    drafts.push({
      category: 'Mantenimiento',
      amount: formatExpenseAmount(maintenanceAmount),
      currency: 'MXN',
      incurredAt,
      kind: TRIP_AUTO_EXPENSE_KIND.MAINTENANCE,
      description: `Mantenimiento (5% del cobro) — maniobra ${maneuverRef}`,
      relatedUnitId: trip.unitId,
      isOperationalProvision: false,
    });
  }

  return drafts;
}
