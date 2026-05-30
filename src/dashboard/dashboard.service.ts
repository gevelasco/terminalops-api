import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  buildIncidentAuthorLookup,
  formatIncidentAuthorLabel,
} from 'src/common/utils/incident-author.util';
import { Operator } from 'src/operators/entities/operator.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { TripIncident } from 'src/trips/entities/trip-incident.entity';
import { AppUser } from 'src/users/entities/app-user.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Trip)
    private readonly tripsRepo: Repository<Trip>,
    @InjectRepository(TripIncident)
    private readonly incidentsRepo: Repository<TripIncident>,
    @InjectRepository(AppUser)
    private readonly usersRepo: Repository<AppUser>,
    @InjectRepository(Operator)
    private readonly operatorsRepo: Repository<Operator>,
  ) {}

  async listAlerts(companyId: number) {
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

  async listCriticalAlerts(companyId: number) {
    const [incidents, users, operators] = await Promise.all([
      this.incidentsRepo.find({
        where: { trip: { companyId } },
        relations: ['trip'],
        order: { occurredAt: 'DESC' },
        take: 50,
      }),
      this.usersRepo.find({
        where: { companyId },
        select: ['username', 'displayName', 'jobTitle', 'role'],
      }),
      this.operatorsRepo.find({
        where: { companyId },
        select: ['name', 'portalUsername'],
      }),
    ]);
    const authorLookup = buildIncidentAuthorLookup(users, operators);

    return incidents.map((i) => ({
      id: i.id,
      severity: i.severity ?? 'medium',
      kind: 'default',
      title: i.description.slice(0, 80),
      description: i.description,
      maneuverCode: i.trip?.maneuverCode ?? '',
      clientName: i.trip?.clientName ?? '',
      routeLabel: i.trip ? `${i.trip.origin} → ${i.trip.destination}` : '',
      authorLabel: formatIncidentAuthorLabel(i.postedBy, authorLookup),
      detectedAt: i.occurredAt.toISOString(),
    }));
  }
}
