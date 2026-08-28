import { serializeEquipment } from './equipment.serializer';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Unit } from 'src/units/entities/unit.entity';

describe('serializeEquipment assignedUnit', () => {
  it('omits assignedUnit when the unit relation is not loaded', () => {
    const equipment = {
      id: 9,
      companyId: 1,
      unitId: 4,
      hitchPosition: 'lead',
      name: 'Chasis',
      serialNumber: 'SN',
      plate: 'CH-01',
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    } as Equipment;

    const dto = serializeEquipment(equipment);
    expect(dto.unitId).toBe(4);
    expect(dto.assignedUnit).toBeUndefined();
  });

  it('includes a slim assignedUnit for hitch card fields', () => {
    const unit = {
      id: 4,
      plate: '98BL2L',
      name: 'El Primero',
      status: 'available',
      isActive: true,
      trailerBrandAbbr: 'FRE',
      trailerYear: '2012',
      fleetProfile: {
        trailerBrandName: 'Freightliner',
        odometerKm: '120000',
        maintenanceKmCounter: '350',
      },
    } as Unit;
    const equipment = {
      id: 9,
      companyId: 1,
      unitId: 4,
      hitchPosition: 'lead',
      name: 'Chasis',
      serialNumber: 'SN',
      plate: 'CH-01',
      isActive: true,
      unit,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    } as Equipment;

    const dto = serializeEquipment(equipment);
    expect(dto.assignedUnit).toEqual({
      id: 4,
      plate: '98BL2L',
      name: 'El Primero',
      status: 'available',
      isActive: true,
      trailerBrandAbbr: 'FRE',
      trailerYear: '2012',
      trailerBrandName: 'Freightliner',
      odometerKm: '120000',
      maintenanceKmCounter: 350,
    });
  });
});
