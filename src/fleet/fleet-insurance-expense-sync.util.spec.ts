import {
  buildInitialInsurancePremium,
  findNewInsurancePayments,
} from './fleet-insurance-expense-sync.util';

describe('fleet-insurance-expense-sync.util', () => {
  it('builds initial premium at contract date', () => {
    expect(
      buildInitialInsurancePremium({
        insuranceContractDate: '2026-06-01',
        insuranceCarrierName: 'GNP',
        insurancePolicyNumber: '000987345',
        insurancePaymentCadence: 'Mensual',
        insuranceCost: 6500,
        insurancePaymentMethod: 'transfer',
        insuranceInvoiceRequired: true,
      }),
    ).toEqual({
      date: '2026-06-01',
      cost: 6500,
      category: 'Póliza - mensual',
      description: 'Contratación de póliza · 000987345 (Mensualidad 1/12)',
      vendor: 'GNP',
      paymentMethod: 'transfer',
      invoiceRequired: true,
    });
  });

  it('creates monthly payment with installment label', () => {
    expect(
      findNewInsurancePayments(
        {
          insuranceContractDate: '2026-06-01',
          insuranceLastPaymentDate: '2026-07-01',
          insuranceCost: '6500',
          insurancePaymentCadence: 'Mensual',
        },
        {
          insuranceLastPaymentDate: '2026-08-02',
          insuranceCarrierName: 'GNP',
          insurancePolicyNumber: '0008345312',
          insurancePaymentCadence: 'Mensual',
        },
      ),
    ).toEqual([
      {
        date: '2026-08-02',
        cost: 6500,
        category: 'Póliza - mensual',
        description: 'Pago de póliza · 0008345312 (Mensualidad 3/12)',
        vendor: 'GNP',
        paymentMethod: undefined,
        invoiceRequired: false,
      },
    ]);
  });

  it('creates payment candidate when last payment date changes', () => {
    expect(
      findNewInsurancePayments(
        { insuranceLastPaymentDate: '2026-07-02', insuranceCost: '7500' },
        {
          insuranceLastPaymentDate: '2026-08-02',
          insuranceCarrierName: 'Qualitas',
          insurancePolicyNumber: '000789789',
          insurancePaymentCadence: 'Trimestral',
          insurancePaymentMethod: 'check',
        },
      ),
    ).toEqual([
      {
        date: '2026-08-02',
        cost: 7500,
        category: 'Póliza - trimestral',
        description: 'Pago de póliza · 000789789 (Trimestral)',
        vendor: 'Qualitas',
        paymentMethod: 'check',
        invoiceRequired: false,
      },
    ]);
  });

  it('skips when last payment date is unchanged', () => {
    expect(
      findNewInsurancePayments(
        { insuranceLastPaymentDate: '2026-08-02' },
        { insuranceLastPaymentDate: '2026-08-02', insuranceCost: 7500 },
      ),
    ).toEqual([]);
  });
});
