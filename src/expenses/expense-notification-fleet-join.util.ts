import type { SelectQueryBuilder } from 'typeorm';
import type { Expense } from './entities/expense.entity';

/** Columnas que el feed de pagos necesita, incluyendo FKs de flota. */
export const EXPENSE_NOTIFICATION_COLUMNS = [
  'e.id',
  'e.companyId',
  'e.category',
  'e.amount',
  'e.currency',
  'e.incurredAt',
  'e.kind',
  'e.description',
  'e.relatedUnitId',
  'e.relatedEquipmentId',
  'e.paidAt',
  'e.discardedAt',
] as const;

/**
 * Misma unión que el listado de gastos: pide `relatedUnitId` y el código
 * operativo. Sin esto TypeORM a veces no hidrata la unidad en avisos.
 */
export function applyExpenseNotificationFleetJoins(
  qb: SelectQueryBuilder<Expense>,
): SelectQueryBuilder<Expense> {
  return qb
    .leftJoin('e.relatedUnit', 'relatedUnit')
    .leftJoin('e.relatedEquipment', 'relatedEquipment')
    .addSelect([
      'relatedUnit.id',
      'relatedUnit.trailerBrandAbbr',
      'relatedUnit.trailerYear',
      'relatedUnit.plate',
    ])
    .addSelect([
      'relatedEquipment.id',
      'relatedEquipment.trailerBrandAbbr',
      'relatedEquipment.trailerYear',
      'relatedEquipment.plate',
    ]);
}

export function assignFleetRelationIdsFromJoins(expense: Expense): void {
  if (expense.relatedUnit && expense.relatedUnitId == null) {
    expense.relatedUnitId = expense.relatedUnit.id;
  }
  if (expense.relatedEquipment && expense.relatedEquipmentId == null) {
    expense.relatedEquipmentId = expense.relatedEquipment.id;
  }
}
