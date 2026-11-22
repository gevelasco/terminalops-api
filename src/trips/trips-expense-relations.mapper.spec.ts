import { mapTripExpenseRelationsResponse } from './trips.mapper';

describe('mapTripExpenseRelationsResponse', () => {
  it('maps fleet link ids and display labels', () => {
    const result = mapTripExpenseRelationsResponse({
      trip: {
        id: 8,
        maneuverCode: 'VSC-008',
        unitId: 3,
        operatorId: 2,
        tripEquipment: [{ equipmentId: 5 } as { equipmentId: number }],
      },
      unit: {
        id: 3,
        plate: 'ABC123',
        trailerBrandAbbr: 'KW',
        trailerYear: '2022',
      },
      operator: { id: 2, name: 'Juan Pérez' },
      equipment: [
        {
          id: 5,
          plate: 'REM99',
          trailerBrandAbbr: 'FR',
          trailerYear: '2020',
        },
      ],
    });

    expect(result).toMatchObject({
      id: 8,
      maneuverCode: 'VSC-008',
      unitId: 3,
      operatorId: 2,
      equipmentIds: [5],
      operatorName: 'Juan Pérez',
      equipment: [expect.any(String)],
    });
    expect(result.unitOperationalCode).toContain('ABC123');
  });
});