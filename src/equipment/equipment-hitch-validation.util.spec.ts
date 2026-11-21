import { BadRequestException } from '@nestjs/common';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { assertEquipmentHitchAssignmentAllowed } from './equipment-hitch-validation.util';

function eq(partial: Partial<Equipment> & Pick<Equipment, 'id' | 'unitId'>): Equipment {
  return {
    companyId: 1,
    name: 'E',
    serialNumber: 'S',
    ...partial,
  } as Equipment;
}

describe('assertEquipmentHitchAssignmentAllowed', () => {
  const unitId = 10;

  it('allows third rear trailer when lead and dolly are hitched', () => {
    const others = [
      eq({ id: 1, unitId, hitchPosition: 'lead', type: 'portacontenedor' }),
      eq({ id: 2, unitId, hitchPosition: 'rear', type: 'dolly' }),
    ];
    expect(() =>
      assertEquipmentHitchAssignmentAllowed({
        unitId,
        hitchPosition: 'rear',
        isSecondTrailer: true,
        othersOnUnit: others,
        excludeEquipmentId: 99,
        equipmentType: 'portacontenedor',
      }),
    ).not.toThrow();
  });

  it('blocks two non-dolly trailers plus a third without dolly path', () => {
    const others = [
      eq({ id: 1, unitId, hitchPosition: 'lead', type: 'caja_seca' }),
      eq({ id: 2, unitId, hitchPosition: 'rear', type: 'caja_seca' }),
    ];
    expect(() =>
      assertEquipmentHitchAssignmentAllowed({
        unitId,
        hitchPosition: 'rear',
        isSecondTrailer: true,
        othersOnUnit: others,
        excludeEquipmentId: 99,
        equipmentType: 'caja_seca',
      }),
    ).toThrow(BadRequestException);
  });

  it('blocks fourth equipment on triple convoy', () => {
    const others = [
      eq({ id: 1, unitId, hitchPosition: 'lead', type: 'portacontenedor' }),
      eq({ id: 2, unitId, hitchPosition: null, type: 'dolly' }),
      eq({ id: 3, unitId, hitchPosition: 'rear', type: 'portacontenedor' }),
    ];
    expect(() =>
      assertEquipmentHitchAssignmentAllowed({
        unitId,
        hitchPosition: 'rear',
        isSecondTrailer: true,
        othersOnUnit: others,
        excludeEquipmentId: 99,
        equipmentType: 'caja_seca',
      }),
    ).toThrow(/convoy completo/i);
  });
});