import type { Trip } from 'src/trips/entities/trip.entity';

/** Tipos de gasto automático al crear maniobra (kind en tabla expenses). */
export const TRIP_AUTO_EXPENSE_KIND = {
  DIESEL: 'fuel',
  CASETAS: 'tolls',
  OPERATOR_FEE: 'operator_payment',
  PER_DIEM: 'per_diem',
  /** Control operativo (% del cobro al cliente), rubro Administración. */
  OPERATIONAL_CONTROL: 'operational_control',
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
  paymentMethod?: string;
}

export type TripAutoExpenseBuildOptions = {
  maintenanceProvisionPercent?: number;
  fuelPaymentMethod?: string;
  tollsPaymentMethod?: string;
  perDiemPaymentMethod?: string;
  controlPaymentMethod?: string;
};

export function parseTripMoneyAmount(raw?: string | null): number {
  if (raw == null || !String(raw).trim()) {
    return 0;
  }
  const n = Number(String(raw).replace(/\s/g, '').replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Costo total de la maniobra para control operativo automático (cobro al cliente). */
export function resolveTripTotalCost(
  trip: Pick<Trip, 'clientCharge'>,
): number {
  return parseTripMoneyAmount(trip.clientCharge);
}

function formatExpenseAmount(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function formatDieselLitersLabel(liters: number): string {
  const rounded = Math.round(liters * 1000) / 1000;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(3).replace(/\.?0+$/, '');
  return `${text} L`;
}

function resolveIncurredAt(trip: Trip): Date {
  return trip.plannedDepartureAt ?? trip.createdAt ?? new Date();
}

export function buildTripAutoExpenses(
  trip: Trip,
  options: TripAutoExpenseBuildOptions = {},
): TripAutoExpenseDraft[] {
  const incurredAt = resolveIncurredAt(trip);
  const maneuverRef = trip.maneuverCode?.trim() || `#${trip.id}`;
  const drafts: TripAutoExpenseDraft[] = [];
  const fuelPaymentMethod = options.fuelPaymentMethod?.trim() || undefined;
  const tollsPaymentMethod = options.tollsPaymentMethod?.trim() || undefined;
  const perDiemPaymentMethod = options.perDiemPaymentMethod?.trim() || undefined;
  const controlPaymentMethod = options.controlPaymentMethod?.trim() || undefined;

  const dieselAmount = parseTripMoneyAmount(trip.dieselAmount);
  if (dieselAmount > 0) {
    const dieselLiters = parseTripMoneyAmount(trip.dieselLiters);
    const dieselDescription =
      dieselLiters > 0
        ? `Diesel ${formatDieselLitersLabel(dieselLiters)} — maniobra ${maneuverRef}`
        : `Diesel — maniobra ${maneuverRef}`;
    drafts.push({
      category: 'Combustible',
      amount: formatExpenseAmount(dieselAmount),
      currency: 'MXN',
      incurredAt,
      kind: TRIP_AUTO_EXPENSE_KIND.DIESEL,
      description: dieselDescription,
      relatedUnitId: trip.unitId,
      paymentMethod: fuelPaymentMethod,
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
      relatedUnitId: trip.unitId,
      paymentMethod: tollsPaymentMethod,
    });
  }

  const perDiemAmount = parseTripMoneyAmount(trip.perDiemAmount);
  if (perDiemAmount > 0) {
    drafts.push({
      category: 'Viáticos',
      amount: formatExpenseAmount(perDiemAmount),
      currency: 'MXN',
      incurredAt,
      kind: TRIP_AUTO_EXPENSE_KIND.PER_DIEM,
      description: `Viáticos — maniobra ${maneuverRef}`,
      relatedOperatorId: trip.operatorId,
      relatedUnitId: trip.unitId,
      paymentMethod: perDiemPaymentMethod,
    });
  }

  const totalCost = resolveTripTotalCost(trip);
  const provisionRate = options.maintenanceProvisionPercent ?? 5;
  const operationalControlAmount =
    provisionRate > 0 ? totalCost * (provisionRate / 100) : 0;
  if (operationalControlAmount > 0) {
    drafts.push({
      category: 'Control operativo',
      amount: formatExpenseAmount(operationalControlAmount),
      currency: 'MXN',
      incurredAt,
      kind: TRIP_AUTO_EXPENSE_KIND.OPERATIONAL_CONTROL,
      description: `Control operativo ${provisionRate}% — maniobra ${maneuverRef}`,
      paymentMethod: controlPaymentMethod,
    });
  }

  return drafts;
}
