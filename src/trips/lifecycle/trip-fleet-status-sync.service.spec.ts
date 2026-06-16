import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Company } from 'src/companies/entities/company.entity';
import { Equipment } from 'src/equipment/entities/equipment.entity';
import { Operator } from 'src/operators/entities/operator.entity';
import { Trip } from 'src/trips/entities/trip.entity';
import { TripEquipment } from 'src/trips/entities/trip-equipment.entity';
import { Unit } from 'src/units/entities/unit.entity';
import { TripFleetStatusSyncService } from './trip-fleet-status-sync.service';

type ResourceRow = { id: number; status: string };

describe('TripFleetStatusSyncService.syncForTripAfterUpdate', () => {
  let service: TripFleetStatusSyncService;

  const companyId = 1;
  const tripId = 100;

  let units = new Map<number, ResourceRow>();
  let operators = new Map<number, ResourceRow>();
  let equipment = new Map<number, ResourceRow & { unitId?: number }>();
  let tripEquipmentRows: { tripId: number; equipmentId: number }[] = [];
  let activeTripsByUnit = new Map<number, string[]>();
  let activeTripsByOperator = new Map<number, string[]>();
  let activeTripsByEquipment = new Map<number, string[]>();

  const unitsUpdate = jest.fn();
  const operatorsUpdate = jest.fn();
  const equipmentUpdate = jest.fn();

  beforeEach(async () => {
    units = new Map();
    operators = new Map();
    equipment = new Map();
    tripEquipmentRows = [];
    activeTripsByUnit = new Map();
    activeTripsByOperator = new Map();
    activeTripsByEquipment = new Map();
    unitsUpdate.mockReset();
    operatorsUpdate.mockReset();
    equipmentUpdate.mockReset();

    const createEquipmentQueryBuilder = () => {
      let capturedEquipmentId: number | undefined;
      return {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn(function (
          this: unknown,
          _clause: string,
          params?: { equipmentId?: number },
        ) {
          if (params?.equipmentId != null) {
            capturedEquipmentId = params.equipmentId;
          }
          return this;
        }),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn(async () => {
          if (capturedEquipmentId == null) {
            return [];
          }
          return (activeTripsByEquipment.get(capturedEquipmentId) ?? []).map(
            (status) => ({ status }),
          );
        }),
      };
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripFleetStatusSyncService,
        {
          provide: getRepositoryToken(Trip),
          useValue: {
            find: jest.fn(
              async (opts: {
                where?: {
                  unitId?: number;
                  operatorId?: number;
                  status?: { _value?: string[] };
                };
              }) => {
                const w = opts.where ?? {};
                if (w.unitId != null) {
                  return (activeTripsByUnit.get(w.unitId) ?? []).map(
                    (status) => ({ status }),
                  );
                }
                if (w.operatorId != null) {
                  return (activeTripsByOperator.get(w.operatorId) ?? []).map(
                    (status) => ({ status }),
                  );
                }
                return [];
              },
            ),
            createQueryBuilder: jest.fn(() => createEquipmentQueryBuilder()),
          },
        },
        {
          provide: getRepositoryToken(TripEquipment),
          useValue: {
            find: jest.fn(async () =>
              tripEquipmentRows
                .filter((row) => row.tripId === tripId)
                .map((row) => ({ equipmentId: row.equipmentId })),
            ),
          },
        },
        {
          provide: getRepositoryToken(Unit),
          useValue: {
            findOne: jest.fn(async ({ where }: { where: { id: number } }) => {
              const row = units.get(where.id);
              return row ? { id: row.id, status: row.status } : null;
            }),
            update: unitsUpdate,
          },
        },
        {
          provide: getRepositoryToken(Operator),
          useValue: {
            findOne: jest.fn(async ({ where }: { where: { id: number } }) => {
              const row = operators.get(where.id);
              return row ? { id: row.id, status: row.status } : null;
            }),
            update: operatorsUpdate,
          },
        },
        {
          provide: getRepositoryToken(Equipment),
          useValue: {
            find: jest.fn(
              async ({
                where,
              }: {
                where: { companyId?: number; unitId?: number };
              }) => {
                if (where.unitId == null) {
                  return [];
                }
                return [...equipment.values()]
                  .filter((row) => row.unitId === where.unitId)
                  .map((row) => ({ id: row.id, status: row.status }));
              },
            ),
            findOne: jest.fn(async ({ where }: { where: { id: number } }) => {
              const row = equipment.get(where.id);
              return row ? { id: row.id, status: row.status } : null;
            }),
            update: equipmentUpdate,
          },
        },
        {
          provide: getRepositoryToken(Company),
          useValue: {
            findOne: jest.fn(async () => ({
              id: companyId,
              operationalAnalysisEnabled: true,
            })),
          },
        },
      ],
    }).compile();

    service = module.get(TripFleetStatusSyncService);
  });

  function seedUnit(id: number, status: string, activeStatuses: string[] = []) {
    units.set(id, { id, status });
    activeTripsByUnit.set(id, activeStatuses);
  }

  function seedOperator(
    id: number,
    status: string,
    activeStatuses: string[] = [],
  ) {
    operators.set(id, { id, status });
    activeTripsByOperator.set(id, activeStatuses);
  }

  function seedEquipment(
    id: number,
    status: string,
    activeStatuses: string[] = [],
    unitId?: number,
  ) {
    equipment.set(id, { id, status, unitId });
    activeTripsByEquipment.set(id, activeStatuses);
  }

  function setTripEquipment(ids: number[]) {
    tripEquipmentRows = ids.map((equipmentId) => ({ tripId, equipmentId }));
  }

  it('cambio de unidad: libera la anterior y ocupa la nueva en in_transit', async () => {
    seedUnit(10, 'in_use', ['in_transit']);
    seedUnit(20, 'available', []);
    activeTripsByUnit.set(10, []);
    activeTripsByUnit.set(20, ['in_transit']);

    await service.syncForTripAfterUpdate(
      {
        id: tripId,
        companyId,
        status: 'in_transit',
        unitId: 20,
        operatorId: null,
      },
      { unitIds: [10], operatorIds: [], equipmentIds: [] },
    );

    expect(unitsUpdate).toHaveBeenCalledWith(
      { id: 10, companyId },
      { status: 'available' },
    );
    expect(unitsUpdate).toHaveBeenCalledWith(
      { id: 20, companyId },
      { status: 'in_use' },
    );
  });

  it('cambio de operador: libera el anterior y asigna on_route al nuevo', async () => {
    seedOperator(1, 'on_route', []);
    seedOperator(2, 'available', []);
    activeTripsByOperator.set(1, []);
    activeTripsByOperator.set(2, ['in_transit']);

    await service.syncForTripAfterUpdate(
      {
        id: tripId,
        companyId,
        status: 'in_transit',
        unitId: null,
        operatorId: 2,
      },
      { unitIds: [], operatorIds: [1], equipmentIds: [] },
    );

    expect(operatorsUpdate).toHaveBeenCalledWith(
      { id: 1, companyId },
      { status: 'available' },
    );
    expect(operatorsUpdate).toHaveBeenCalledWith(
      { id: 2, companyId },
      { status: 'on_route' },
    );
  });

  it('agregar equipo: sincroniza el equipo nuevo a in_use', async () => {
    seedEquipment(50, 'available', []);
    activeTripsByEquipment.set(50, ['in_transit']);
    setTripEquipment([50]);

    await service.syncForTripAfterUpdate(
      {
        id: tripId,
        companyId,
        status: 'in_transit',
        unitId: null,
        operatorId: null,
      },
      { unitIds: [], operatorIds: [], equipmentIds: [] },
    );

    expect(equipmentUpdate).toHaveBeenCalledWith(
      { id: 50, companyId },
      { status: 'in_use' },
    );
  });

  it('quitar equipo: libera el equipo removido a available', async () => {
    seedEquipment(60, 'in_use', []);
    activeTripsByEquipment.set(60, []);
    setTripEquipment([]);

    await service.syncForTripAfterUpdate(
      {
        id: tripId,
        companyId,
        status: 'in_transit',
        unitId: null,
        operatorId: null,
      },
      { unitIds: [], operatorIds: [], equipmentIds: [60] },
    );

    expect(equipmentUpdate).toHaveBeenCalledWith(
      { id: 60, companyId },
      { status: 'available' },
    );
  });

  it('reemplazar equipo: libera el anterior y ocupa el nuevo', async () => {
    seedEquipment(70, 'in_use', []);
    seedEquipment(71, 'available', []);
    activeTripsByEquipment.set(70, []);
    activeTripsByEquipment.set(71, ['in_transit']);
    setTripEquipment([71]);

    await service.syncForTripAfterUpdate(
      {
        id: tripId,
        companyId,
        status: 'in_transit',
        unitId: null,
        operatorId: null,
      },
      { unitIds: [], operatorIds: [], equipmentIds: [70] },
    );

    expect(equipmentUpdate).toHaveBeenCalledWith(
      { id: 70, companyId },
      { status: 'available' },
    );
    expect(equipmentUpdate).toHaveBeenCalledWith(
      { id: 71, companyId },
      { status: 'in_use' },
    );
  });

  it('unidad anterior con otra maniobra activa permanece scheduled', async () => {
    seedUnit(10, 'in_use', []);
    seedUnit(20, 'available', []);
    activeTripsByUnit.set(10, ['scheduled']);
    activeTripsByUnit.set(20, ['in_transit']);

    await service.syncForTripAfterUpdate(
      {
        id: tripId,
        companyId,
        status: 'in_transit',
        unitId: 20,
        operatorId: null,
      },
      { unitIds: [10], operatorIds: [], equipmentIds: [] },
    );

    expect(unitsUpdate).toHaveBeenCalledWith(
      { id: 10, companyId },
      { status: 'scheduled' },
    );
    expect(unitsUpdate).toHaveBeenCalledWith(
      { id: 20, companyId },
      { status: 'in_use' },
    );
    expect(unitsUpdate).not.toHaveBeenCalledWith(
      { id: 10, companyId },
      { status: 'available' },
    );
  });

  it('operador anterior con otra maniobra activa permanece on_route', async () => {
    seedOperator(1, 'available', []);
    seedOperator(2, 'available', []);
    activeTripsByOperator.set(1, ['in_transit']);
    activeTripsByOperator.set(2, ['in_transit']);

    await service.syncForTripAfterUpdate(
      {
        id: tripId,
        companyId,
        status: 'in_transit',
        unitId: null,
        operatorId: 2,
      },
      { unitIds: [], operatorIds: [1], equipmentIds: [] },
    );

    expect(operatorsUpdate).toHaveBeenCalledWith(
      { id: 1, companyId },
      { status: 'on_route' },
    );
    expect(operatorsUpdate).toHaveBeenCalledWith(
      { id: 2, companyId },
      { status: 'on_route' },
    );
    expect(operatorsUpdate).not.toHaveBeenCalledWith(
      { id: 1, companyId },
      { status: 'available' },
    );
  });

  it('equipo enganchado a unidad en maniobra pasa a in_use aunque no esté en trip_equipment', async () => {
    seedUnit(10, 'available', ['in_transit']);
    seedEquipment(80, 'available', [], 10);
    setTripEquipment([]);

    await service.syncForTrip({
      id: tripId,
      companyId,
      status: 'in_transit',
      unitId: 10,
      operatorId: null,
    });

    expect(unitsUpdate).toHaveBeenCalledWith(
      { id: 10, companyId },
      { status: 'in_use' },
    );
    expect(equipmentUpdate).toHaveBeenCalledWith(
      { id: 80, companyId },
      { status: 'in_use' },
    );
  });

  it('no sincroniza cuando operationalAnalysisEnabled es false', async () => {
    const companiesRepo = {
      findOne: jest.fn(async () => ({
        id: companyId,
        operationalAnalysisEnabled: false,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripFleetStatusSyncService,
        { provide: getRepositoryToken(Trip), useValue: { find: jest.fn() } },
        {
          provide: getRepositoryToken(TripEquipment),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(Unit),
          useValue: { findOne: jest.fn(), update: unitsUpdate },
        },
        {
          provide: getRepositoryToken(Operator),
          useValue: { findOne: jest.fn(), update: operatorsUpdate },
        },
        {
          provide: getRepositoryToken(Equipment),
          useValue: { findOne: jest.fn(), update: equipmentUpdate },
        },
        { provide: getRepositoryToken(Company), useValue: companiesRepo },
      ],
    }).compile();

    const disabledService = module.get(TripFleetStatusSyncService);
    seedUnit(10, 'in_use', []);

    await disabledService.syncForTripAfterUpdate(
      {
        id: tripId,
        companyId,
        status: 'in_transit',
        unitId: 20,
        operatorId: null,
      },
      { unitIds: [10], operatorIds: [], equipmentIds: [] },
    );

    expect(unitsUpdate).not.toHaveBeenCalled();
  });
});
