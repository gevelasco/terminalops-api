import type { SelectQueryBuilder } from 'typeorm';
import type { Expense } from './entities/expense.entity';

export type ScheduledExpenseAssetParams = {
  relatedUnitId?: number;
  relatedEquipmentId?: number;
  insuranceTarget?: 'unit' | 'equipment';
};

/**
 * Unidad y equipo son independientes. Un gasto de equipo lleva
 * `relatedEquipmentId`; el de la unidad no. Filtrar solo por unidad
 * no debe mezclar cuotas del equipo enganchado.
 */
export function applyScheduledExpenseAssetFilter(
  qb: SelectQueryBuilder<Expense>,
  params: ScheduledExpenseAssetParams,
): SelectQueryBuilder<Expense> {
  if (params.relatedEquipmentId != null) {
    return qb.andWhere('e.relatedEquipmentId = :scheduledEquipmentId', {
      scheduledEquipmentId: params.relatedEquipmentId,
    });
  }
  if (params.relatedUnitId != null) {
    return qb
      .andWhere('e.relatedUnitId = :scheduledUnitId', {
        scheduledUnitId: params.relatedUnitId,
      })
      .andWhere('e.relatedEquipmentId IS NULL');
  }
  return qb;
}
