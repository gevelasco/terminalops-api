import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  buildIncidentAuthorLookup,
  type IncidentAuthorLookup,
} from 'src/common/utils/incident-author.util';
import { parseOptionalNumericId } from 'src/common/utils/tenant.util';
import { AppUser } from 'src/users/entities/app-user.entity';
import { Client } from 'src/clients/entities/client.entity';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Operator } from 'src/operators/entities/operator.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { TripEquipment } from 'src/trips/entities/trip-equipment.entity';
import { TripIncident } from 'src/trips/entities/trip-incident.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { AddIncidentDto } from './dto/add-incident.dto';
import { CancelTripDto } from './dto/cancel-trip.dto';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { mapTripToResponse } from './trips.mapper';
import { FuelPriceService } from 'src/fuel/fuel-price.service';
import { OperationConfigurationsService } from 'src/operation-configurations/operation-configurations.service';
import { buildUnitOperationalId } from 'src/common/utils/unit-operational-id.util';
import { normalizeOperationConfigCode } from 'src/common/utils/operation-config-code.util';
import { resolveTripOperationalDistance } from './trip-operational-distance.util';
import {
  formatManeuverCode,
  maneuverCodePrefixFromClientName,
} from './maneuver-code.util';

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
    @InjectRepository(Unit)
    private readonly unitsRepo: Repository<Unit>,
    @InjectRepository(Operator)
    private readonly operatorsRepo: Repository<Operator>,
    @InjectRepository(AppUser)
    private readonly usersRepo: Repository<AppUser>,
    private readonly fuelPriceService: FuelPriceService,
    private readonly operationConfigurations: OperationConfigurationsService,
  ) {}

  private tripRelations = [
    'client',
    'unit',
    'operator',
    'tripEquipment',
    'incidents',
  ] as const;

  async findAll(companyId: number) {
    const [trips, equipment, authorLookup] = await Promise.all([
      this.tripsRepo.find({
        where: { companyId },
        relations: [...this.tripRelations],
        order: { scheduledAt: 'DESC' },
      }),
      this.equipmentRepo.find({ where: { companyId } }),
      this.loadAuthorLookup(companyId),
    ]);
    return trips.map((t) => mapTripToResponse(t, equipment, authorLookup));
  }

  async findOne(companyId: number, tripId: number) {
    const [trip, equipment, authorLookup] = await Promise.all([
      this.getTripEntity(companyId, tripId),
      this.equipmentRepo.find({ where: { companyId } }),
      this.loadAuthorLookup(companyId),
    ]);
    return mapTripToResponse(trip, equipment, authorLookup);
  }

  async create(companyId: number, dto: CreateTripDto) {
    const seq = await this.nextManeuverSequence(companyId);
    const prefix = maneuverCodePrefixFromClientName(dto.clientName ?? '');
    const maneuverCode =
      dto.maneuverCode?.trim() || formatManeuverCode(prefix, seq);

    let clientId = dto.clientId
      ? await this.resolveClientId(companyId, dto.clientId)
      : undefined;
    if (!clientId && dto.clientName) {
      const client = await this.clientsRepo.findOne({
        where: { companyId, name: dto.clientName.trim() },
      });
      clientId = client?.id;
    }

    const isRoundTrip = dto.isRoundTrip !== false;
    const distanceFields = this.resolveDistanceFieldsForPersist(
      dto.routeDistanceKm,
      isRoundTrip,
    );

    const dieselPricePerLiterAtCreation =
      await this.resolveDieselPriceSnapshot(dto);

    const operationSnapshot = await this.resolveOperationConfigSnapshot(
      companyId,
      dto.operationType,
    );

    const resolvedUnitId = dto.unitId
      ? await this.resolveUnitId(companyId, dto.unitId)
      : undefined;
    const resolvedOperatorId = dto.operatorId
      ? await this.resolveOperatorId(companyId, dto.operatorId)
      : undefined;

    const [unitRow, operatorRow] = await Promise.all([
      resolvedUnitId
        ? this.unitsRepo.findOne({ where: { id: resolvedUnitId, companyId } })
        : Promise.resolve(null),
      resolvedOperatorId
        ? this.operatorsRepo.findOne({
            where: { id: resolvedOperatorId, companyId },
          })
        : Promise.resolve(null),
    ]);

    const entity = this.tripsRepo.create({
      companyId,
      maneuverCode,
      origin: dto.origin,
      destination: dto.destination,
      clientId,
      clientName: dto.clientName,
      unitId: resolvedUnitId,
      operatorId: resolvedOperatorId,
      status: dto.status ?? 'scheduled',
      programmedAt: new Date(dto.programmedAt),
      scheduledAt: new Date(dto.scheduledAt),
      operationType: operationSnapshot.code,
      operationConfigurationId: operationSnapshot.id,
      operationConfigurationNameSnapshot: operationSnapshot.nameSnapshot,
      operationConfigurationVersionSnapshot: operationSnapshot.versionSnapshot,
      operationConfigurationMaxEquipmentCountSnapshot:
        operationSnapshot.maxEquipmentCountSnapshot,
      loadType: dto.loadType,
      containerType: dto.containerType,
      cargoDescription: dto.cargoDescription,
      approximateWeightTons: dto.approximateWeightTons,
      creditDays: dto.creditDays ?? 0,
      routeDistanceKm: distanceFields?.routeDistanceKm,
      operationalDistanceKm: distanceFields?.operationalDistanceKm,
      isRoundTrip,
      maneuverKind: dto.maneuverKind,
      dieselLiters: dto.dieselLiters,
      dieselAmount: dto.dieselAmount,
      dieselPricePerLiterAtCreation,
      casetasAmount: dto.casetasAmount,
      operatorQuota: dto.operatorQuota,
      clientCharge: dto.clientCharge,
      paymentMethod: dto.paymentMethod,
      requiresInvoice: dto.requiresInvoice,
      originPostalCode: dto.originPostalCode,
      originCityMunicipality: dto.originCityMunicipality,
      originLocality: dto.originLocality,
      destinationPostalCode: dto.destinationPostalCode,
      destinationCityMunicipality: dto.destinationCityMunicipality,
      destinationLocality: dto.destinationLocality,
      operatorLicenseNumber: dto.operatorLicenseNumber,
      operatorLicenseExpiresLabel: dto.operatorLicenseExpiresLabel,
      operatorNameSnapshot: operatorRow?.name?.trim() || undefined,
      unitOperationalCodeSnapshot: unitRow
        ? buildUnitOperationalId(unitRow)
        : undefined,
      departureAt: dto.departureAt ? new Date(dto.departureAt) : undefined,
      arrivedAt: dto.arrivedAt ? new Date(dto.arrivedAt) : undefined,
      tollCalculationMode: dto.tollCalculationMode,
      hasClientBilling: dto.hasClientBilling ?? !!dto.clientName?.trim(),
    });
    const trip = await this.tripsRepo.save(entity);

    if (dto.equipmentIds?.length) {
      const equipmentIds = await this.resolveEquipmentIds(
        companyId,
        dto.equipmentIds,
      );
      await this.syncEquipment(trip.id, equipmentIds);
    }

    return this.findOne(companyId, trip.id);
  }

  async update(companyId: number, tripId: number, dto: UpdateTripDto) {
    await this.getTripEntity(companyId, tripId);
    const {
      equipmentIds,
      programmedAt,
      scheduledAt,
      routeDistanceKm,
      isRoundTrip,
      clientId,
      unitId,
      operatorId,
      operationType,
      dieselPricePerLiterAtCreation: _immutablePrice,
      tollCalculationMode: _immutableTollMode,
      ...rest
    } = dto;
    const distanceFields =
      routeDistanceKm !== undefined
        ? this.resolveDistanceFieldsForPersist(
            routeDistanceKm,
            isRoundTrip !== undefined ? isRoundTrip : true,
          )
        : undefined;
    const operationPatch =
      operationType !== undefined
        ? await this.resolveOperationConfigSnapshot(companyId, operationType)
        : null;
    await this.tripsRepo.update(
      { id: tripId, companyId },
      {
        ...rest,
        ...(operationPatch && {
          operationType: operationPatch.code,
          operationConfigurationId: operationPatch.id,
          operationConfigurationNameSnapshot: operationPatch.nameSnapshot,
          operationConfigurationVersionSnapshot: operationPatch.versionSnapshot,
          operationConfigurationMaxEquipmentCountSnapshot:
            operationPatch.maxEquipmentCountSnapshot,
        }),
        ...(programmedAt && { programmedAt: new Date(programmedAt) }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
        ...(distanceFields && {
          routeDistanceKm: distanceFields.routeDistanceKm,
          operationalDistanceKm: distanceFields.operationalDistanceKm,
          ...(isRoundTrip !== undefined && { isRoundTrip: isRoundTrip !== false }),
        }),
        ...(clientId !== undefined && {
          clientId: clientId
            ? await this.resolveClientId(companyId, clientId)
            : undefined,
        }),
        ...(unitId !== undefined && {
          unitId: unitId
            ? await this.resolveUnitId(companyId, unitId)
            : undefined,
        }),
        ...(operatorId !== undefined && {
          operatorId: operatorId
            ? await this.resolveOperatorId(companyId, operatorId)
            : undefined,
        }),
      },
    );
    if (equipmentIds) {
      const resolvedEquipmentIds = await this.resolveEquipmentIds(
        companyId,
        equipmentIds,
      );
      await this.syncEquipment(tripId, resolvedEquipmentIds);
    }
    return this.findOne(companyId, tripId);
  }

  async cancel(companyId: number, tripId: number, dto: CancelTripDto) {
    const trip = await this.getTripEntity(companyId, tripId);
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
    return this.findOne(companyId, tripId);
  }

  async addIncident(companyId: number, tripId: number, dto: AddIncidentDto) {
    const trip = await this.getTripEntity(companyId, tripId);
    await this.incidentsRepo.save(
      this.incidentsRepo.create({
        tripId: trip.id,
        description: dto.description.trim(),
        postedBy: dto.postedBy.trim(),
        occurredAt: new Date(),
      }),
    );
    await this.tripsRepo.update({ id: trip.id, companyId }, { hasIncident: true });
    return this.findOne(companyId, tripId);
  }

  async setClientCollected(
    companyId: number,
    tripId: number,
    collected: boolean,
  ) {
    const trip = await this.getTripEntity(companyId, tripId);
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
    return this.findOne(companyId, tripId);
  }

  async remove(companyId: number, tripId: number) {
    await this.getTripEntity(companyId, tripId);
    await this.tripsRepo.delete({ id: tripId, companyId });
    return { id: tripId, deleted: true };
  }

  private async getTripEntity(companyId: number, tripId: number) {
    const trip = await this.tripsRepo.findOne({
      where: { companyId, id: tripId },
      relations: [...this.tripRelations],
    });
    if (!trip) {
      throw new NotFoundException(`Trip ${tripId} not found`);
    }
    return trip;
  }

  private async loadAuthorLookup(companyId: number): Promise<IncidentAuthorLookup> {
    const [users, operators] = await Promise.all([
      this.usersRepo.find({
        where: { companyId },
        select: ['username', 'displayName', 'jobTitle', 'role'],
      }),
      this.operatorsRepo.find({
        where: { companyId },
        select: ['name', 'portalUsername'],
      }),
    ]);
    return buildIncidentAuthorLookup(users, operators);
  }

  private async nextManeuverSequence(companyId: number): Promise<number> {
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

  private async syncEquipment(tripId: number, equipmentIds: number[]) {
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

  private async resolveClientId(
    companyId: number,
    ref: string,
  ): Promise<number | undefined> {
    const clientId = parseOptionalNumericId(ref, 'Client');
    if (!clientId) {
      return undefined;
    }
    const row = await this.clientsRepo.findOne({
      where: { companyId, id: clientId },
      select: ['id'],
    });
    if (!row) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }
    return row.id;
  }

  private async resolveUnitId(
    companyId: number,
    ref: string,
  ): Promise<number | undefined> {
    const unitId = parseOptionalNumericId(ref, 'Unit');
    if (!unitId) {
      return undefined;
    }
    const row = await this.unitsRepo.findOne({
      where: { companyId, id: unitId },
      select: ['id'],
    });
    if (!row) {
      throw new NotFoundException(`Unit ${unitId} not found`);
    }
    return row.id;
  }

  private async resolveOperatorId(
    companyId: number,
    ref: string,
  ): Promise<number | undefined> {
    const operatorId = parseOptionalNumericId(ref, 'Operator');
    if (!operatorId) {
      return undefined;
    }
    const row = await this.operatorsRepo.findOne({
      where: { companyId, id: operatorId },
      select: ['id'],
    });
    if (!row) {
      throw new NotFoundException(`Operator ${operatorId} not found`);
    }
    return row.id;
  }

  private async resolveOperationConfigSnapshot(
    companyId: number,
    rawCode: string,
  ): Promise<{
    code: string;
    id?: number;
    nameSnapshot: string;
    versionSnapshot: number;
    maxEquipmentCountSnapshot: number;
  }> {
    const code = normalizeOperationConfigCode(rawCode) || rawCode.trim().toLowerCase();
    if (!code) {
      return {
        code: '',
        nameSnapshot: 'Configuración desconocida',
        versionSnapshot: 1,
        maxEquipmentCountSnapshot: 1,
      };
    }
    const config = await this.operationConfigurations.findByCode(companyId, code);
    if (config) {
      return {
        code: config.code,
        id: config.id,
        nameSnapshot: config.name,
        versionSnapshot: config.version ?? 1,
        maxEquipmentCountSnapshot: Math.max(1, config.maxEquipmentCount ?? 1),
      };
    }
    return {
      code,
      nameSnapshot: this.fallbackOperationConfigName(code),
      versionSnapshot: 1,
      maxEquipmentCountSnapshot: 1,
    };
  }

  private fallbackOperationConfigName(code: string): string {
    const t = code.trim();
    if (!t) {
      return 'Configuración desconocida';
    }
    return t
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private async resolveDieselPriceSnapshot(
    dto: CreateTripDto,
  ): Promise<string> {
    const fromDto = dto.dieselPricePerLiterAtCreation;
    if (
      fromDto != null &&
      Number.isFinite(fromDto) &&
      fromDto > 0 &&
      fromDto < 200
    ) {
      return String(roundPrice4(fromDto));
    }
    const liters = dto.dieselLiters != null ? Number(dto.dieselLiters) : NaN;
    const amount = dto.dieselAmount != null ? Number(dto.dieselAmount) : NaN;
    if (
      Number.isFinite(liters) &&
      liters > 0 &&
      Number.isFinite(amount) &&
      amount >= 0
    ) {
      return String(roundPrice4(amount / liters));
    }
    const current = await this.fuelPriceService.getCurrentDieselPrice();
    return String(roundPrice4(current));
  }

  private resolveDistanceFieldsForPersist(
    routeDistanceKm: number | undefined,
    isRoundTrip: boolean,
  ): { routeDistanceKm: string; operationalDistanceKm: string } | undefined {
    if (routeDistanceKm === undefined || routeDistanceKm === null) {
      return undefined;
    }
    const breakdown = resolveTripOperationalDistance(routeDistanceKm, isRoundTrip);
    return {
      routeDistanceKm: String(breakdown.routeDistanceKm),
      operationalDistanceKm: String(breakdown.operationalDistanceKm),
    };
  }

  private async resolveEquipmentIds(
    companyId: number,
    refs: string[],
  ): Promise<number[]> {
    const out: number[] = [];
    for (const ref of refs) {
      const equipmentId = parseOptionalNumericId(ref, 'Equipment');
      if (!equipmentId) {
        continue;
      }
      const row = await this.equipmentRepo.findOne({
        where: { companyId, id: equipmentId },
        select: ['id'],
      });
      if (row) {
        out.push(row.id);
      }
    }
    return out;
  }
}

function roundPrice4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
