import {
  getPlanEntitlements,
  normalizeSubscriptionPlanId,
} from './plan-entitlements';

describe('plan-entitlements', () => {
  it('normalizes legacy plan aliases', () => {
    expect(normalizeSubscriptionPlanId('trial')).toBe('basic');
    expect(normalizeSubscriptionPlanId('professional')).toBe('standard');
    expect(normalizeSubscriptionPlanId('pro+')).toBe('pro');
    expect(normalizeSubscriptionPlanId(undefined)).toBe('basic');
  });

  it('basic plan blocks diesel and advanced tenure', () => {
    const e = getPlanEntitlements('basic');
    expect(e.dieselAutomatic).toBe(false);
    expect(e.maintenancePolicy).toBe(false);
    expect(e.advancedTenure).toBe(false);
    expect(e.maxUnits).toBe(3);
  });

  it('standard and pro allow premium features', () => {
    expect(getPlanEntitlements('standard').dieselAutomatic).toBe(true);
    expect(getPlanEntitlements('pro').maxTripsPerMonth).toBeNull();
  });
});
