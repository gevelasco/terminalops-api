import {
  buildExpenseFleetRelationLabel,
  buildExpenseRelatedEquipmentLabel,
  buildExpenseRelatedOperatorLabel,
  buildExpenseRelatedUnitLabel,
} from './expense-fleet-relation-label.util';
import type { Expense } from './entities/expense.entity';

function expense(partial: Partial<Expense>): Expense {
  return partial as Expense;
}

describe('buildExpenseFleetRelationLabel', () => {
  it('returns unit operational code for maintenance on unit', () => {
    const label = buildExpenseFleetRelationLabel(
      expense({
        kind: 'maintenance',
        relatedUnitId: 7,
        relatedUnit: {
          id: 7,
          trailerBrandAbbr: 'HYU',
          trailerYear: '2021',
          plate: '81-AA-9K',
        } as Expense['relatedUnit'],
      }),
    );
    expect(label).toBe('HYU-2021-81-AA-9K');
  });

  it('returns operator name for operator payment', () => {
    const label = buildExpenseFleetRelationLabel(
      expense({
        kind: 'operator_payment',
        relatedOperator: { id: 3, name: 'Juan Pérez' } as Expense['relatedOperator'],
      }),
    );
    expect(label).toBe('Juan Pérez');
  });

  it('appends verification category for verification expenses', () => {
    const label = buildExpenseFleetRelationLabel(
      expense({
        kind: 'verification',
        category: 'Verificación - físico-mecánica',
        relatedUnitId: 2,
        relatedUnit: {
          id: 2,
          trailerBrandAbbr: 'FRE',
          trailerYear: '2020',
          plate: '12-BC-3D',
        } as Expense['relatedUnit'],
      }),
    );
    expect(label).toBe('FRE-2020-12-BC-3D · Verificación - físico-mecánica');
  });

  it('returns unit label for fuel expenses linked to a unit', () => {
    const label = buildExpenseFleetRelationLabel(
      expense({
        kind: 'fuel',
        relatedUnit: {
          id: 7,
          trailerBrandAbbr: 'FRE',
          trailerYear: '2022',
          plate: '233-SDCV-34',
        } as Expense['relatedUnit'],
      }),
    );
    expect(label).toBe('FRE-2022-233-SDCV-34');
  });

  it('falls back to trip.unit for fuel when related unit is missing', () => {
    const label = buildExpenseFleetRelationLabel(
      expense({
        kind: 'fuel',
        trip: {
          unit: {
            id: 9,
            trailerBrandAbbr: 'FRE',
            trailerYear: '2022',
            plate: '233-SDCV-34',
          },
        } as Expense['trip'],
      }),
    );
    expect(label).toBe('FRE-2022-233-SDCV-34');
  });

  it('returns undefined when kind has no fleet relation', () => {
    expect(buildExpenseFleetRelationLabel(expense({ kind: 'operational_control' }))).toBeUndefined();
  });

  it('falls back to plate when the unit lacks brand/year to build the code', () => {
    const row = expense({
      kind: 'maintenance',
      relatedUnitId: 7,
      relatedUnit: {
        id: 7,
        plate: '81-AA-9K',
      } as Expense['relatedUnit'],
    });
    expect(buildExpenseRelatedUnitLabel(row)).toBe('81-AA-9K');
    expect(buildExpenseFleetRelationLabel(row)).toBe('81-AA-9K');
  });

  it('exposes per-field relation labels for detail read view', () => {
    const row = expense({
      kind: 'maintenance',
      relatedUnitId: 7,
      relatedUnit: {
        id: 7,
        trailerBrandAbbr: 'HYU',
        trailerYear: '2021',
        plate: '81-AA-9K',
      } as Expense['relatedUnit'],
      relatedEquipment: {
        id: 9,
        trailerBrandAbbr: 'FRE',
        trailerYear: '2019',
        plate: '44-XY-1Z',
      } as Expense['relatedEquipment'],
      relatedOperator: { id: 3, name: 'Juan Pérez' } as Expense['relatedOperator'],
    });
    expect(buildExpenseRelatedUnitLabel(row)).toBe('HYU-2021-81-AA-9K');
    expect(buildExpenseRelatedEquipmentLabel(row)).toBe('FRE-2019-44-XY-1Z');
    expect(buildExpenseRelatedOperatorLabel(row)).toBe('Juan Pérez');
  });
});
