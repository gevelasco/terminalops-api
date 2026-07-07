import type { Repository } from 'typeorm';
import { TripIncident } from './entities/trip-incident.entity';
import { Trip } from './entities/trip.entity';

export async function syncTripIncidentMarkers(
  tripsRepo: Repository<Trip>,
  incidentsRepo: Repository<TripIncident>,
  tripId: number,
  companyId: number,
): Promise<void> {
  const entries = await incidentsRepo.find({
    where: { tripId },
    select: ['id', 'isIncident', 'status'],
  });
  const incidentEntries = entries.filter((row) => row.isIncident);
  await tripsRepo.update(
    { id: tripId, companyId },
    {
      hasIncident: incidentEntries.length > 0,
      // Bitácora: `isIncident` es clasificación; no hay incidentes "abiertos" que bloqueen cierre.
      openIncidentCount: 0,
    },
  );
}
