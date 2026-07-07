import { syncTripIncidentMarkers } from './trip-incident-markers.util';
import { TripIncident } from './entities/trip-incident.entity';
import { Trip } from './entities/trip.entity';

describe('syncTripIncidentMarkers', () => {
  it('marks hasIncident and open count from isIncident entries only', async () => {
    const tripsRepo = {
      update: jest.fn().mockResolvedValue(undefined),
    } as unknown as import('typeorm').Repository<Trip>;
    const incidentsRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 1, isIncident: true, status: 'open' },
        { id: 2, isIncident: false, status: 'closed' },
        { id: 3, isIncident: true, status: 'closed' },
      ] satisfies Pick<TripIncident, 'id' | 'isIncident' | 'status'>[]),
    } as unknown as import('typeorm').Repository<TripIncident>;

    await syncTripIncidentMarkers(tripsRepo, incidentsRepo, 9, 2);

    expect(tripsRepo.update).toHaveBeenCalledWith(
      { id: 9, companyId: 2 },
      { hasIncident: true, openIncidentCount: 0 },
    );
  });
});
