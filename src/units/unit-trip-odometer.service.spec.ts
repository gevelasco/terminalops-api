import { UnitTripOdometerService } from './unit-trip-odometer.service';
import {
  formatStoredKm,
  maintenanceKmControlActive,
  parseStoredKm,
  resolveMaintenanceKmInterval,
} from './unit-trip-odometer.util';

describe('unit-trip-odometer.util', () => {
  it('resolveMaintenanceKmInterval uses company default when enabled', () => {
    expect(resolveMaintenanceKmInterval('150', true, '100')).toBe(100);
  });

  it('resolveMaintenanceKmInterval returns null when company control is off', () => {
    expect(resolveMaintenanceKmInterval(null, false, '100')).toBeNull();
  });

  it('maintenanceKmControlActive follows company flag only', () => {
    expect(maintenanceKmControlActive(true, false)).toBe(false);
    expect(maintenanceKmControlActive(false, true)).toBe(true);
  });
});

describe('UnitTripOdometerService', () => {
  const profileUpdate = jest.fn();
  const tripsUpdate = jest.fn();
  const profileFindOne = jest.fn();
  const companiesFindOne = jest.fn();

  let service: UnitTripOdometerService;

  beforeEach(() => {
    jest.clearAllMocks();
    profileUpdate.mockResolvedValue({ affected: 1 });
    tripsUpdate.mockResolvedValue({ affected: 1 });
    companiesFindOne.mockResolvedValue({
      id: 1,
      maintenanceKmControlEnabled: true,
      maintenanceKmIntervalDefault: '100',
    });
    profileFindOne.mockResolvedValue({
      unitId: 7,
      odometerKm: '1000',
      maintenanceKmCounter: '60',
    });

    service = new UnitTripOdometerService(
      { update: tripsUpdate } as never,
      { findOne: profileFindOne, update: profileUpdate } as never,
      { findOne: companiesFindOne } as never,
    );
  });

  it('credits odometer and increments maintenance counter on completed trip', async () => {
    await service.creditUnitForCompletedTrip({
      id: 50,
      companyId: 1,
      unitId: 7,
      status: 'completed',
      routeDistanceKm: '30',
      unitOdometerKmCredited: undefined,
    } as never);

    expect(tripsUpdate).toHaveBeenCalled();
    expect(profileUpdate).toHaveBeenCalledWith(
      { unitId: 7 },
      expect.objectContaining({
        odometerKm: formatStoredKm(1060),
        maintenanceKmCounter: formatStoredKm(120),
      }),
    );
  });

  it('skips when trip already credited', async () => {
    await service.creditUnitForCompletedTrip({
      id: 50,
      companyId: 1,
      unitId: 7,
      status: 'completed',
      routeDistanceKm: '30',
      unitOdometerKmCredited: '60',
    } as never);

    expect(tripsUpdate).not.toHaveBeenCalled();
    expect(profileUpdate).not.toHaveBeenCalled();
  });
});
