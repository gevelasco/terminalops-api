import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AppUser } from 'src/users/entities/app-user.entity';
import { UserPreferences } from 'src/users/entities/user-preferences.entity';
import { UserModuleAccess } from 'src/users/entities/user-module-access.entity';
import { UsersService } from './users.service';

describe('UsersService (A3 operational analysis SSOT)', () => {
  let service: UsersService;

  const preferencesSave = jest.fn();
  const preferencesCreate = jest.fn((dto: object) => dto);

  beforeEach(async () => {
    jest.clearAllMocks();
    preferencesSave.mockImplementation(async (row: UserPreferences) => row);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(AppUser),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserPreferences),
          useValue: {
            save: preferencesSave,
            create: preferencesCreate,
            update: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserModuleAccess),
          useValue: {
            save: jest.fn(),
            create: jest.fn((dto: object) => dto),
            delete: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => 10),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  it('createPreferences no escribe operational_analysis en user_preferences', async () => {
    await service.createPreferences(7, 'dark');

    expect(preferencesCreate).toHaveBeenCalledWith({
      userId: 7,
      themeScheme: 'dark',
      controlAutomaticRecognition: false,
    });
    expect(preferencesSave).toHaveBeenCalled();
  });

  it('generateAuthUser expone geo operativo solo desde primaryOperationalCenter', () => {
    const user = {
      id: 1,
      username: 'admin',
      displayName: 'Admin User',
      email: 'admin@test.com',
      phone: '',
      jobTitle: '',
      photoDataUrl: '',
      role: 'admin',
      companyId: 10,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      company: {
        name: 'Acme',
        operationalAnalysisEnabled: false,
        operationalAnalysisChangedAt: new Date('2025-06-01T12:00:00.000Z'),
        primaryOperationalCenter: {
          name: 'Patio SSOT',
          postalCode: '66220',
          cityMunicipality: 'San Pedro, Nuevo León',
          locality: 'Valle Oriente',
          settlementConsId: 'oc-cons',
          latitude: '25.6500000',
          longitude: '-100.3500000',
        },
      },
      preferences: {
        themeScheme: 'light',
        controlAutomaticRecognition: true,
      },
    } as AppUser;

    const authUser = service.generateAuthUser(user);

    expect(authUser.operationalCenterPostalCode).toBe('66220');
    expect(authUser.operationalCenterLocality).toBe('Valle Oriente');
    expect(authUser.operationalCenterName).toBe('Patio SSOT');
    expect(authUser.operationalAnalysisEnabled).toBe(false);
  });
});
