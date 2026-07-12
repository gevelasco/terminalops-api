import type { Expense } from 'src/expenses/entities/expense.entity';
import type { Equipment } from 'src/equipment/entities/equipment.entity';
import type { Operator } from 'src/operators/entities/operator.entity';
import type { Trip } from 'src/trips/entities/trip.entity';
import type { Unit } from 'src/units/entities/unit.entity';
import { formatOperationalIncurredDateYmd } from 'src/expenses/expenses-incurred-at.util';
import {
  buildEquipmentOperationalId,
  buildUnitOperationalId,
} from 'src/common/utils/unit-operational-id.util';
import {
  expenseRubroFromKind,
  expenseRubroLabel,
} from 'src/reports/reports-expense-rubro.util';
import {
  listGpsCoverageDueDatesInRange,
  listInsuranceCoverageDueDatesInRange,
  type FleetCoveragePaymentMeta,
} from 'src/fleet/fleet-coverage-schedule.util';
import { gpsServiceConceptLabel, buildGpsPaymentExpenseDescription } from 'src/fleet/fleet-gps-expense-sync.util';
import { insurancePolicyConceptLabel, buildInsurancePaymentExpenseDescription } from 'src/fleet/fleet-insurance-expense-sync.util';
import { VERIFICATION_SCOPE_SPECS } from 'src/fleet/fleet-verification-expense-sync.util';
import { buildOperatorPaymentRows } from 'src/operators/operator-payment-rows.util';
import {
  normalizeOperatorPaymentSchedule,
  resolveProjectedOperatorPayDueYmd,
  tripPayProjectionAnchorYmd,
  type OperatorPaymentSchedule,
} from 'src/operators/operator-payment-schedule.util';

export type ProjectedExpenseSource =
  | 'trip_fuel'
  | 'trip_tolls'
  | 'trip_per_diem'
  | 'insurance'
  | 'gps'
  | 'verification'
  | 'operator_payment';

export type ProjectedExpenseNature = 'committed' | 'scheduled';

export interface ProjectedExpenseRow {
  id: string;
  source: ProjectedExpenseSource;
  nature: ProjectedExpenseNature;
  kind: string;
  rubroLabel: string;
  conceptLabel: string;
  amount: string;
  currency: string;
  dueDate: string;
  tripId: number | null;
  tripManeuverCode?: string;
  relatedUnitId: number | null;
  relatedEquipmentId: number | null;
  relatedOperatorId: number | null;
  fleetRelationLabel?: string;
  relatedUnitLabel?: string;
  relatedEquipmentLabel?: string;
  relatedOperatorLabel?: string;
  verificationScope?: string;
  paymentMethod?: string;
  vendor?: string;
  invoiceRequired?: boolean;
  hint: string;
}

const OPERATOR_PAYMENT_CONCEPT_LABEL = 'Pago a operador';

export type ExpenseCalendarEntryType = 'actual' | 'projected';

export interface ExpenseCalendarEntry {
  entryType: ExpenseCalendarEntryType;
  sortDate: string;
  id: string;
  rubroLabel: string;
  conceptLabel: string;
  amount: string;
  currency: string;
  dateYmd: string;
  statusLabel: string;
  expenseId?: number;
  projected?: ProjectedExpenseRow;
}

export interface ExpenseCalendarMarker {
  label: string;
  amount: string;
  pct: number;
  tone: 'primary' | 'muted' | 'accent';
}

export interface ExpenseCalendarProjectionInput {
  from: string;
  to: string;
  trips: readonly Trip[];
  units: readonly Unit[];
  equipment: readonly Equipment[];
  operators: readonly Operator[];
  expenses: readonly Expense[];
  actualItems: ReadonlyArray<Record<string, unknown>>;
  asOf?: Date;
}

export interface ExpenseCalendarProjectionResult {
  projected: ProjectedExpenseRow[];
  entries: ExpenseCalendarEntry[];
  markers: ExpenseCalendarMarker[];
  summary: {
    actualCount: number;
    actualTotalAmount: number;
    projectedCount: number;
    projectedTotalAmount: number;
    grandCount: number;
    grandTotalAmount: number;
  };
}

const TRIP_COMMITTED_KINDS = [
  { source: 'trip_fuel' as const, kind: 'fuel', amountKey: 'dieselAmount' as const, label: 'Diésel / combustible' },
  { source: 'trip_tolls' as const, kind: 'tolls', amountKey: 'casetasAmount' as const, label: 'Casetas' },
  { source: 'trip_per_diem' as const, kind: 'per_diem', amountKey: 'perDiemAmount' as const, label: 'Viáticos' },
];

function parseMoney(raw?: string | null): number {
  if (raw == null || raw === '') {
    return 0;
  }
  const n = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function formatMoney(amount: number): string {
  return amount.toFixed(2);
}

function isYmdInRange(ymd: string, from: string, to: string): boolean {
  return ymd >= from && ymd <= to;
}

function addMonthsYmd(ymd: string, months: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) {
    return null;
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tripPlannedDepartureYmd(trip: Trip): string | null {
  const raw = trip.plannedDepartureAt;
  if (!raw) {
    return null;
  }
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return formatOperationalIncurredDateYmd(d);
}

function isActiveExpense(expense: Expense): boolean {
  return expense.discardedAt == null && expense.isOperationalProvision !== true;
}

function tripHasLedgerKind(tripId: number, kind: string, expenses: readonly Expense[]): boolean {
  return expenses.some(
    (e) =>
      isActiveExpense(e) &&
      e.tripId === tripId &&
      e.kind === kind &&
      parseMoney(e.amount) > 0,
  );
}

function operatorPaidOnTrip(tripId: number, expenses: readonly Expense[]): number {
  let sum = 0;
  for (const e of expenses) {
    if (!isActiveExpense(e)) {
      continue;
    }
    if (e.kind !== 'operator_payment' && e.kind !== 'operator_commission') {
      continue;
    }
    if (e.tripId !== tripId) {
      continue;
    }
    sum += parseMoney(e.amount);
  }
  return sum;
}

function operatorPaymentScheduleHint(schedule: OperatorPaymentSchedule): string {
  switch (schedule) {
    case 'weekly':
      return 'Pago semanal (sábado)';
    case 'biweekly':
      return 'Pago quincenal';
    case 'monthly':
      return 'Pago mensual';
    default:
      return 'Pago al concluir maniobra';
  }
}

function operatorLabel(operator: Operator): string {
  return operator.name?.trim() || `Operador ${operator.id}`;
}

/** Beneficiario del pago proyectado: «[nombre del operador] - Operador». */
function operatorVendorLabel(operator: Operator): string {
  return `${operatorLabel(operator)} - Operador`;
}

function normalizeOptionalPaymentMethod(
  raw: string | null | undefined,
): string | undefined {
  const value = raw?.trim();
  return value ? value : undefined;
}

function insurancePaymentFieldsFromProfile(
  profile:
    | {
        insuranceCarrierName?: string | null;
        insurancePaymentMethod?: string | null;
        insuranceInvoiceRequired?: boolean | null;
      }
    | null
    | undefined,
): Pick<ProjectedExpenseRow, 'vendor' | 'paymentMethod' | 'invoiceRequired'> {
  return {
    vendor: profile?.insuranceCarrierName?.trim() || undefined,
    paymentMethod: normalizeOptionalPaymentMethod(profile?.insurancePaymentMethod),
    invoiceRequired: profile?.insuranceInvoiceRequired === true,
  };
}

function gpsPaymentFieldsFromProfile(
  profile:
    | {
        gpsProviderBrand?: string | null;
        gpsPaymentMethod?: string | null;
        gpsInvoiceRequired?: boolean | null;
      }
    | null
    | undefined,
): Pick<ProjectedExpenseRow, 'vendor' | 'paymentMethod' | 'invoiceRequired'> {
  return {
    vendor: profile?.gpsProviderBrand?.trim() || undefined,
    paymentMethod: normalizeOptionalPaymentMethod(profile?.gpsPaymentMethod),
    invoiceRequired: profile?.gpsInvoiceRequired === true,
  };
}

function insuranceMetaFromUnit(unit: Unit): FleetCoveragePaymentMeta | undefined {
  const profile = unit.fleetProfile;
  if (!profile) {
    return undefined;
  }
  return {
    contractDate: profile.insuranceContractDate,
    lastPaymentDate: profile.insuranceLastPaymentDate,
    cadence: profile.insurancePaymentCadence,
  };
}

function gpsMetaFromUnit(unit: Unit): FleetCoveragePaymentMeta | undefined {
  const profile = unit.fleetProfile;
  if (!profile?.hasGps) {
    return undefined;
  }
  return {
    contractDate: profile.gpsContractDate,
    lastPaymentDate: profile.gpsLastPaymentDate,
    cadence: profile.gpsPaymentCadence,
  };
}

function insuranceMetaFromEquipment(equipment: Equipment): FleetCoveragePaymentMeta | undefined {
  const profile = equipment.fleetProfile;
  if (!profile) {
    return undefined;
  }
  return {
    contractDate: profile.insuranceContractDate,
    lastPaymentDate: profile.insuranceLastPaymentDate,
    cadence: profile.insurancePaymentCadence,
  };
}

function hasVerificationExpense(
  expenses: readonly Expense[],
  params: {
    scope: string;
    relatedUnitId?: number;
    relatedEquipmentId?: number;
    dueYmd: string;
  },
): boolean {
  return expenses.some((e) => {
    if (!isActiveExpense(e) || e.kind !== 'verification') {
      return false;
    }
    if (e.verificationScope !== params.scope) {
      return false;
    }
    if (params.relatedUnitId != null && e.relatedUnitId !== params.relatedUnitId) {
      return false;
    }
    if (
      params.relatedEquipmentId != null &&
      e.relatedEquipmentId !== params.relatedEquipmentId
    ) {
      return false;
    }
    return formatOperationalIncurredDateYmd(e.incurredAt) === params.dueYmd;
  });
}

function buildTripCommittedProjections(
  trips: readonly Trip[],
  expenses: readonly Expense[],
  from: string,
  to: string,
): ProjectedExpenseRow[] {
  const rows: ProjectedExpenseRow[] = [];

  for (const trip of trips) {
    if (trip.status !== 'scheduled' && trip.status !== 'in_transit') {
      continue;
    }
    const dueDate = tripPlannedDepartureYmd(trip);
    if (!dueDate || !isYmdInRange(dueDate, from, to)) {
      continue;
    }

    for (const spec of TRIP_COMMITTED_KINDS) {
      if (tripHasLedgerKind(trip.id, spec.kind, expenses)) {
        continue;
      }
      const amount = parseMoney(trip[spec.amountKey]);
      if (amount <= 0) {
        continue;
      }
      rows.push({
        id: `trip:${trip.id}:${spec.kind}`,
        source: spec.source,
        nature: 'committed',
        kind: spec.kind,
        rubroLabel: expenseRubroLabel(expenseRubroFromKind(spec.kind, trip.id)),
        conceptLabel: spec.label,
        amount: formatMoney(amount),
        currency: 'MXN',
        dueDate,
        tripId: trip.id,
        tripManeuverCode: trip.maneuverCode,
        relatedUnitId: trip.unitId ?? null,
        relatedEquipmentId: null,
        relatedOperatorId: trip.operatorId ?? null,
        ...(trip.unitOperationalCodeSnapshot?.trim()
          ? {
              fleetRelationLabel: trip.unitOperationalCodeSnapshot.trim(),
              relatedUnitLabel: trip.unitOperationalCodeSnapshot.trim(),
            }
          : {}),
        hint: trip.status === 'in_transit' ? 'Maniobra en curso' : 'Maniobra programada',
      });
    }
  }

  return rows;
}

function buildFleetInsuranceProjections(
  units: readonly Unit[],
  equipment: readonly Equipment[],
  expenses: readonly Expense[],
  from: string,
  to: string,
  asOf: Date,
): ProjectedExpenseRow[] {
  const rows: ProjectedExpenseRow[] = [];

  for (const unit of units) {
    const profile = unit.fleetProfile;
    const meta = insuranceMetaFromUnit(unit);
    const cost = parseMoney(profile?.insuranceCost);
    if (!meta || cost <= 0) {
      continue;
    }
    const dueDates = listInsuranceCoverageDueDatesInRange(meta, expenses, from, to, asOf);
    const unitOperationalId = buildUnitOperationalId(unit);
    const paymentFields = insurancePaymentFieldsFromProfile(profile);
    for (const dueDate of dueDates) {
      rows.push({
        id: `unit:${unit.id}:insurance:${dueDate}`,
        source: 'insurance',
        nature: 'scheduled',
        kind: 'insurance',
        rubroLabel: expenseRubroLabel('seguros'),
        conceptLabel: insurancePolicyConceptLabel(profile?.insurancePaymentCadence),
        amount: formatMoney(cost),
        currency: 'MXN',
        dueDate,
        tripId: null,
        relatedUnitId: unit.id,
        relatedEquipmentId: null,
        relatedOperatorId: null,
        fleetRelationLabel: unitOperationalId,
        relatedUnitLabel: unitOperationalId,
        ...paymentFields,
        hint: buildInsurancePaymentExpenseDescription(profile ?? {}, dueDate),
      });
    }
  }

  for (const item of equipment) {
    const profile = item.fleetProfile;
    const meta = insuranceMetaFromEquipment(item);
    const cost = parseMoney(profile?.insuranceCost);
    if (!meta || cost <= 0) {
      continue;
    }
    const dueDates = listInsuranceCoverageDueDatesInRange(meta, expenses, from, to, asOf);
    const equipmentOperationalId = buildEquipmentOperationalId(item);
    const paymentFields = insurancePaymentFieldsFromProfile(profile);
    for (const dueDate of dueDates) {
      rows.push({
        id: `equipment:${item.id}:insurance:${dueDate}`,
        source: 'insurance',
        nature: 'scheduled',
        kind: 'insurance',
        rubroLabel: expenseRubroLabel('seguros'),
        conceptLabel: insurancePolicyConceptLabel(profile?.insurancePaymentCadence),
        amount: formatMoney(cost),
        currency: 'MXN',
        dueDate,
        tripId: null,
        relatedUnitId: null,
        relatedEquipmentId: item.id,
        relatedOperatorId: null,
        fleetRelationLabel: equipmentOperationalId,
        relatedEquipmentLabel: equipmentOperationalId,
        ...paymentFields,
        hint: buildInsurancePaymentExpenseDescription(profile ?? {}, dueDate),
      });
    }
  }

  return rows;
}

function buildFleetGpsProjections(
  units: readonly Unit[],
  expenses: readonly Expense[],
  from: string,
  to: string,
  asOf: Date,
): ProjectedExpenseRow[] {
  const rows: ProjectedExpenseRow[] = [];

  for (const unit of units) {
    const profile = unit.fleetProfile;
    const meta = gpsMetaFromUnit(unit);
    const cost = parseMoney(profile?.gpsPrice);
    if (!meta || cost <= 0) {
      continue;
    }
    const dueDates = listGpsCoverageDueDatesInRange(meta, expenses, from, to, asOf);
    const unitOperationalId = buildUnitOperationalId(unit);
    const paymentFields = gpsPaymentFieldsFromProfile(profile);
    for (const dueDate of dueDates) {
      rows.push({
        id: `unit:${unit.id}:gps:${dueDate}`,
        source: 'gps',
        nature: 'scheduled',
        kind: 'gps',
        rubroLabel: expenseRubroLabel('gps'),
        conceptLabel: gpsServiceConceptLabel(profile?.gpsPaymentCadence),
        amount: formatMoney(cost),
        currency: 'MXN',
        dueDate,
        tripId: null,
        relatedUnitId: unit.id,
        relatedEquipmentId: null,
        relatedOperatorId: null,
        fleetRelationLabel: unitOperationalId,
        relatedUnitLabel: unitOperationalId,
        ...paymentFields,
        hint: buildGpsPaymentExpenseDescription(profile ?? {}, dueDate),
      });
    }
  }

  return rows;
}

function buildVerificationProjections(
  units: readonly Unit[],
  equipment: readonly Equipment[],
  expenses: readonly Expense[],
  from: string,
  to: string,
): ProjectedExpenseRow[] {
  const rows: ProjectedExpenseRow[] = [];

  const pushForProfile = (params: {
    prefix: string;
    entityId: number;
    profile: Record<string, unknown> | undefined;
    relatedUnitId: number | null;
    relatedEquipmentId: number | null;
    assetOperationalId: string;
  }) => {
    if (!params.profile) {
      return;
    }
    for (const spec of VERIFICATION_SCOPE_SPECS) {
      if (spec.applies && !spec.applies(params.profile as never)) {
        continue;
      }
      const lastDate = String(params.profile[spec.dateKey] ?? '').trim();
      const cost = parseMoney(String(params.profile[spec.costKey] ?? ''));
      if (!lastDate || cost <= 0) {
        continue;
      }
      const dueDate = addMonthsYmd(lastDate, 6);
      if (!dueDate || !isYmdInRange(dueDate, from, to)) {
        continue;
      }
      if (
        hasVerificationExpense(expenses, {
          scope: spec.scope,
          relatedUnitId: params.relatedUnitId ?? undefined,
          relatedEquipmentId: params.relatedEquipmentId ?? undefined,
          dueYmd: dueDate,
        })
      ) {
        continue;
      }
      rows.push({
        id: `${params.prefix}:${params.entityId}:verification:${spec.scope}:${dueDate}`,
        source: 'verification',
        nature: 'scheduled',
        kind: 'verification',
        rubroLabel: expenseRubroLabel('verificaciones'),
        conceptLabel: spec.category,
        amount: formatMoney(cost),
        currency: 'MXN',
        dueDate,
        tripId: null,
        relatedUnitId: params.relatedUnitId,
        relatedEquipmentId: params.relatedEquipmentId,
        relatedOperatorId: null,
        fleetRelationLabel: params.assetOperationalId,
        ...(params.relatedUnitId != null
          ? { relatedUnitLabel: params.assetOperationalId }
          : {}),
        ...(params.relatedEquipmentId != null
          ? { relatedEquipmentLabel: params.assetOperationalId }
          : {}),
        verificationScope: spec.scope,
        hint: 'Renovación de verificación',
      });
    }
  };

  for (const unit of units) {
    pushForProfile({
      prefix: 'unit',
      entityId: unit.id,
      profile: unit.fleetProfile as unknown as Record<string, unknown> | undefined,
      relatedUnitId: unit.id,
      relatedEquipmentId: null,
      assetOperationalId: buildUnitOperationalId(unit),
    });
  }

  for (const item of equipment) {
    pushForProfile({
      prefix: 'equipment',
      entityId: item.id,
      profile: item.fleetProfile as unknown as Record<string, unknown> | undefined,
      relatedUnitId: null,
      relatedEquipmentId: item.id,
      assetOperationalId: buildEquipmentOperationalId(item),
    });
  }

  return rows;
}

function buildOperatorPaymentProjections(
  trips: readonly Trip[],
  operators: readonly Operator[],
  expenses: readonly Expense[],
  from: string,
  to: string,
  asOf: Date,
): ProjectedExpenseRow[] {
  const rows: ProjectedExpenseRow[] = [];
  const projectedTripIds = new Set<number>();

  for (const operator of operators) {
    const operatorTrips = trips.filter((t) => t.operatorId === operator.id);
    const schedule = normalizeOperatorPaymentSchedule(operator.paymentSchedule);
    const sections = buildOperatorPaymentRows(
      operatorTrips,
      expenses,
      operator.paymentSchedule,
      asOf,
    );

    for (const row of sections.pendingPaymentRows) {
      if (row.balance <= 0 || !isYmdInRange(row.dueYmd, from, to)) {
        continue;
      }
      const trip = operatorTrips.find((t) => t.id === row.tripId);
      projectedTripIds.add(row.tripId);
      rows.push({
        id: `operator:${operator.id}:trip:${row.tripId}:pay:${row.dueYmd}`,
        source: 'operator_payment',
        nature: 'scheduled',
        kind: 'operator_payment',
        rubroLabel: expenseRubroLabel('maniobra'),
        conceptLabel: OPERATOR_PAYMENT_CONCEPT_LABEL,
        amount: formatMoney(row.balance),
        currency: 'MXN',
        dueDate: row.dueYmd,
        tripId: row.tripId,
        tripManeuverCode: row.maneuverCode,
        relatedUnitId: trip?.unitId ?? null,
        relatedEquipmentId: null,
        relatedOperatorId: operator.id,
        ...(trip?.unitOperationalCodeSnapshot?.trim()
          ? { relatedUnitLabel: trip.unitOperationalCodeSnapshot.trim() }
          : {}),
        relatedOperatorLabel: operatorLabel(operator),
        vendor: operatorVendorLabel(operator),
        paymentMethod: normalizeOptionalPaymentMethod(operator.paymentMethod),
        hint: operatorPaymentScheduleHint(schedule),
      });
    }

    for (const trip of operatorTrips) {
      if (trip.status !== 'scheduled' && trip.status !== 'in_transit') {
        continue;
      }
      if (projectedTripIds.has(trip.id)) {
        continue;
      }
      const quota = parseMoney(trip.operatorQuota);
      if (quota <= 0) {
        continue;
      }
      const paid = operatorPaidOnTrip(trip.id, expenses);
      const balance = Math.max(0, quota - paid);
      if (balance <= 0) {
        continue;
      }
      const anchorYmd = tripPayProjectionAnchorYmd(trip);
      if (!anchorYmd) {
        continue;
      }
      const dueYmd = resolveProjectedOperatorPayDueYmd(schedule, anchorYmd);
      if (!isYmdInRange(dueYmd, from, to)) {
        continue;
      }
      projectedTripIds.add(trip.id);
      rows.push({
        id: `operator:${operator.id}:trip:${trip.id}:pay:${dueYmd}`,
        source: 'operator_payment',
        nature: 'committed',
        kind: 'operator_payment',
        rubroLabel: expenseRubroLabel('maniobra'),
        conceptLabel: OPERATOR_PAYMENT_CONCEPT_LABEL,
        amount: formatMoney(balance),
        currency: 'MXN',
        dueDate: dueYmd,
        tripId: trip.id,
        tripManeuverCode: trip.maneuverCode,
        relatedUnitId: trip.unitId ?? null,
        relatedEquipmentId: null,
        relatedOperatorId: operator.id,
        ...(trip.unitOperationalCodeSnapshot?.trim()
          ? { relatedUnitLabel: trip.unitOperationalCodeSnapshot.trim() }
          : {}),
        relatedOperatorLabel: operatorLabel(operator),
        vendor: operatorVendorLabel(operator),
        paymentMethod: normalizeOptionalPaymentMethod(operator.paymentMethod),
        hint: operatorPaymentScheduleHint(schedule),
      });
    }
  }

  return rows;
}

function actualEntryFromSerialized(
  item: Record<string, unknown>,
): ExpenseCalendarEntry {
  const amountRaw = item['amount'];
  const amount =
    typeof amountRaw === 'number'
      ? formatMoney(amountRaw)
      : String(amountRaw ?? '0');
  const dateYmd =
    typeof item['incurredDate'] === 'string' && item['incurredDate']
      ? item['incurredDate']
      : typeof item['incurredAt'] === 'string'
        ? item['incurredAt'].slice(0, 10)
        : '';
  const kind = String(item['kind'] ?? '');
  const tripIdRaw = item['tripId'];
  const tripId =
    typeof tripIdRaw === 'number'
      ? tripIdRaw
      : tripIdRaw != null
        ? Number(tripIdRaw)
        : null;
  const rubro = expenseRubroFromKind(kind, Number.isFinite(tripId) ? tripId : null);

  return {
    entryType: 'actual',
    sortDate: dateYmd,
    id: `actual:${String(item['id'] ?? '')}`,
    rubroLabel: expenseRubroLabel(rubro),
    conceptLabel: String(item['category'] ?? ''),
    amount,
    currency: String(item['currency'] ?? 'MXN'),
    dateYmd,
    statusLabel: 'Realizado',
    expenseId:
      typeof item['id'] === 'number'
        ? item['id']
        : Number.isFinite(Number(item['id']))
          ? Number(item['id'])
          : undefined,
  };
}

function projectedEntry(row: ProjectedExpenseRow): ExpenseCalendarEntry {
  return {
    entryType: 'projected',
    sortDate: row.dueDate,
    id: row.id,
    rubroLabel: row.rubroLabel,
    conceptLabel: row.conceptLabel,
    amount: row.amount,
    currency: row.currency,
    dateYmd: row.dueDate,
    statusLabel: row.nature === 'committed' ? 'Programado' : 'Pendiente',
    projected: row,
  };
}

type ExpenseCalendarMarkerBucket =
  | 'directos'
  | 'eventuales'
  | 'recurrentes'
  | 'porPagar';

const PROGRAMADO_EXPENSE_KINDS = new Set(['insurance', 'gps', 'verification']);

/** Rubros fuera del flujo operativo recurrente (reparaciones, gastos ad hoc, etc.). */
const EVENTUAL_EXPENSE_RUBROS = new Set([
  'reparacion',
  'servicio',
  'gasto',
  'otro',
  'administracion',
]);

const EVENTUAL_EXPENSE_KINDS = new Set(['repair', 'other', 'unit_purchase', 'equipment_purchase']);

function markerBucketForActual(kind: string, tripId: number | null | undefined): ExpenseCalendarMarkerBucket {
  const normalizedKind = kind.trim().toLowerCase();
  if (PROGRAMADO_EXPENSE_KINDS.has(normalizedKind)) {
    return 'recurrentes';
  }
  const rubro = expenseRubroFromKind(normalizedKind, tripId ?? null);
  if (EVENTUAL_EXPENSE_RUBROS.has(rubro) || EVENTUAL_EXPENSE_KINDS.has(normalizedKind)) {
    return 'eventuales';
  }
  return 'directos';
}

function buildMarkers(
  actualItems: readonly Record<string, unknown>[],
  projectedRows: readonly ProjectedExpenseRow[],
): ExpenseCalendarMarker[] {
  const totals: Record<ExpenseCalendarMarkerBucket, number> = {
    directos: 0,
    eventuales: 0,
    recurrentes: 0,
    porPagar: 0,
  };

  for (const item of actualItems) {
    const kind = String(item['kind'] ?? '');
    const tripIdRaw = item['tripId'];
    const tripId =
      typeof tripIdRaw === 'number'
        ? tripIdRaw
        : tripIdRaw != null && String(tripIdRaw).trim() !== ''
          ? Number(tripIdRaw)
          : null;
    const amountRaw = item['amount'];
    const amount =
      typeof amountRaw === 'number'
        ? amountRaw
        : parseMoney(String(amountRaw ?? '0'));
    const bucket = markerBucketForActual(
      kind,
      tripId != null && Number.isFinite(tripId) ? tripId : null,
    );
    totals[bucket] += amount;
  }

  for (const row of projectedRows) {
    totals.porPagar += parseMoney(row.amount);
  }

  const total =
    totals.directos + totals.eventuales + totals.recurrentes + totals.porPagar;
  const pct = (value: number) => (total > 0 ? Math.round((value / total) * 100) : 0);

  const markers: ExpenseCalendarMarker[] = [
    {
      label: 'Directos',
      amount: formatMoney(totals.directos),
      pct: pct(totals.directos),
      tone: 'primary',
    },
    {
      label: 'Recurrentes',
      amount: formatMoney(totals.recurrentes),
      pct: pct(totals.recurrentes),
      tone: 'muted',
    },
    {
      label: 'Por pagar',
      amount: formatMoney(totals.porPagar),
      pct: pct(totals.porPagar),
      tone: 'accent',
    },
  ];

  if (totals.eventuales > 0) {
    markers.splice(1, 0, {
      label: 'Eventuales',
      amount: formatMoney(totals.eventuales),
      pct: pct(totals.eventuales),
      tone: 'accent',
    });
  }

  return markers;
}

export function buildExpenseCalendarProjection(
  input: ExpenseCalendarProjectionInput,
): ExpenseCalendarProjectionResult {
  const asOf = input.asOf ?? new Date();
  const projected = [
    ...buildTripCommittedProjections(input.trips, input.expenses, input.from, input.to),
    ...buildFleetInsuranceProjections(
      input.units,
      input.equipment,
      input.expenses,
      input.from,
      input.to,
      asOf,
    ),
    ...buildFleetGpsProjections(input.units, input.expenses, input.from, input.to, asOf),
    ...buildVerificationProjections(
      input.units,
      input.equipment,
      input.expenses,
      input.from,
      input.to,
    ),
    ...buildOperatorPaymentProjections(
      input.trips,
      input.operators,
      input.expenses,
      input.from,
      input.to,
      asOf,
    ),
  ];

  const actualEntries = input.actualItems.map(actualEntryFromSerialized);
  const projectedEntries = projected.map(projectedEntry);
  const entries = [...actualEntries, ...projectedEntries].sort((a, b) => {
    if (a.sortDate !== b.sortDate) {
      return b.sortDate.localeCompare(a.sortDate);
    }
    if (a.entryType !== b.entryType) {
      return a.entryType === 'actual' ? -1 : 1;
    }
    return a.id.localeCompare(b.id);
  });

  const actualTotal = actualEntries.reduce((sum, row) => sum + parseMoney(row.amount), 0);
  const projectedTotal = projected.reduce((sum, row) => sum + parseMoney(row.amount), 0);

  return {
    projected,
    entries,
    markers: buildMarkers(input.actualItems, projected),
    summary: {
      actualCount: actualEntries.length,
      actualTotalAmount: actualTotal,
      projectedCount: projected.length,
      projectedTotalAmount: projectedTotal,
      grandCount: actualEntries.length + projected.length,
      grandTotalAmount: actualTotal + projectedTotal,
    },
  };
}

export function paginateExpenseCalendarEntries<T>(
  entries: readonly T[],
  page: number,
  limit: number,
): { items: T[]; total: number; page: number; limit: number } {
  const total = entries.length;
  if (limit <= 0) {
    return { items: [...entries], total, page: 1, limit: total };
  }
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * limit;
  return {
    items: entries.slice(start, start + limit),
    total,
    page: safePage,
    limit,
  };
}
