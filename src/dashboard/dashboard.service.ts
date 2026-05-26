import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trip } from 'src/trips/entities/trip.entity';
import { TripIncident } from 'src/trips/entities/trip-incident.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Trip)
    private readonly tripsRepo: Repository<Trip>,
    @InjectRepository(TripIncident)
    private readonly incidentsRepo: Repository<TripIncident>,
  ) {}

  async listAlerts(companyId: string) {
    const [scheduled, inTransit, completed] = await Promise.all([
      this.tripsRepo.count({ where: { companyId, status: 'scheduled' } }),
      this.tripsRepo.count({ where: { companyId, status: 'in_transit' } }),
      this.tripsRepo.count({ where: { companyId, status: 'completed' } }),
    ]);
    return [
      {
        id: 'kpi-scheduled',
        severity: 'neutral',
        message: String(scheduled),
        title: 'Maniobras programadas',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'kpi-in-transit',
        severity: 'warning',
        message: String(inTransit),
        title: 'En tránsito',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'kpi-completed',
        severity: 'success',
        message: String(completed),
        title: 'Completadas',
        createdAt: new Date().toISOString(),
      },
    ];
  }

  async listCriticalAlerts(companyId: string) {
    const incidents = await this.incidentsRepo.find({
      where: { trip: { companyId } },
      relations: ['trip'],
      order: { occurredAt: 'DESC' },
      take: 50,
    });

    return incidents.map((i) => ({
      id: i.id,
      severity: i.severity ?? 'medium',
      kind: 'default',
      title: i.description.slice(0, 80),
      description: i.description,
      maneuverCode: i.trip?.maneuverCode ?? '',
      clientName: i.trip?.clientName ?? '',
      routeLabel: i.trip ? `${i.trip.origin} → ${i.trip.destination}` : '',
      authorLabel: i.postedBy,
      detectedAt: i.occurredAt.toISOString(),
    }));
  }
}
