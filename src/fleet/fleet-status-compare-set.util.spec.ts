import { updateFleetResourceStatusCompareAndSet } from './fleet-status-compare-set.util';

describe('updateFleetResourceStatusCompareAndSet', () => {
  it('returns false when compare-and-set affects zero rows', async () => {
    const execute = jest.fn().mockResolvedValue({ affected: 0 });
    const repo = {
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute,
      })),
    };

    const ok = await updateFleetResourceStatusCompareAndSet(
      repo as never,
      1,
      7,
      'available',
      'in_use',
    );

    expect(ok).toBe(false);
  });

  it('returns true when status row matches and update applies', async () => {
    const execute = jest.fn().mockResolvedValue({ affected: 1 });
    const repo = {
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute,
      })),
    };

    const ok = await updateFleetResourceStatusCompareAndSet(
      repo as never,
      1,
      7,
      'available',
      'in_use',
    );

    expect(ok).toBe(true);
  });
});
