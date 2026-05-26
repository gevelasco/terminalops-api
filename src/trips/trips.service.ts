import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourcePublicIdService } from 'src/common/tenant/resource-public-id.service';
import { Client } from 'src/clients/entities/client.entity';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { TripEquipment } from 'src/trips/entities/trip-equipment.entity';
import { TripIncident } from 'src/trips/entities/trip-incident.entity';
import { AddIncidentDto } from './dto/add-incident.dto';
import { CancelTripDto } from './dto/cancel-trip.dto';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { mapTripToResponse } from './trips.mapper';

function initialsFromClientName(name: string): string {
  const raw = name.trim();
  if (!raw) return 'GN';
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return parts
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase();
}

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip)
    private readonly tripsRepo: Repository<Trip>,
    @InjectRepository(TripEquipment)
    private readonly tripEquipmentRepo: Repository<TripEquipment>,
    @InjectRepository(TripIncident)
    private readonly incidentsRepo: Repository<TripIncident>,
    @InjectRepository(Equipment)
    private readonly equipmentRepo: Repository<Equipment>,
    @InjectRepository(Client)
    private readonly clientsRepo: Repository<Client>,
    private readonly publicIds: ResourcePublicIdService,
  ) {}

  private tripRelations = [
    'client',
    'unit',
    'operator',
    'tripEquipment',
    'incidents',
  ] as const;

  async findAll(companyId: string, companyPublicId: number) {
    const [trips, equipment] = await Promise.all([
      this.tripsRepo.find({
        where: { companyId },
        relations: [...this.tripRelations],
        order: { scheduledAt: 'DESC' },
      }),
      this.equipmentRepo.find({ where: { companyId } }),
    ]);
    return trips.map((t) => mapTripToResponse(t, equipment, companyPublicId));
  }

  async findOne(
    companyId: string,
    tripPublicId: number,
    companyPublicId: number,
  ) {
    const trip = await this.getTripEntity(companyId, tripPublicId);
    const equipment = await this.equipmentRepo.find({ where: { companyId } });
    return mapTripToResponse(trip, equipment, companyPublicId);
  }

  async create(companyId: string, companyPublicId: number, dto: CreateTripDto) {
    const seq = await this.nextManeuverSequence(companyId);
    const initials = initialsFromClientName(dto.clientName);
    const maneuverCode =
      dto.maneuverCode?.trim() || `${initials}-${String(seq).padStart(5, '0')}`;

    let clientId = dto.clientId
      ? await this.publicIds.resolveClientRef(companyId, dto.clientId)
      : undefined;
    if (!clientId && dto.clientName) {
      const client = await this.clientsRepo.findOne({
        where: { companyId, name: dto.clientName.trim() },
      });
      clientId = client?.id;
    }

    const entity = this.tripsRepo.create({
      companyId,
      maneuverCode,
      origin: dto.origin,
      destination: dto.destination,
      clientId,
      clientName: dto.clientName,
      unitId: await this.publicIds.resolveUnitRef(companyId, dto.unitId),
      operatorId: await this.publicIds.resolveOperatorRef(companyId, dto.operatorId),
      status: dto.status ?? 'scheduled',
      programmedAt: new Date(dto.programmedAt),
      scheduledAt: new Date(dto.scheduledAt),
      operationType: dto.operationType,
      loadType: dto.loadType,
      containerType: dto.containerType,
      cargoDescription: dto.cargoDescription,
      approximateWeightTons: dto.approximateWeightTons,
      creditDays: dto.creditDays ?? 0,
      routeDistanceKm: dto.routeDistanceKm?.toString(),
      maneuverKind: dto.maneuverKind,
      dieselLiters: dto.dieselLiters,
      dieselAmount: dto.dieselAmount,
      clientCharge: dto.clientCharge,
      hasClientBilling: dto.hasClientBilling ?? !!dto.clientName?.trim(),
    });
    const trip = await this.tripsRepo.save(entity);

    if (dto.equipmentIds?.length) {
      const internalEquipmentIds = await this.publicIds.resolveEquipmentRefs(
        companyId,
        dto.equipmentIds,
      );
      await this.syncEquipment(trip.id, internalEquipmentIds);
    }

    return this.findOne(companyId, trip.publicId, companyPublicId);
  }

  async update(
    companyId: string,
    tripPublicId: number,
    companyPublicId: number,
    dto: UpdateTripDto,
  ) {
    const internalId = await this.publicIds.resolveTripInternalId(
      companyId,
      tripPublicId,
    );
    const {
      equipmentIds,
      programmedAt,
      scheduledAt,
      routeDistanceKm,
      clientId,
      unitId,
      operatorId,
      ...rest
    } = dto;
    await this.tripsRepo.update(
      { id: internalId, companyId },
      {
        ...rest,
        ...(programmedAt && { programmedAt: new Date(programmedAt) }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
        ...(routeDistanceKm !== undefined && {
          routeDistanceKm: String(routeDistanceKm),
        }),
        ...(clientId !== undefined && {
          clientId: await this.publicIds.resolveClientRef(companyId, clientId),
        }),
        ...(unitId !== undefined && {
          unitId: await this.publicIds.resolveUnitRef(companyId, unitId),
        }),
        ...(operatorId !== undefined && {
          operatorId: await this.publicIds.resolveOperatorRef(
            companyId,
            operatorId,
          ),
        }),
      },
    );
    if (equipmentIds) {
      const internalEquipmentIds = await this.publicIds.resolveEquipmentRefs(
        companyId,
        equipmentIds,
      );
      await this.syncEquipment(internalId, internalEquipmentIds);
    }
    return this.findOne(companyId, tripPublicId, companyPublicId);
  }

  async cancel(
    companyId: string,
    tripPublicId: number,
    companyPublicId: number,
    dto: CancelTripDto,
  ) {
    const trip = await this.getTripEntity(companyId, tripPublicId);
    const note = dto.note?.trim() ?? '';
    if (dto.falseManeuver && !note) {
      throw new BadRequestException(
        'La maniobra en falso requiere un detalle o explicación breve.',
      );
    }
    if (trip.status === 'completed') {
      throw new BadRequestException(
        'No se puede cancelar una maniobra ya completada.',
      );
    }
    await this.tripsRepo.update(
      { id: trip.id, companyId },
      {
        status: 'cancelled',
        falseManeuver: dto.falseManeuver || undefined,
        cancellationNote: note || undefined,
      },
    );
    return this.findOne(companyId, tripPublicId, companyPublicId);
  }

  async addIncident(
    companyId: string,
    tripPublicId: number,
    companyPublicId: number,
    dto: AddIncidentDto,
  ) {
    const trip = await this.getTripEntity(companyId, tripPublicId);
    await this.incidentsRepo.save(
      this.incidentsRepo.create({
        tripId: trip.id,
        description: dto.description.trim(),
        postedBy: dto.postedBy.trim(),
        occurredAt: new Date(),
      }),
    );
    await this.tripsRepo.update({ id: trip.id, companyId }, { hasIncident: true });
    return this.findOne(companyId, tripPublicId, companyPublicId);
  }

  async setClientCollected(
    companyId: string,
    tripPublicId: number,
    companyPublicId: number,
    collected: boolean,
  ) {
    const trip = await this.getTripEntity(companyId, tripPublicId);
    if (trip.hasClientBilling === false) {
      throw new BadRequestException(
        'Esta maniobra no tiene cobro a cliente registrado.',
      );
    }
    if (trip.status !== 'completed' && trip.status !== 'cancelled') {
      throw new BadRequestException(
        'Solo maniobras completadas o canceladas pueden marcarse como cobradas.',
      );
    }
    await this.tripsRepo.update(
      { id: trip.id, companyId },
      {
        clientCollectedAt: collected ? new Date() : null,
      },
    );
    return this.findOne(companyId, tripPublicId, companyPublicId);
  }

  async remove(companyId: string, tripPublicId: number) {
    const internalId = await this.publicIds.resolveTripInternalId(
      companyId,
      tripPublicId,
    );
    await this.tripsRepo.delete({ id: internalId, companyId });
    return { id: tripPublicId, deleted: true };
  }

  private async getTripEntity(companyId: string, tripPublicId: number) {
    const trip = await this.tripsRepo.findOne({
      where: { companyId, publicId: tripPublicId },
      relations: [...this.tripRelations],
    });
    if (!trip) {
      throw new NotFoundException(`Trip ${tripPublicId} not found`);
    }
    return trip;
  }

  private async nextManeuverSequence(companyId: string): Promise<number> {
    const rows = await this.tripsRepo.find({
      where: { companyId },
      select: ['maneuverCode'],
    });
    let max = 0;
    for (const row of rows) {
      const match = /-(\d+)$/.exec(row.maneuverCode);
      if (match) {
        max = Math.max(max, Number(match[1]));
      }
    }
    return max + 1;
  }

  private async syncEquipment(tripId: string, equipmentIds: string[]) {
    await this.tripEquipmentRepo.delete({ tripId });
    const rows = equipmentIds.slice(0, 2).map((equipmentId, index) =>
      this.tripEquipmentRepo.create({
        tripId,
        equipmentId,
        position: index + 1,
      }),
    );
    if (rows.length) {
      await this.tripEquipmentRepo.save(rows);
    }
  }
}
