import {
  coveragePaymentPeriodLabel,
  coverageSchedulePeriodCount,
  coverageMaxCycleDueOnOrBefore,
  listCoverageCycleDueDatesThroughLastPayment,
} from './fleet-coverage-payment-period.util';

describe('fleet-coverage-payment-period.util', () => {
  it('counts monthly and quarterly schedule periods', () => {
    expect(coverageSchedulePeriodCount('Mensual')).toBe(12);
    expect(coverageSchedulePeriodCount('Trimestral')).toBe(4);
    expect(coverageSchedulePeriodCount('Anual')).toBe(0);
  });

  it('builds monthly installment labels from contract and payment dates', () => {
    expect(
      coveragePaymentPeriodLabel('Mensual', '2026-06-01', '2026-06-01'),
    ).toBe('Mensualidad 1/12');
    expect(
      coveragePaymentPeriodLabel('Mensual', '2026-06-01', '2026-07-01'),
    ).toBe('Mensualidad 2/12');
    expect(
      coveragePaymentPeriodLabel('Mensual', '2026-06-01', '2026-08-02'),
    ).toBe('Mensualidad 3/12');
  });

  it('returns null for non-monthly cadences', () => {
    expect(
      coveragePaymentPeriodLabel('Trimestral', '2026-06-01', '2026-09-01'),
    ).toBeNull();
  });

  it('returns null when contract date is missing', () => {
    expect(coveragePaymentPeriodLabel('Mensual', undefined, '2026-07-01')).toBeNull();
  });

  it('lists monthly cycle due dates through snapped last payment reference', () => {
    expect(
      coverageMaxCycleDueOnOrBefore('Mensual', '2026-06-01', '2026-07-05'),
    ).toBe('2026-07-01');
    expect(
      listCoverageCycleDueDatesThroughLastPayment(
        'Mensual',
        '2026-06-01',
        '2026-07-05',
      ),
    ).toEqual(['2026-06-01', '2026-07-01']);
  });
});
