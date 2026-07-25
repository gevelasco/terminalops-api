import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FileService } from './file.service';

const mockConfigService = {
  get: jest.fn((key: string): string => {
    const config: Record<string, string> = {
      RW_S3_BUCKET: 'test-bucket',
      RW_ACCESS_KEY_ID: 'test-access-key',
      RW_SECRET_ACCESS_KEY: 'test-secret-key',
      RW_REGION: 'auto',
      RW_URL: 'https://t3.storageapi.dev',
      NODE_ENV: 'local',
    };
    return config[key] ?? '';
  }),
};

const mockS3Instance = {
  getSignedUrlPromise: jest.fn().mockResolvedValue('signed-url'),
  upload: jest.fn().mockReturnThis(),
  promise: jest.fn().mockResolvedValue({ Location: 'uploaded-url' }),
  deleteObject: jest.fn().mockReturnThis(),
};

jest.mock('aws-sdk', () => ({
  S3: jest.fn(() => mockS3Instance),
}));

describe('FileService', () => {
  let service: FileService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockS3Instance.upload.mockReturnThis();
    mockS3Instance.deleteObject.mockReturnThis();
    mockS3Instance.promise.mockResolvedValue({ Location: 'uploaded-url' });
    mockS3Instance.getSignedUrlPromise.mockResolvedValue('signed-url');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<FileService>(FileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate presigned url', async () => {
    const url = await service.presignedUrl('file.txt');
    expect(url.url).toBe('signed-url');
  });

  it('should upload file and return metadata', async () => {
    const file = {
      originalname: 'test.txt',
      buffer: Buffer.from('data'),
      mimetype: 'text/plain',
      size: 123,
    } as Express.Multer.File;
    const result = await service.upload('folder', file);
    expect(result.url).toContain('folder/');
    expect(result.size).toBe('123');
    expect(result.originalName).toBe('test.txt');
    expect(result.extension).toBe('txt');
  });

  it('should remove file', async () => {
    await expect(service.remove('folder/file.txt')).resolves.toBeDefined();
    expect(mockS3Instance.deleteObject).toHaveBeenCalled();
  });

  it('should construct without bucket and fail lazily on use', async () => {
    const emptyConfig = {
      get: jest.fn().mockReturnValue(''),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileService,
        { provide: ConfigService, useValue: emptyConfig },
      ],
    }).compile();
    const lazy = module.get<FileService>(FileService);
    expect(lazy).toBeDefined();
    await expect(lazy.presignedUrl('x')).rejects.toThrow(
      'Object storage is not configured',
    );
  });
});
