import {
  pickEquipmentUserMutableFields,
  pickOperatorUserMutableFields,
  pickUnitUserMutableFields,
} from './fleet-resource-user-patch.util';

describe('fleet-resource-user-patch.util', () => {
  it('pickUnitUserMutableFields whitelists only allowed keys', () => {
    expect(
      pickUnitUserMutableFields({
        plate: 'ABC',
        isActive: false,
        companyId: 99,
      }),
    ).toEqual({ plate: 'ABC', isActive: false });
  });

  it('pickUnitUserMutableFields rejects status in source', () => {
    expect(() =>
      pickUnitUserMutableFields({ status: 'available' }),
    ).toThrow('status is system-owned');
  });

  it('pickEquipmentUserMutableFields rejects status', () => {
    expect(() =>
      pickEquipmentUserMutableFields({ name: 'x', status: 'in_use' }),
    ).toThrow('status is system-owned');
  });

  it('pickOperatorUserMutableFields rejects status', () => {
    expect(() =>
      pickOperatorUserMutableFields({ name: 'Op', status: 'leave' }),
    ).toThrow('status is system-owned');
  });
});
