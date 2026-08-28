import type { Expense } from 'src/expenses/entities/expense.entity';
import { formatExpenseNotificationAmount } from 'src/expenses/expense-fleet-relation-label.util';
import type { NotificationFeedItemDto } from './notifications-computed.util';
import {
  applyCoveragePaymentAssetEnrich,
  coveragePaymentEventNeedsAssetEnrich,
  coveragePaymentExpenseIdsToEnrich,
  coveragePaymentUnitIdsToPrefix,
  enrichCoveragePaymentFeedItems,
  prefixCoveragePaymentSubjectWithFleetAsset,
} from './notifications-coverage-subject.util';

function item(
  partial: Partial<NotificationFeedItemDto>,
): NotificationFeedItemDto {
  return {
    id: 'event:1',
    kind: 'payment.confirmed',
    origin: 'event',
    icon: 'settlement',
    title: 'Pago de GPS confirmado',
    subjectLabel: 'Pago de GPS · Motive (Mensualidad 2/12)',
    occurredAt: '2026-08-28T12:00:00.000Z',
    actorLabel: 'Ana',
    entityType: 'expense',
    entityId: '42',
    entityTab: null,
    ...partial,
  };
}

describe('coveragePaymentEventNeedsAssetEnrich', () => {
  it('targets expense-typed coverage payments and reminders', () => {
    expect(coveragePaymentEventNeedsAssetEnrich(item({}))).toBe(true);
    expect(
      coveragePaymentEventNeedsAssetEnrich(
        item({
          kind: 'payment.overdue',
          title: 'Cuota de financiamiento vencido',
          subjectLabel: 'Cuota de financiamiento (Mensualidad 2/12)',
        }),
      ),
    ).toBe(true);
  });

  it('skips events already pointed at the unit', () => {
    expect(
      coveragePaymentEventNeedsAssetEnrich(
        item({
          entityType: 'unit',
          entityId: '7',
          subjectLabel: 'Unidad HYU-2021-81-AA-9K · Pago de GPS · Motive (Mensualidad 2/12)',
        }),
      ),
    ).toBe(false);
  });
});

describe('enrichCoveragePaymentFeedItems', () => {
  it('prefixes the GPS unit and points the confirm event at the fleet drawer', () => {
    const expense = {
      id: 42,
      kind: 'gps',
      description: 'Pago de GPS · Motive (Mensualidad 2/12)',
      relatedUnitId: 7,
      relatedUnit: {
        id: 7,
        trailerBrandAbbr: 'HYU',
        trailerYear: '2021',
        plate: '81-AA-9K',
      },
    } as Expense;

    expect(coveragePaymentExpenseIdsToEnrich([item({})])).toEqual([42]);
    expect(
      enrichCoveragePaymentFeedItems([item({})], [expense]),
    ).toEqual([
      applyCoveragePaymentAssetEnrich(item({}), expense),
    ]);
    expect(applyCoveragePaymentAssetEnrich(item({}), expense)).toEqual(
      expect.objectContaining({
        subjectLabel:
          'Unidad HYU-2021-81-AA-9K · Pago de GPS · Motive (Mensualidad 2/12)',
        entityType: 'unit',
        entityId: '7',
        entityTab: 'cob',
      }),
    );
  });

  it('adds unit and amount to an overdue financing installment without retargeting', () => {
    const expense = {
      id: 42,
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
      },
    } as Expense;
    const overdue = item({
      kind: 'payment.overdue',
      title: 'Cuota de financiamiento vencido',
      subjectLabel: 'Cuota de financiamiento (Mensualidad 2/12)',
    });

    expect(applyCoveragePaymentAssetEnrich(overdue, expense)).toEqual(
      expect.objectContaining({
        subjectLabel: `Unidad HYU-2021-81-AA-9K · Cuota de financiamiento (Mensualidad 2/12) · ${formatExpenseNotificationAmount('8500.00')}`,
        entityType: 'expense',
        entityId: '42',
        entityTab: 'cob',
      }),
    );
  });

  it('adds unit or equipment to an overdue verification payment', () => {
    const unitExpense = {
      id: 42,
      kind: 'verification',
      description: 'Pago de verificación - físico-mecánica',
      amount: '1500.00',
      currency: 'MXN',
      relatedUnitId: 7,
      relatedUnit: {
        id: 7,
        trailerBrandAbbr: 'HYU',
        trailerYear: '2021',
        plate: '81-AA-9K',
      },
    } as Expense;
    const overdue = item({
      kind: 'payment.overdue',
      title: 'Pago de verificación vencido',
      subjectLabel: 'Pago de verificación - físico-mecánica',
    });
    expect(applyCoveragePaymentAssetEnrich(overdue, unitExpense)).toEqual(
      expect.objectContaining({
        subjectLabel: `Unidad HYU-2021-81-AA-9K · Pago de verificación - físico-mecánica · ${formatExpenseNotificationAmount('1500.00')}`,
      }),
    );

    const equipmentExpense = {
      id: 42,
      kind: 'verification',
      description: 'Pago de verificación - doble articulado',
      relatedEquipmentId: 9,
      relatedEquipment: {
        id: 9,
        trailerBrandAbbr: 'FRE',
        trailerYear: '2019',
        plate: '44-XY-1Z',
      },
    } as Expense;
    expect(applyCoveragePaymentAssetEnrich(overdue, equipmentExpense).subjectLabel).toBe(
      'Equipo FRE-2019-44-XY-1Z · Pago de verificación - doble articulado',
    );
  });

  it('prefixes unit or equipment on a confirmed verification payment pointed at the asset', () => {
    const confirmed = item({
      kind: 'payment.confirmed',
      title: 'Pago de verificación confirmado',
      subjectLabel: 'Pago de verificación - físico-mecánica',
      entityType: 'unit',
      entityId: '7',
    });
    expect(coveragePaymentEventNeedsAssetEnrich(confirmed)).toBe(false);
    expect(coveragePaymentUnitIdsToPrefix([confirmed])).toEqual([7]);
    expect(
      prefixCoveragePaymentSubjectWithFleetAsset(confirmed, 'unit', {
        id: 7,
        trailerBrandAbbr: 'HYU',
        trailerYear: '2021',
        plate: '81-AA-9K',
      }).subjectLabel,
    ).toBe('Unidad HYU-2021-81-AA-9K · Pago de verificación - físico-mecánica');

    const equipmentConfirmed = item({
      kind: 'coverage.payment_confirmed',
      title: 'Pago de verificación confirmado',
      subjectLabel: 'Pago de verificación - doble articulado',
      entityType: 'equipment',
      entityId: '9',
    });
    expect(
      prefixCoveragePaymentSubjectWithFleetAsset(equipmentConfirmed, 'equipment', {
        id: 9,
        trailerBrandAbbr: 'FRE',
        trailerYear: '2019',
        plate: '44-XY-1Z',
      }).subjectLabel,
    ).toBe('Equipo FRE-2019-44-XY-1Z · Pago de verificación - doble articulado');
  });
});
