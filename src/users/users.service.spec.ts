import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AppUser } from 'src/users/entities/app-user.entity';
import { UserPreferences } from 'src/users/entities/user-preferences.entity';
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

  it('generateAuthUser toma operationalAnalysisEnabled de company, no de preferences', () => {
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
      },
      preferences: {
        themeScheme: 'light',
        controlAutomaticRecognition: true,
      },
    } as AppUser;

    const authUser = service.generateAuthUser(user);

    expect(authUser.operationalAnalysisEnabled).toBe(false);
    expect(authUser.operationalAnalysisChangedAt).toBe(
      '2025-06-01T12:00:00.000Z',
    );
  });
});
