import { buildTripAutoExpenses, resolveTripTotalCost } from './trip-auto-expenses.util';
import type { Trip } from 'src/trips/entities/trip.entity';

function tripStub(partial: Partial<Trip>): Trip {
  return {
    id: 1,
    companyId: 1,
    maneuverCode: 'ACME-001',
    createdAt: new Date('2026-06-10T16:00:00.000Z'),
    ...partial,
  } as Trip;
}

describe('trip-auto-expenses.util', () => {
  it('resolveTripTotalCost uses clientCharge', () => {
    expect(resolveTripTotalCost(tripStub({ clientCharge: '10,000.50' }))).toBe(
      10000.5,
    );
  });

  it('buildTripAutoExpenses creates expense drafts without operator payment', () => {
    const drafts = buildTripAutoExpenses(
      tripStub({
        dieselAmount: '2500',
        dieselLiters: '312.5',
        casetasAmount: '800',
        operatorQuota: '1200',
        clientCharge: '20000',
        unitId: 3,
        operatorId: 7,
      }),
    );

    expect(drafts).toHaveLength(3);
    expect(drafts.map((d) => d.kind)).toEqual([
      'fuel',
      'tolls',
      'operational_control',
    ]);
    expect(drafts.find((d) => d.kind === 'fuel')?.description).toBe(
      'Diesel 312.5 L — maniobra ACME-001',
    );
    expect(drafts.find((d) => d.kind === 'operational_control')?.amount).toBe(
      '1000.00',
    );
    expect(
      drafts.find((d) => d.kind === 'operational_control')?.isOperationalProvision,
    ).toBe(true);
    expect(drafts.find((d) => d.kind === 'operational_control')?.description).toBe(
      'Control operativo 5% — maniobra ACME-001',
    );
  });

  it('buildTripAutoExpenses uses configurable maintenance provision percent', () => {
    const drafts = buildTripAutoExpenses(
      tripStub({
        dieselAmount: '0',
        casetasAmount: '0',
        operatorQuota: '0',
        clientCharge: '10000',
        unitId: 1,
      }),
      { maintenanceProvisionPercent: 8 },
    );

    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.amount).toBe('800.00');
    expect(drafts[0]?.description).toBe('Control operativo 8% — maniobra ACME-001');
  });

  it('skips zero-amount expense rows', () => {
    const drafts = buildTripAutoExpenses(
      tripStub({
        dieselAmount: '0',
        casetasAmount: '',
        operatorQuota: '500',
        clientCharge: '0',
      }),
    );

    expect(drafts).toHaveLength(0);
  });

  it('buildTripAutoExpenses applies configured payment methods', () => {
    const drafts = buildTripAutoExpenses(
      tripStub({
        dieselAmount: '2500',
        casetasAmount: '800',
        perDiemAmount: '350',
        clientCharge: '1000',
        unitId: 3,
        operatorId: 7,
      }),
      {
        fuelPaymentMethod: 'transfer',
        tollsPaymentMethod: 'debit_card',
        perDiemPaymentMethod: 'cash',
        controlPaymentMethod: 'transfer',
      },
    );

    expect(drafts.find((d) => d.kind === 'fuel')?.paymentMethod).toBe('transfer');
    expect(drafts.find((d) => d.kind === 'tolls')?.paymentMethod).toBe('debit_card');
    expect(drafts.find((d) => d.kind === 'per_diem')?.paymentMethod).toBe('cash');
    expect(
      drafts.find((d) => d.kind === 'operational_control')?.paymentMethod,
    ).toBe('transfer');
  });

  it('buildTripAutoExpenses creates per diem expense when amount is positive', () => {
    const drafts = buildTripAutoExpenses(
      tripStub({
        dieselAmount: '0',
        casetasAmount: '0',
        operatorQuota: '0',
        perDiemAmount: '350',
        clientCharge: '0',
        operatorId: 12,
        unitId: 4,
      }),
    );

    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      kind: 'per_diem',
      category: 'Viáticos',
      amount: '350.00',
      relatedOperatorId: 12,
      relatedUnitId: 4,
    });
    expect(drafts[0]?.description).toContain('Viáticos');
  });

  it('skips per diem expense when amount is zero or empty', () => {
    const drafts = buildTripAutoExpenses(
      tripStub({
        perDiemAmount: '0',
        operatorQuota: '100',
      }),
    );

    expect(drafts.some((d) => d.kind === 'per_diem')).toBe(false);
  });
});
