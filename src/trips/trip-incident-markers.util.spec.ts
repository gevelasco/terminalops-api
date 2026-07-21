import { syncTripIncidentMarkers } from './trip-incident-markers.util';
import type { TripIncident } from './entities/trip-incident.entity';

describe('syncTripIncidentMarkers', () => {
  it('sets hasIncident when any entry is marked as incident', async () => {
    const tripsRepo = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const incidentsRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 1, isIncident: true },
        { id: 2, isIncident: false },
        { id: 3, isIncident: true },
      ] satisfies Pick<TripIncident, 'id' | 'isIncident'>[]),
    };

    await syncTripIncidentMarkers(
      tripsRepo as never,
      incidentsRepo as never,
      10,
      1,
    );

    expect(incidentsRepo.find).toHaveBeenCalledWith({
      where: { tripId: 10 },
      select: ['id', 'isIncident'],
    });
    expect(tripsRepo.update).toHaveBeenCalledWith(
      { id: 10, companyId: 1 },
      { hasIncident: true },
    );
  });

  it('clears hasIncident when no incident-marked entries exist', async () => {
    const tripsRepo = {
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const incidentsRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 1, isIncident: false },
      ] satisfies Pick<TripIncident, 'id' | 'isIncident'>[]),
    };

    await syncTripIncidentMarkers(
      tripsRepo as never,
      incidentsRepo as never,
      10,
      1,
    );

    expect(tripsRepo.update).toHaveBeenCalledWith(
      { id: 10, companyId: 1 },
      { hasIncident: false },
    );
  });
});
