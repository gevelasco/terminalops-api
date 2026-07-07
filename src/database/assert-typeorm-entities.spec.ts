import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { assertRequiredTypeOrmEntities } from './assert-typeorm-entities';

describe('assertRequiredTypeOrmEntities', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers AppUser and Company metadata in the live DataSource', () => {
    expect(() => assertRequiredTypeOrmEntities(app)).not.toThrow();

    const dataSource = app.get(DataSource);
    expect(dataSource.hasMetadata('AppUser')).toBe(true);
    expect(dataSource.hasMetadata('Company')).toBe(true);
    expect(dataSource.entityMetadatas.length).toBeGreaterThan(0);
  });
});
