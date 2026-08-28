import {
  buildExpenseCoverageNotificationSubject,
  buildExpenseFleetRelationLabel,
  buildExpenseRelatedEquipmentLabel,
  buildExpenseRelatedOperatorLabel,
  buildExpenseRelatedUnitLabel,
  coverageNotificationSubjectHasAsset,
  formatExpenseNotificationAmount,
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

  it('prefixes unit or equipment on coverage notification subjects', () => {
    expect(
      buildExpenseCoverageNotificationSubject(
        expense({
          id: 11,
          kind: 'insurance',
          description: 'Pago de póliza · 000987345 (Mensualidad 2/12)',
          relatedUnitId: 7,
          relatedUnit: {
            id: 7,
            trailerBrandAbbr: 'HYU',
            trailerYear: '2021',
            plate: '81-AA-9K',
          } as Expense['relatedUnit'],
        }),
      ),
    ).toBe('Unidad HYU-2021-81-AA-9K · Pago de póliza · 000987345 (Mensualidad 2/12)');
    expect(
      buildExpenseCoverageNotificationSubject(
        expense({
          id: 12,
          kind: 'insurance',
          description: 'Pago de póliza · 0008345312 (Mensualidad 1/12)',
          relatedEquipmentId: 9,
          relatedEquipment: {
            id: 9,
            trailerBrandAbbr: 'FRE',
            trailerYear: '2019',
            plate: '44-XY-1Z',
          } as Expense['relatedEquipment'],
        }),
      ),
    ).toBe('Equipo FRE-2019-44-XY-1Z · Pago de póliza · 0008345312 (Mensualidad 1/12)');
    expect(
      buildExpenseCoverageNotificationSubject(
        expense({
          id: 13,
          kind: 'gps',
          description: 'Pago de GPS · Motive (Mensualidad 2/12)',
          relatedUnit: {
            id: 7,
            trailerBrandAbbr: 'HYU',
            trailerYear: '2021',
            plate: '81-AA-9K',
          } as Expense['relatedUnit'],
        }),
      ),
    ).toBe('Unidad HYU-2021-81-AA-9K · Pago de GPS · Motive (Mensualidad 2/12)');
    expect(
      coverageNotificationSubjectHasAsset(
        'Unidad HYU-2021-81-AA-9K · Pago de GPS · Motive (Mensualidad 2/12)',
      ),
    ).toBe(true);
    expect(
      coverageNotificationSubjectHasAsset('Pago de GPS · Motive (Mensualidad 2/12)'),
    ).toBe(false);
    expect(
      buildExpenseCoverageNotificationSubject(
        expense({
          id: 14,
          kind: 'tenure_payment',
          description: 'Cuota de financiamiento (Mensualidad 2/12)',
          amount: '8500.00',
          currency: 'MXN',
          relatedUnitId: 7,
          relatedUnit: {
            id: 7,
            trailerBrandAbbr: 'HYU',
            trailerYear: '2021',
            plate: '81-AA-9K',
          } as Expense['relatedUnit'],
        }),
      ),
    ).toBe(
      `Unidad HYU-2021-81-AA-9K · Cuota de financiamiento (Mensualidad 2/12) · ${formatExpenseNotificationAmount('8500.00')}`,
    );
    expect(
      buildExpenseCoverageNotificationSubject(
        expense({
          id: 15,
          kind: 'tenure_payment',
          description: 'Cuota de financiamiento (Mensualidad 3/24)',
          amount: '12000',
          currency: 'MXN',
          relatedEquipmentId: 9,
          relatedEquipment: {
            id: 9,
            trailerBrandAbbr: 'FRE',
            trailerYear: '2019',
            plate: '44-XY-1Z',
          } as Expense['relatedEquipment'],
        }),
      ),
    ).toBe(
      `Equipo FRE-2019-44-XY-1Z · Cuota de financiamiento (Mensualidad 3/24) · ${formatExpenseNotificationAmount('12000')}`,
    );
    expect(
      buildExpenseCoverageNotificationSubject(
        expense({
          id: 16,
          kind: 'verification',
          description: 'Pago de verificación - físico-mecánica',
          amount: '1500.00',
          currency: 'MXN',
          relatedUnit: {
            id: 7,
            trailerBrandAbbr: 'HYU',
            trailerYear: '2021',
            plate: '81-AA-9K',
          } as Expense['relatedUnit'],
        }),
      ),
    ).toBe(
      `Unidad HYU-2021-81-AA-9K · Pago de verificación - físico-mecánica · ${formatExpenseNotificationAmount('1500.00')}`,
    );
    expect(
      buildExpenseCoverageNotificationSubject(
        expense({
          id: 17,
          kind: 'verification',
          description: 'Pago de verificación - doble articulado',
          amount: '1800.00',
          currency: 'MXN',
          relatedEquipment: {
            id: 9,
            trailerBrandAbbr: 'FRE',
            trailerYear: '2019',
            plate: '44-XY-1Z',
          } as Expense['relatedEquipment'],
        }),
      ),
    ).toBe(
      `Equipo FRE-2019-44-XY-1Z · Pago de verificación - doble articulado · ${formatExpenseNotificationAmount('1800.00')}`,
    );
  });
});
