import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { Trip } from '../entities/trip.entity';
import { TripIncident } from '../entities/trip-incident.entity';
import { syncTripIncidentMarkers } from '../trip-incident-markers.util';
import { calculateTripDelays } from './calculate-trip-delays';
import {
  evaluateTripLifecycle,
  resolveEffectiveCompletionAt,
  resolveTripLifecycleStatus,
} from './evaluate-trip-lifecycle';
import { TripAuditService } from './trip-audit.service';
import { UnitTripOdometerService } from 'src/units/unit-trip-odometer.service';
import { TripFleetStatusSyncService } from './trip-fleet-status-sync.service';
import {
  ACTIVE_TRIP_LIFECYCLE_STATUSES,
  type TripLifecycleStatus,
} from './trip-lifecycle.types';

/** Advisory lock global para evitar cron concurrente en múltiples instancias. */
const LIFECYCLE_CRON_LOCK_KEY = 74_027_001;

/** Al cerrar por lifecycle, usa fin real o planeado (no «ahora» en maniobras retroactivas). */
function resolveCompletedAtOnTransition(trip: Trip, transitionedAt: Date): Date {
  if (trip.returnAt) {
    return trip.returnAt instanceof Date ? trip.returnAt : new Date(trip.returnAt);
  }
  const effective = resolveEffectiveCompletionAt({
    plannedCompletionAt: trip.plannedCompletionAt,
    actualCompletionAt: null,
  });
  if (effective.getTime() <= transitionedAt.getTime()) {
    return effective;
  }
  return transitionedAt;
}

export interface TripLifecycleRunResult {
  scanned: number;
  transitioned: number;
  skipped: number;
}

@Injectable()
export class TripLifecycleService {
  private readonly logger = new Logger(TripLifecycleService.name);
  private cronInProgress = false;
  private readonly companyFreshInFlight = new Map<
    number,
    Promise<TripLifecycleRunResult>
  >();

  constructor(
    @InjectRepository(Trip)
    private readonly tripsRepo: Repository<Trip>,
    @InjectRepository(TripIncident)
    private readonly incidentsRepo: Repository<TripIncident>,
    private readonly auditService: TripAuditService,
    private readonly fleetStatusSync: TripFleetStatusSyncService,
    private readonly unitTripOdometer: UnitTripOdometerService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Evalúa un trip y devuelve el siguiente status o null si no hay cambio.
   * Función central requerida por el diseño.
   */
  evaluateTripLifecycle(trip: Trip, now: Date = new Date()) {
    return evaluateTripLifecycle({
      status: trip.status as TripLifecycleStatus,
      plannedDepartureAt: trip.plannedDepartureAt,
      plannedCompletionAt: trip.plannedCompletionAt,
      actualCompletionAt: trip.returnAt ?? null,
      now,
    });
  }

  /** Resuelve status final tras create (p. ej. maniobra histórica en el pasado). */
  resolveStatusOnCreate(trip: Trip, now: Date = new Date()): TripLifecycleStatus {
    return resolveTripLifecycleStatus({
      status: trip.status as TripLifecycleStatus,
      plannedDepartureAt: trip.plannedDepartureAt,
      plannedCompletionAt: trip.plannedCompletionAt,
      actualCompletionAt: trip.returnAt ?? null,
      now,
    });
  }

  /**
   * Aplica transición si corresponde. Idempotente: no escribe si el status no cambia.
   */
  async applyLifecycleForTrip(
    trip: Trip,
    now: Date = new Date(),
    source: 'scheduler' | 'system' = 'scheduler',
  ): Promise<boolean> {
    await syncTripIncidentMarkers(
      this.tripsRepo,
      this.incidentsRepo,
      trip.id,
      trip.companyId,
    );
    const fresh = await this.tripsRepo.findOne({
      where: { id: trip.id, companyId: trip.companyId, deletedAt: IsNull() },
    });
    if (!fresh) {
      return false;
    }
    Object.assign(trip, fresh);

    const evaluation = this.evaluateTripLifecycle(trip, now);
    if (!evaluation.nextStatus || evaluation.nextStatus === trip.status) {
      await this.refreshDelayMetrics(trip.id, now);
      return false;
    }

    const fromStatus = trip.status;
    const toStatus = evaluation.nextStatus;
    const transitionedAt = now;

    const updateResult = await this.tripsRepo.update(
      { id: trip.id, companyId: trip.companyId, status: fromStatus },
      {
        status: toStatus,
        statusChangedAt: transitionedAt,
        statusChangedBy: source,
        ...(toStatus === 'completed'
          ? {
              completedAt: resolveCompletedAtOnTransition(trip, transitionedAt),
            }
          : {}),
      },
    );

    if (!updateResult.affected) {
      return false;
    }

    await this.auditService.recordLifecycleStatusChange({
      tripId: trip.id,
      companyId: trip.companyId,
      fromStatus,
      toStatus,
      occurredAt: transitionedAt,
    });

    trip.status = toStatus;
    await this.refreshDelayMetrics(trip.id, now);
    await this.fleetStatusSync.syncForTrip(trip);
    if (toStatus === 'completed') {
      await this.unitTripOdometer.creditUnitForCompletedTrip(trip);
    }

    this.logger.log(
      `Trip ${trip.id} lifecycle ${fromStatus} → ${toStatus} (${source})`,
    );

    return true;
  }

  /** Ejecuta el motor para un trip hasta estado estable (máx. 3 saltos). */
  async applyLifecycleChainForTrip(
    trip: Trip,
    now: Date = new Date(),
    source: 'scheduler' | 'system' = 'scheduler',
  ): Promise<number> {
    let transitions = 0;
    for (let i = 0; i < 3; i += 1) {
      const changed = await this.applyLifecycleForTrip(trip, now, source);
      if (!changed) {
        break;
      }
      transitions += 1;
      const reloaded = await this.tripsRepo.findOne({
        where: { id: trip.id, companyId: trip.companyId },
      });
      if (!reloaded) {
        break;
      }
      Object.assign(trip, reloaded);
    }
    return transitions;
  }

  /**
   * Evalúa solo una maniobra (p. ej. al abrir detalle). Costo O(1): sin escanear la empresa.
   * El cron sigue siendo la vía principal; esto evita mostrar estatus obsoleto en el drawer.
   */
  async ensureTripLifecycleFresh(
    companyId: number,
    tripId: number,
    now: Date = new Date(),
  ): Promise<void> {
    const trip = await this.tripsRepo.findOne({
      where: { id: tripId, companyId, deletedAt: IsNull() },
    });
    if (!trip || !this.tripNeedsLifecycleEvaluation(trip, now)) {
      return;
    }
    await this.applyLifecycleChainForTrip(trip, now, 'system');
  }

  /**
   * Adelanta transiciones vencidas de una empresa antes de lecturas agregadas
   * (listado, mapa, dashboard). No usar en detalle de una sola maniobra.
   */
  async ensureCompanyLifecycleFresh(
    companyId: number,
    now: Date = new Date(),
  ): Promise<TripLifecycleRunResult> {
    const inFlight = this.companyFreshInFlight.get(companyId);
    if (inFlight) {
      return inFlight;
    }

    const run = this.runCompanyLifecycleFresh(companyId, now).finally(() => {
      this.companyFreshInFlight.delete(companyId);
    });
    this.companyFreshInFlight.set(companyId, run);
    return run;
  }

  /**
   * Cron: candidatos con índices parciales + advisory lock.
   * Solo programadas y en curso; completadas/canceladas no se escanean.
   */
  async runScheduledEvaluation(now: Date = new Date()): Promise<TripLifecycleRunResult> {
    if (this.cronInProgress) {
      this.logger.debug('Lifecycle cron skipped: previous run still in progress');
      return { scanned: 0, transitioned: 0, skipped: 0 };
    }

    this.cronInProgress = true;
    try {
      const lockAcquired = await this.tryAcquireCronLock();
      if (!lockAcquired) {
        this.logger.debug('Lifecycle cron skipped: advisory lock held by another instance');
        return { scanned: 0, transitioned: 0, skipped: 0 };
      }

      try {
        return await this.runScheduledEvaluationLocked(now);
      } finally {
        await this.releaseCronLock();
      }
    } finally {
      this.cronInProgress = false;
    }
  }

  private async runCompanyLifecycleFresh(
    companyId: number,
    now: Date,
  ): Promise<TripLifecycleRunResult> {
    const candidates = await this.findLifecycleCandidates(now, companyId);
    let transitioned = 0;

    for (const trip of candidates) {
      const steps = await this.applyLifecycleChainForTrip(trip, now, 'system');
      if (steps > 0) {
        transitioned += steps;
      }
    }

    return {
      scanned: candidates.length,
      transitioned,
      skipped: candidates.length - transitioned,
    };
  }

  private async runScheduledEvaluationLocked(
    now: Date,
  ): Promise<TripLifecycleRunResult> {
    const candidates = await this.findLifecycleCandidates(now);
    let transitioned = 0;

    for (const trip of candidates) {
      const steps = await this.applyLifecycleChainForTrip(trip, now, 'scheduler');
      if (steps > 0) {
        transitioned += steps;
      }
    }

    await this.refreshDelaysForActiveTrips(now);

    return {
      scanned: candidates.length,
      transitioned,
      skipped: candidates.length - transitioned,
    };
  }

  private async findLifecycleCandidates(
    now: Date,
    companyId?: number,
  ): Promise<Trip[]> {
    const qb = this.tripsRepo
      .createQueryBuilder('trip')
      .where('trip.status IN (:...statuses)', {
        statuses: [...ACTIVE_TRIP_LIFECYCLE_STATUSES],
      })
      .andWhere('trip.planned_departure_at IS NOT NULL')
      .andWhere('trip.planned_completion_at IS NOT NULL')
      .andWhere(
        `(
          (trip.status = 'scheduled' AND trip.planned_departure_at <= :now)
          OR (
            trip.status = 'in_transit'
            AND COALESCE(trip.return_at, trip.planned_completion_at) <= :now
          )
        )`,
        { now },
      );

    if (companyId != null) {
      qb.andWhere('trip.companyId = :companyId', { companyId });
    }

    qb.andWhere('trip.deleted_at IS NULL');

    return qb.orderBy('trip.id', 'ASC').getMany();
  }

  private async refreshDelaysForActiveTrips(now: Date): Promise<void> {
    const active = await this.tripsRepo.find({
      where: {
        status: In([...ACTIVE_TRIP_LIFECYCLE_STATUSES]),
        deletedAt: IsNull(),
      },
      select: [
        'id',
        'companyId',
        'status',
        'plannedDepartureAt',
        'plannedArrivalAt',
        'plannedCompletionAt',
        'departureAt',
        'arrivedAt',
        'returnAt',
        'isDelayed',
        'delayPhase',
        'delayDepartureMinutes',
        'delayArrivalMinutes',
        'delayCompletionMinutes',
      ],
    });

    for (const trip of active) {
      await this.refreshDelayMetrics(trip.id, now, trip);
    }
  }

  /** Recalcula retrasos de una maniobra tras actualizar fechas reales (sin esperar cron). */
  async refreshDelayMetricsForTrip(
    tripId: number,
    now: Date = new Date(),
  ): Promise<void> {
    await this.refreshDelayMetrics(tripId, now);
  }

  private async refreshDelayMetrics(
    tripId: number,
    now: Date,
    tripSnapshot?: Trip,
  ): Promise<void> {
    const trip =
      tripSnapshot ??
      (await this.tripsRepo.findOne({
        where: { id: tripId },
      }));
    if (!trip) {
      return;
    }

    const metrics = calculateTripDelays({
      status: trip.status,
      plannedDepartureAt: trip.plannedDepartureAt,
      plannedArrivalAt: trip.plannedArrivalAt,
      plannedCompletionAt: trip.plannedCompletionAt,
      actualDepartureAt: trip.departureAt,
      actualArrivalAt: trip.arrivedAt,
      actualCompletionAt: trip.returnAt,
      now,
    });

    const unchanged =
      trip.isDelayed === metrics.isDelayed &&
      (trip.delayPhase ?? 'none') === metrics.delayPhase &&
      trip.delayDepartureMinutes === metrics.delayDepartureMinutes &&
      trip.delayArrivalMinutes === metrics.delayArrivalMinutes &&
      trip.delayCompletionMinutes === metrics.delayCompletionMinutes;

    if (unchanged) {
      return;
    }

    await this.tripsRepo.update(
      { id: trip.id },
      {
        isDelayed: metrics.isDelayed,
        delayPhase: metrics.delayPhase,
        delayDepartureMinutes: metrics.delayDepartureMinutes ?? undefined,
        delayArrivalMinutes: metrics.delayArrivalMinutes ?? undefined,
        delayCompletionMinutes: metrics.delayCompletionMinutes ?? undefined,
      },
    );
  }

  private tripNeedsLifecycleEvaluation(trip: Trip, now: Date): boolean {
    const status = trip.status;
    if (!(ACTIVE_TRIP_LIFECYCLE_STATUSES as readonly string[]).includes(status)) {
      return false;
    }
    if (status === 'scheduled') {
      return trip.plannedDepartureAt.getTime() <= now.getTime();
    }
    const effectiveEnd = resolveEffectiveCompletionAt({
      plannedCompletionAt: trip.plannedCompletionAt,
      actualCompletionAt: trip.returnAt ?? null,
    });
    return effectiveEnd.getTime() <= now.getTime();
  }

  private async tryAcquireCronLock(): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT pg_try_advisory_lock($1) AS acquired`,
      [LIFECYCLE_CRON_LOCK_KEY],
    );
    return Boolean(rows?.[0]?.acquired);
  }

  private async releaseCronLock(): Promise<void> {
    await this.dataSource.query(`SELECT pg_advisory_unlock($1)`, [
      LIFECYCLE_CRON_LOCK_KEY,
    ]);
  }
}
