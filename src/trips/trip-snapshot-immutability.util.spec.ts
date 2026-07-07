import { BadRequestException } from '@nestjs/common';
import {
  assertDestinationRateSnapshotLocked,
  assertNoSnapshotMutation,
  assertNoSnapshotMutationDto,
  TRIP_SNAPSHOT_IMMUTABLE_MESSAGE,
} from './trip-snapshot-immutability.util';

describe('trip-snapshot-immutability.util (A4)', () => {
  it('rechaza mutación de origen en body', () => {
    expect(() =>
      assertNoSnapshotMutation({ originPostalCode: '64000' }),
    ).toThrow(new BadRequestException(TRIP_SNAPSHOT_IMMUTABLE_MESSAGE));
  });

  it('rechaza mutación de destino en body snake_case', () => {
    expect(() =>
      assertNoSnapshotMutation({ destination_locality: 'Centro' }),
    ).toThrow(TRIP_SNAPSHOT_IMMUTABLE_MESSAGE);
  });

  it('rechaza destinationRateId en dto', () => {
    expect(() =>
      assertNoSnapshotMutationDto({ destinationRateId: '12' }),
    ).toThrow(TRIP_SNAPSHOT_IMMUTABLE_MESSAGE);
  });

  it('permite body sin campos snapshot', () => {
    expect(() =>
      assertNoSnapshotMutation({ status: 'in_transit', unitId: '3' }),
    ).not.toThrow();
  });

  it('bloquea cambio de tarifa en maniobra confirmada', () => {
    expect(() =>
      assertDestinationRateSnapshotLocked(
        {
          destinationRateId: 5,
          clientCollectedAt: new Date(),
          status: 'completed',
          hasClientBilling: true,
        },
        9,
      ),
    ).toThrow(TRIP_SNAPSHOT_IMMUTABLE_MESSAGE);
  });
});
