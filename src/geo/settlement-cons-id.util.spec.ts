import {
  normalizeSettlementConsId,
  SETTLEMENT_CONS_ID_MAX_LENGTH,
} from './settlement-cons-id.util';

describe('normalizeSettlementConsId', () => {
  it('keeps short SEPOMex ids unchanged', () => {
    expect(normalizeSettlementConsId('0009', '66380')).toBe('0009');
  });

  it('shortens long Postali slugs within DB limit', () => {
    const slug = 'parque-industrial-finsa-santa-catarina';
    const normalized = normalizeSettlementConsId(slug, '66380');
    expect(normalized).toBeDefined();
    expect(normalized!.length).toBeLessThanOrEqual(SETTLEMENT_CONS_ID_MAX_LENGTH);
    expect(normalizeSettlementConsId(slug, '66380')).toBe(normalized);
  });
});
