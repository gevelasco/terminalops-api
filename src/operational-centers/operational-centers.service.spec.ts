import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Company } from 'src/companies/entities/company.entity';
import { DestinationRate } from 'src/destination-rates/entities/destination-rate.entity';
import { OperationalCenter } from './entities/operational-center.entity';
import { OperationalCentersService } from './operational-centers.service';

describe('OperationalCentersService (A1 Fase 1–2)', () => {
  let service: OperationalCentersService;

  const centerSave = jest.fn();
  const centerCreate = jest.fn((dto: object) => dto);
  const centerFindOne = jest.fn();
  const companyFindOne = jest.fn();
  const companySave = jest.fn();
  const qbExecute = jest.fn().mockResolvedValue(undefined);
  const createQueryBuilder = jest.fn(() => {
    const qb: Record<string, unknown> = {};
    const chain = () => qb;
    qb.update = jest.fn(chain);
    qb.set = jest.fn(chain);
    qb.where = jest.fn(chain);
    qb.andWhere = jest.fn(chain);
    qb.execute = qbExecute;
    return qb;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    centerSave.mockImplementation(async (row: OperationalCenter) => ({
      ...row,
      id: row.id ?? 11,
    }));
    companySave.mockImplementation(async (row: Company) => row);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OperationalCentersService,
        {
          provide: getRepositoryToken(OperationalCenter),
          useValue: {
            save: centerSave,
            create: centerCreate,
            findOne: centerFindOne,
            find: jest.fn(),
            createQueryBuilder,
          },
        },
        {
          provide: getRepositoryToken(Company),
          useValue: {
            save: companySave,
            findOne: companyFindOne,
          },
        },
        {
          provide: getRepositoryToken(DestinationRate),
          useValue: {
            update: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(OperationalCentersService);
  });

  it('updatePrimaryCenterFromOperationalSettings escribe geo en operational_centers', async () => {
    centerFindOne.mockResolvedValueOnce({
      id: 11,
      companyId: 1,
      name: 'Centro Principal',
      isDefault: true,
    });
    companyFindOne.mockResolvedValueOnce({
      id: 1,
      primaryOperationalCenterId: 11,
    });

    await service.updatePrimaryCenterFromOperationalSettings(1, {
      operationalCenterPostalCode: '66220',
      operationalCenterLocality: 'Valle Oriente',
      operationalCenterLatitude: 25.65,
      operationalCenterLongitude: -100.35,
      operationalCenterName: 'Patio Norte',
    });

    expect(centerSave).toHaveBeenCalledWith(
      expect.objectContaining({
        postalCode: '66220',
        locality: 'Valle Oriente',
        latitude: '25.65',
        longitude: '-100.35',
        name: 'Patio Norte',
      }),
    );
    expect(companySave).not.toHaveBeenCalled();
  });

  it('ensureDefaultCenterForCompany no sobrescribe geo de centro existente', async () => {
    companyFindOne.mockResolvedValueOnce({
      id: 1,
      primaryOperationalCenterId: 11,
    });
    centerFindOne.mockResolvedValueOnce({
      id: 11,
      companyId: 1,
      postalCode: '64000',
      locality: 'Centro',
      isDefault: true,
    });

    const center = await service.ensureDefaultCenterForCompany(1);

    expect(center.postalCode).toBe('64000');
    expect(centerSave).not.toHaveBeenCalled();
    expect(centerCreate).not.toHaveBeenCalled();
  });

  it('ensureDefaultCenterForCompany crea centro vacío sin leer columnas legacy', async () => {
    companyFindOne.mockResolvedValueOnce({
      id: 1,
      primaryOperationalCenterId: null,
    });
    centerFindOne.mockResolvedValue(null);

    await service.ensureDefaultCenterForCompany(1);

    expect(centerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 1,
        name: 'Centro Principal',
        code: 'MAIN',
        isDefault: true,
      }),
    );
    expect(centerCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({ postalCode: '99999' }),
    );
  });
});
