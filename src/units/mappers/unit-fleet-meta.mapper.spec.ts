import type { CreateUnitFleetMetaDto } from 'src/units/dto/create-unit-fleet-meta.dto';
import { fleetMetaDtoToProfile } from './unit-fleet-meta.mapper';

describe('fleetMetaDtoToProfile maintenanceKmCounter', () => {
  it('leaves the counter untouched when the field is omitted', () => {
    const profile = fleetMetaDtoToProfile(1, {
      lastMaintenanceDate: '2026-03-01',
      lastMaintenanceType: 'Mecánica general',
    } as CreateUnitFleetMetaDto);

    expect(profile.maintenanceKmCounter).toBeUndefined();
  });

  it('persists an explicit zero from a full service', () => {
    const profile = fleetMetaDtoToProfile(1, {
      lastMaintenanceDate: '2026-03-01',
      lastMaintenanceType: 'Servicio completo',
      maintenanceKmCounter: 0,
    } as CreateUnitFleetMetaDto);

    expect(profile.maintenanceKmCounter).toBe('0');
  });

  it('persists an explicit counter', () => {
    const profile = fleetMetaDtoToProfile(1, {
      maintenanceKmCounter: 12500,
    } as CreateUnitFleetMetaDto);

    expect(profile.maintenanceKmCounter).toBe('12500');
  });
});
