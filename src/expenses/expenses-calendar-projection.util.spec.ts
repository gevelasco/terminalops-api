import {
  buildExpenseCalendarProjection,
  paginateExpenseCalendarEntries,
  type ExpenseCalendarEntry,
  type ExpenseCalendarMarker,
  type ProjectedExpenseRow,
} from './expenses-calendar-projection.util';

function tripStub(overrides: Partial<Parameters<typeof buildExpenseCalendarProjection>[0]['trips'][number]> = {}) {
  return {
    id: 1,
    companyId: 1,
    maneuverCode: 'M-100',
    origin: 'A',
    destination: 'B',
    clientName: 'Cliente',
    status: 'scheduled',
    operationType: 'import',
    operatorQuota: '0',
    dieselAmount: '5000',
    casetasAmount: '2000',
    perDiemAmount: '0',
    plannedDepartureAt: new Date('2026-07-10T18:00:00.000Z'),
    unitId: 10,
    operatorId: 20,
    ...overrides,
  } as never;
}

describe('expenses-calendar-projection.util', () => {
  it('projects committed trip fuel and tolls when maneuver is scheduled and ledger is empty', () => {
    const result = buildExpenseCalendarProjection({
      from: '2026-07-01',
      to: '2026-07-31',
      trips: [tripStub()],
      units: [],
      equipment: [],
      operators: [],
      expenses: [],
      actualItems: [],
    });

    expect(result.projected).toHaveLength(2);
    expect(result.projected.map((row) => row.source).sort()).toEqual(['trip_fuel', 'trip_tolls']);
    expect(result.projected.find((row) => row.source === 'trip_fuel')?.conceptLabel).toBe(
      'Diésel / combustible',
    );
    expect(result.projected.find((row) => row.source === 'trip_tolls')?.conceptLabel).toBe(
      'Casetas',
    );
    expect(result.summary.projectedTotalAmount).toBe(7000);
  });

  it('uses the same GPS concept label as fleet expense sync', () => {
    const result = buildExpenseCalendarProjection({
      from: '2026-07-01',
      to: '2026-07-31',
      trips: [],
      units: [
        {
          id: 10,
          plate: '233-SDCV-34',
          trailerBrandAbbr: 'fre',
          trailerYear: '2022',
          fleetProfile: {
            hasGps: true,
            gpsContractDate: '2026-01-15',
            gpsPaymentCadence: 'monthly',
            gpsPrice: '500',
            gpsProviderBrand: 'SkyBitz',
            gpsPaymentMethod: 'transfer',
            gpsInvoiceRequired: true,
          },
        } as never,
      ],
      equipment: [],
      operators: [],
      expenses: [],
      actualItems: [],
    });

    const gpsRow = result.projected.find((row) => row.source === 'gps');
    expect(gpsRow?.conceptLabel).toBe('GPS - mensual');
    expect(gpsRow?.relatedUnitLabel).toBe('FRE-2022-233-SDCV-34');
    expect(gpsRow?.vendor).toBe('SkyBitz');
    expect(gpsRow?.paymentMethod).toBe('transfer');
    expect(gpsRow?.invoiceRequired).toBe(true);
    expect(gpsRow?.hint).toMatch(/^Pago de GPS · SkyBitz \(Mensualidad \d+\/12\)$/);
  });

  it('treats the initial GPS contract expense as the first paid cycle (not overdue)', () => {
    const result = buildExpenseCalendarProjection({
      from: '2025-07-08',
      to: '2026-07-31',
      trips: [],
      units: [
        {
          id: 10,
          plate: '98BL2L',
          trailerBrandAbbr: 'fre',
          trailerYear: '2012',
          fleetProfile: {
            hasGps: true,
            gpsContractDate: '2026-01-24',
            gpsPaymentCadence: 'monthly',
            gpsPrice: '805.14',
            gpsProviderBrand: 'SkyBitz',
          },
        } as never,
      ],
      equipment: [],
      operators: [],
      expenses: [
        {
          id: 700,
          kind: 'gps',
          amount: '805.14',
          description: 'Contratación de GPS · SkyBitz (Mensualidad 1/12)',
          incurredAt: new Date('2026-01-24T18:00:00.000Z'),
          discardedAt: null,
          isOperationalProvision: false,
        } as never,
      ],
      actualItems: [],
      asOf: new Date('2026-07-08T18:00:00.000Z'),
    });

    const gpsCycleOne = result.projected.find(
      (row) => row.source === 'gps' && row.dueDate === '2026-01-24',
    );
    expect(gpsCycleOne).toBeUndefined();
  });

  it('projects insurance payment preview fields for equipment', () => {
    const result = buildExpenseCalendarProjection({
      from: '2026-07-01',
      to: '2026-07-31',
      trips: [],
      units: [],
      equipment: [
        {
          id: 5,
          plate: 'EQ-99',
          trailerBrandAbbr: 'hyt',
          trailerYear: '2020',
          fleetProfile: {
            insuranceContractDate: '2026-01-15',
            insurancePaymentCadence: 'monthly',
            insuranceCost: '1200',
            insuranceCarrierName: 'Qualitas',
            insurancePolicyNumber: '0008345312',
            insurancePaymentMethod: 'check',
            insuranceInvoiceRequired: true,
          },
        } as never,
      ],
      operators: [],
      expenses: [],
      actualItems: [],
    });

    const insuranceRow = result.projected.find((row) => row.source === 'insurance');
    expect(insuranceRow?.conceptLabel).toBe('Póliza - mensual');
    expect(insuranceRow?.relatedEquipmentLabel).toBe('HYT-2020-EQ-99');
    expect(insuranceRow?.vendor).toBe('Qualitas');
    expect(insuranceRow?.paymentMethod).toBe('check');
    expect(insuranceRow?.invoiceRequired).toBe(true);
    expect(insuranceRow?.hint).toMatch(/^Pago de póliza · /);
    expect(insuranceRow?.hint).toMatch(/\(Mensualidad \d+\/12\)$/);
  });

  it('does not duplicate trip fuel when ledger already has the expense', () => {
    const result = buildExpenseCalendarProjection({
      from: '2026-07-01',
      to: '2026-07-31',
      trips: [tripStub()],
      units: [],
      equipment: [],
      operators: [],
      expenses: [
        {
          id: 99,
          tripId: 1,
          kind: 'fuel',
          amount: '5000',
          incurredAt: new Date('2026-07-08T18:00:00.000Z'),
          discardedAt: null,
          isOperationalProvision: false,
        } as never,
      ],
      actualItems: [],
    });

    expect(result.projected).toHaveLength(1);
    expect(result.projected[0]?.source).toBe('trip_tolls');
  });

  it('projects operator payment for scheduled maneuver using planned completion and weekly Saturday', () => {
    const result = buildExpenseCalendarProjection({
      from: '2026-07-01',
      to: '2026-07-31',
      trips: [
        tripStub({
          status: 'scheduled',
          operatorQuota: '3000',
          plannedCompletionAt: new Date('2026-07-07T18:00:00.000Z'),
        }),
      ],
      units: [],
      equipment: [],
      operators: [
        {
          id: 20,
          paymentSchedule: 'weekly',
        } as never,
      ],
      expenses: [],
      actualItems: [],
    });

    const operatorRow = result.projected.find((row) => row.source === 'operator_payment');
    expect(operatorRow).toBeDefined();
    expect(operatorRow?.conceptLabel).toBe('Pago a operador');
    expect(operatorRow?.amount).toBe('3000.00');
    expect(operatorRow?.nature).toBe('committed');
    // Término planeado martes 7 jul → pago semanal sábado 11 jul
    expect(operatorRow?.dueDate).toBe('2026-07-11');
  });

  it('projects operator payment on planned completion date for maneuver schedule', () => {
    const result = buildExpenseCalendarProjection({
      from: '2026-07-01',
      to: '2026-07-31',
      trips: [
        tripStub({
          status: 'scheduled',
          operatorQuota: '2500',
          plannedCompletionAt: new Date('2026-07-15T18:00:00.000Z'),
        }),
      ],
      units: [],
      equipment: [],
      operators: [
        {
          id: 20,
          paymentSchedule: 'maneuver',
        } as never,
      ],
      expenses: [],
      actualItems: [],
    });

    const operatorRow = result.projected.find((row) => row.source === 'operator_payment');
    expect(operatorRow?.dueDate).toBe('2026-07-15');
  });

  it('projects operator payment only after maneuver completion within range', () => {
    const result = buildExpenseCalendarProjection({
      from: '2026-07-01',
      to: '2026-07-31',
      trips: [
        tripStub({
          id: 2,
          status: 'completed',
          operatorQuota: '3000',
          returnAt: new Date('2026-07-03T18:00:00.000Z'),
          plannedDepartureAt: new Date('2026-07-01T18:00:00.000Z'),
        }),
      ],
      units: [],
      equipment: [],
      operators: [
        {
          id: 20,
          paymentSchedule: 'maneuver',
        } as never,
      ],
      expenses: [],
      actualItems: [],
      asOf: new Date('2026-07-05T12:00:00.000Z'),
    });

    expect(result.projected.some((row) => row.source === 'operator_payment')).toBe(true);
  });

  it('merges actual and projected entries sorted by date desc', () => {
    const result = buildExpenseCalendarProjection({
      from: '2026-07-01',
      to: '2026-07-31',
      trips: [tripStub()],
      units: [],
      equipment: [],
      operators: [],
      expenses: [],
      actualItems: [
        {
          id: 5,
          kind: 'fuel',
          category: 'Diésel',
          amount: '1200',
          currency: 'MXN',
          incurredDate: '2026-07-12',
          tripId: null,
        },
      ],
    });

    expect(result.entries[0]?.entryType).toBe('actual');
    expect(result.entries[0]?.dateYmd).toBe('2026-07-12');
    expect(result.summary.grandCount).toBe(3);
  });

  it('classifies calendar markers: directos, eventuales, recurrentes y por pagar', () => {
    const result = buildExpenseCalendarProjection({
      from: '2026-07-01',
      to: '2026-07-31',
      trips: [
        tripStub({
          operatorQuota: '1500',
          plannedCompletionAt: new Date('2026-07-15T18:00:00.000Z'),
        }),
      ],
      units: [
        {
          id: 10,
          plate: 'ABC-12',
          fleetProfile: {
            insuranceContractDate: '2026-01-15',
            insurancePaymentCadence: 'monthly',
            insuranceCost: '5000',
          },
        } as never,
      ],
      equipment: [],
      operators: [{ id: 20, paymentSchedule: 'maneuver' } as never],
      expenses: [],
      actualItems: [
        {
          id: 1,
          kind: 'fuel',
          category: 'Diésel',
          amount: '4000',
          currency: 'MXN',
          incurredDate: '2026-07-05',
          tripId: 1,
        },
        {
          id: 2,
          kind: 'repair',
          category: 'Fuga hidráulica',
          amount: '8500',
          currency: 'MXN',
          incurredDate: '2026-07-06',
          tripId: null,
        },
        {
          id: 3,
          kind: 'insurance',
          category: 'Póliza',
          amount: '5000',
          currency: 'MXN',
          incurredDate: '2026-07-03',
          tripId: null,
        },
      ],
    });

    const byLabel = Object.fromEntries(result.markers.map((m) => [m.label, m]));
    expect(Number(byLabel['Directos']?.amount)).toBe(4000);
    expect(Number(byLabel['Eventuales']?.amount)).toBe(8500);
    expect(Number(byLabel['Recurrentes']?.amount)).toBe(5000);
    expect(Number(byLabel['Por pagar']?.amount)).toBe(
      Number(result.summary.projectedTotalAmount),
    );
  });

  it('paginates merged entries', () => {
    const entries: ExpenseCalendarEntry[] = [
      {
        entryType: 'actual',
        sortDate: '2026-07-03',
        id: 'a1',
        rubroLabel: 'Maniobra',
        conceptLabel: 'Casetas',
        amount: '100.00',
        currency: 'MXN',
        dateYmd: '2026-07-03',
        statusLabel: 'Realizado',
      },
      {
        entryType: 'projected',
        sortDate: '2026-07-02',
        id: 'p1',
        rubroLabel: 'Seguros',
        conceptLabel: 'Póliza',
        amount: '200.00',
        currency: 'MXN',
        dateYmd: '2026-07-02',
        statusLabel: 'Pendiente',
      },
    ];

    const page = paginateExpenseCalendarEntries(entries, 1, 1);
    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.id).toBe('a1');
  });
});
