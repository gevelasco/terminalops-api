import {
  buildInitialGpsService,
  findNewGpsPayments,
  gpsServiceConceptLabel,
} from './fleet-gps-expense-sync.util';

describe('fleet-gps-expense-sync.util', () => {
  it('builds concept labels by cadence', () => {
    expect(gpsServiceConceptLabel('Mensual')).toBe('GPS - mensual');
    expect(gpsServiceConceptLabel('Trimestral')).toBe('GPS - trimestral');
    expect(gpsServiceConceptLabel('Anual')).toBe('GPS - anual');
  });

  it('builds initial GPS service expense on contract date', () => {
    const initial = buildInitialGpsService({
      hasGps: true,
      gpsProviderBrand: 'SkyBitz',
      gpsContractDate: '2026-03-01',
      gpsPrice: 450,
      gpsPaymentCadence: 'Mensual',
      gpsPaymentMethod: 'transfer',
      gpsInvoiceRequired: true,
    });

    expect(initial).toEqual({
      date: '2026-03-01',
      cost: 450,
      category: 'GPS - mensual',
      description: 'Contratación de GPS · SkyBitz (Mensualidad 1/12)',
      vendor: 'SkyBitz',
      paymentMethod: 'transfer',
      invoiceRequired: true,
    });
  });

  it('creates payment expense when last payment date changes', () => {
    const payments = findNewGpsPayments(
      {
        hasGps: true,
        gpsProviderBrand: 'Motive',
        gpsContractDate: '2026-03-01',
        gpsPaymentCadence: 'Mensual',
        gpsPrice: 500,
        gpsLastPaymentDate: '2026-03-01',
        gpsPaymentMethod: 'check',
      },
      {
        hasGps: true,
        gpsLastPaymentDate: '2026-04-01',
      },
    );

    expect(payments).toEqual([
      {
        date: '2026-04-01',
        cost: 500,
        category: 'GPS - mensual',
        description: 'Pago de GPS · Motive (Mensualidad 2/12)',
        vendor: 'Motive',
        paymentMethod: 'check',
        invoiceRequired: false,
      },
    ]);
  });

  it('does not create payment when gpsLastPaymentDate is undefined on sparse dto', () => {
    const payments = findNewGpsPayments(
      {
        hasGps: true,
        gpsProviderBrand: 'Motive',
        gpsPaymentCadence: 'Mensual',
        gpsPrice: 500,
        gpsLastPaymentDate: '2026-03-01',
      },
      {
        insuranceLastPaymentDate: '2026-07-01',
        gpsLastPaymentDate: undefined,
      },
    );

    expect(payments).toEqual([]);
  });
});
