import { BadRequestException } from '@nestjs/common';
import type { CreateTripDto } from '../dto/create-trip.dto';
import {
  MISSING_PLANNED_FIELDS_REASON,
  parseRequiredPlannedScheduleFromCreateDto,
  REQUIRED_PLANNED_SCHEDULE_MESSAGE,
  validatePlannedScheduleUpdate,
} from './resolve-planned-schedule';

function baseDto(overrides: Partial<CreateTripDto> = {}): CreateTripDto {
  return {
    origin: 'A',
    destination: 'B',
    clientName: 'Cliente',
    status: 'scheduled',
    operationType: 'sencillo',
    loadType: 'vacio',
    containerType: '20ft',
    plannedDepartureAt: '2026-06-01T08:00:00.000Z',
    plannedArrivalAt: '2026-06-01T12:00:00.000Z',
    plannedCompletionAt: '2026-06-01T16:00:00.000Z',
    ...overrides,
  };
}

describe('parseRequiredPlannedScheduleFromCreateDto', () => {
  it('accepts explicit planned_* fields', () => {
    const result = parseRequiredPlannedScheduleFromCreateDto(baseDto());
    expect(result.plannedDepartureAt.toISOString()).toBe(
      '2026-06-01T08:00:00.000Z',
    );
    expect(result.plannedArrivalAt.toISOString()).toBe(
      '2026-06-01T12:00:00.000Z',
    );
    expect(result.plannedCompletionAt.toISOString()).toBe(
      '2026-06-01T16:00:00.000Z',
    );
  });

  it('rejects when any planned field is missing', () => {
    expect(() =>
      parseRequiredPlannedScheduleFromCreateDto(
        baseDto({ plannedCompletionAt: undefined }),
      ),
    ).toThrow(BadRequestException);

    try {
      parseRequiredPlannedScheduleFromCreateDto(
        baseDto({ plannedArrivalAt: undefined }),
      );
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).message).toBe(
        REQUIRED_PLANNED_SCHEDULE_MESSAGE,
      );
    }
  });

  it('does not infer from legacy departureAt / returnAt', () => {
    expect(() =>
      parseRequiredPlannedScheduleFromCreateDto(
        baseDto({
          plannedDepartureAt: undefined,
          plannedArrivalAt: undefined,
          plannedCompletionAt: undefined,
          departureAt: '2026-06-01T08:00:00.000Z',
          arrivedAt: '2026-06-01T12:00:00.000Z',
          returnAt: '2026-06-01T16:00:00.000Z',
        }),
      ),
    ).toThrow(REQUIRED_PLANNED_SCHEDULE_MESSAGE);
  });

  it('rejects invalid schedule order', () => {
    expect(() =>
      parseRequiredPlannedScheduleFromCreateDto(
        baseDto({
          plannedDepartureAt: '2026-06-01T16:00:00.000Z',
          plannedArrivalAt: '2026-06-01T12:00:00.000Z',
          plannedCompletionAt: '2026-06-01T08:00:00.000Z',
        }),
      ),
    ).toThrow(BadRequestException);
  });

  it('exports stable missing reason code for audit/logging', () => {
    expect(MISSING_PLANNED_FIELDS_REASON).toBe('missing_planned_fields');
  });
});

describe('validatePlannedScheduleUpdate', () => {
  const trip = {
    plannedDepartureAt: new Date('2026-06-01T08:00:00.000Z'),
    plannedArrivalAt: new Date('2026-06-01T12:00:00.000Z'),
    plannedCompletionAt: new Date('2026-06-01T16:00:00.000Z'),
  };

  it('returns empty patch when no planned fields sent', () => {
    expect(validatePlannedScheduleUpdate(trip, {})).toEqual({});
  });

  it('validates merged plan on partial update', () => {
    const patch = validatePlannedScheduleUpdate(trip, {
      plannedArrivalAt: '2026-06-01T13:00:00.000Z',
    });
    expect(patch.plannedArrivalAt?.toISOString()).toBe(
      '2026-06-01T13:00:00.000Z',
    );
  });

  it('blocks inconsistent partial update', () => {
    expect(() =>
      validatePlannedScheduleUpdate(trip, {
        plannedArrivalAt: '2026-06-01T07:00:00.000Z',
      }),
    ).toThrow(BadRequestException);
  });
});
