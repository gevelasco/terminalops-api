import type { Expense } from 'src/expenses/entities/expense.entity';
import type { Unit } from 'src/units/entities/unit.entity';
import type { Equipment } from 'src/equipment/entities/equipment.entity';
import type { FleetAssetTenure } from 'src/fleet/entities/fleet-asset-tenure.entity';
import type { Operator } from 'src/operators/entities/operator.entity';
import {
  buildExpenseCalendarProjection,
  type ProjectedExpenseRow,
} from 'src/expenses/expenses-calendar-projection.util';
import { formatOperationalIncurredDateYmd } from 'src/expenses/expenses-incurred-at.util';

export type PayableItemStatus = 'paid' | 'pending' | 'overdue';

export interface PayableItemDto {
  description: string;
  amount: number;
  beneficiary: string | null;
  installmentLabel: string;
  dueDate: string;
  status: PayableItemStatus;
}

const PAYABLE_SOURCES = new Set(['insurance', 'gps', 'tenure_payment']);

function parseMoney(raw?: string | number | null): number {
  if (raw == null || raw === '') return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseInstallmentFromHint(hint: string): string {
  const m = /\((?:.*?)(\d+)\/(\d+)\)/.exec(hint);
  return m ? `${m[1]}/${m[2]}` : '1/1';
}

function projectedLabel(proj: ProjectedExpenseRow): string {
  const asset =
    proj.relatedUnitLabel?.trim() ||
    proj.relatedEquipmentLabel?.trim() ||
    proj.fleetRelationLabel?.trim() ||
    '';
  switch (proj.source) {
    case 'insurance':
      return asset ? `Seguro — ${asset}` : 'Seguro';
    case 'gps':
      return asset ? `GPS — ${asset}` : 'GPS';
    case 'tenure_payment':
      return asset ? `Cuota financiamiento — ${asset}` : 'Cuota financiamiento';
    default:
      return proj.conceptLabel || 'Pago programado';
  }
}

export function buildPayableItems(params: {
  units: readonly Unit[];
  equipment: readonly Equipment[];
  tenures: readonly FleetAssetTenure[];
  projectionExpenses: readonly Expense[];
  allExpenses: readonly Expense[];
  from: string;
  to: string;
}): PayableItemDto[] {
  const { units, equipment, tenures, projectionExpenses, allExpenses, from, to } = params;
  const today = todayYmd();
  const items: PayableItemDto[] = [];

  const projection = buildExpenseCalendarProjection({
    from,
    to,
    trips: [],
    units,
    equipment,
    operators: [] as unknown as Operator[],
    tenures,
    expenses: projectionExpenses,
    actualItems: [],
  });

  for (const proj of projection.projected) {
    if (!PAYABLE_SOURCES.has(proj.source)) continue;
    if (proj.nature !== 'scheduled') continue;

    items.push({
      description: projectedLabel(proj),
      amount: parseMoney(proj.amount),
      beneficiary: proj.vendor?.trim() || null,
      installmentLabel: parseInstallmentFromHint(proj.hint),
      dueDate: proj.dueDate,
      status: proj.dueDate < today ? 'overdue' : 'pending',
    });
  }

  const projectedKeys = new Set(
    projection.projected
      .filter((p) => PAYABLE_SOURCES.has(p.source))
      .map((p) => `${p.source}:${p.dueDate}:${p.relatedUnitId ?? ''}:${p.relatedEquipmentId ?? ''}`),
  );

  for (const exp of allExpenses) {
    const kind = exp.kind ?? '';
    if (!PAYABLE_SOURCES.has(kind)) continue;
    if (exp.discardedAt) continue;
    const incurred = formatOperationalIncurredDateYmd(exp.incurredAt);
    if (incurred < from || incurred > to) continue;

    const key = `${kind}:${incurred}:${exp.relatedUnitId ?? ''}:${exp.relatedEquipmentId ?? ''}`;
    if (projectedKeys.has(key)) continue;

    const desc = exp.description?.trim() || exp.category?.trim() || kind;
    items.push({
      description: desc,
      amount: parseMoney(exp.amount),
      beneficiary: exp.vendor?.trim() || null,
      installmentLabel: parseInstallmentFromHint(exp.description ?? ''),
      dueDate: incurred,
      status: 'paid',
    });
  }

  const scheduledKinds = new Set(['insurance', 'gps', 'tenure_payment']);
  const creditMethods = new Set(['credit', 'credit_card', 'card']);
  for (const exp of allExpenses) {
    if (scheduledKinds.has(exp.kind ?? '')) continue;
    if (!creditMethods.has(exp.paymentMethod ?? '')) continue;
    if (exp.discardedAt) continue;
    const incurred = formatOperationalIncurredDateYmd(exp.incurredAt);
    if (incurred < from || incurred > to) continue;

    items.push({
      description: exp.category?.trim() || exp.description?.trim() || 'Gasto a crédito',
      amount: parseMoney(exp.amount),
      beneficiary: exp.vendor?.trim() || null,
      installmentLabel: '1/1',
      dueDate: incurred,
      status: 'paid',
    });
  }

  items.sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) ||
      a.description.localeCompare(b.description, 'es'),
  );
  return items;
}
