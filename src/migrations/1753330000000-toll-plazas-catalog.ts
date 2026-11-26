import * as fs from 'fs';
import * as path from 'path';
import { MigrationInterface, QueryRunner } from 'typeorm';

type TollPlazaSeedRow = {
  plazaId: number;
  name: string;
  section: string | null;
  lat: number;
  lng: number;
  tEjeLig: number | null;
  tAutobus2: number | null;
  tAutobus3: number | null;
  tAutobus4: number | null;
  tCamion2: number | null;
  tCamion3: number | null;
  tCamion4: number | null;
  tCamion5: number | null;
  tCamion6: number | null;
  tCamion7: number | null;
  tCamion8: number | null;
  tCamion9: number | null;
  tEjePes: number | null;
};

function loadSeedRows(): TollPlazaSeedRow[] {
  const candidates = [
    path.join(__dirname, '..', 'tolls', 'data', 'toll-plazas.seed.json'),
    path.join(process.cwd(), 'dist', 'src', 'tolls', 'data', 'toll-plazas.seed.json'),
    path.join(process.cwd(), 'src', 'tolls', 'data', 'toll-plazas.seed.json'),
  ];
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as TollPlazaSeedRow[];
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error(`Seed de casetas vacío: ${filePath}`);
    }
    return raw;
  }
  throw new Error(
    'No se encontró toll-plazas.seed.json (src/tolls/data o dist/src/tolls/data).',
  );
}

export class TollPlazasCatalog1753330000000 implements MigrationInterface {
  name = 'TollPlazasCatalog1753330000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS terminalops.toll_plazas (
        plaza_id integer PRIMARY KEY,
        name text NOT NULL,
        section text NULL,
        lat double precision NOT NULL,
        lng double precision NOT NULL,
        t_eje_lig numeric(12,2) NULL,
        t_autobus2 numeric(12,2) NULL,
        t_autobus3 numeric(12,2) NULL,
        t_autobus4 numeric(12,2) NULL,
        t_camion2 numeric(12,2) NULL,
        t_camion3 numeric(12,2) NULL,
        t_camion4 numeric(12,2) NULL,
        t_camion5 numeric(12,2) NULL,
        t_camion6 numeric(12,2) NULL,
        t_camion7 numeric(12,2) NULL,
        t_camion8 numeric(12,2) NULL,
        t_camion9 numeric(12,2) NULL,
        t_eje_pes numeric(12,2) NULL,
        source_year smallint NOT NULL DEFAULT 2025,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_toll_plazas_lat_lng
        ON terminalops.toll_plazas (lat, lng);
    `);

    const rows = loadSeedRows();
    const chunkSize = 200;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const values: unknown[] = [];
      const placeholders: string[] = [];
      let p = 1;
      for (const row of chunk) {
        placeholders.push(
          `($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, 2025)`,
        );
        values.push(
          row.plazaId,
          row.name,
          row.section,
          row.lat,
          row.lng,
          row.tEjeLig,
          row.tAutobus2,
          row.tAutobus3,
          row.tAutobus4,
          row.tCamion2,
          row.tCamion3,
          row.tCamion4,
          row.tCamion5,
          row.tCamion6,
          row.tCamion7,
          row.tCamion8,
          row.tCamion9,
          row.tEjePes,
        );
      }
      await queryRunner.query(
        `
        INSERT INTO terminalops.toll_plazas (
          plaza_id, name, section, lat, lng,
          t_eje_lig, t_autobus2, t_autobus3, t_autobus4,
          t_camion2, t_camion3, t_camion4, t_camion5, t_camion6, t_camion7, t_camion8, t_camion9,
          t_eje_pes, source_year
        )
        VALUES ${placeholders.join(',\n')}
        ON CONFLICT (plaza_id) DO UPDATE SET
          name = EXCLUDED.name,
          section = EXCLUDED.section,
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          t_eje_lig = EXCLUDED.t_eje_lig,
          t_autobus2 = EXCLUDED.t_autobus2,
          t_autobus3 = EXCLUDED.t_autobus3,
          t_autobus4 = EXCLUDED.t_autobus4,
          t_camion2 = EXCLUDED.t_camion2,
          t_camion3 = EXCLUDED.t_camion3,
          t_camion4 = EXCLUDED.t_camion4,
          t_camion5 = EXCLUDED.t_camion5,
          t_camion6 = EXCLUDED.t_camion6,
          t_camion7 = EXCLUDED.t_camion7,
          t_camion8 = EXCLUDED.t_camion8,
          t_camion9 = EXCLUDED.t_camion9,
          t_eje_pes = EXCLUDED.t_eje_pes,
          source_year = EXCLUDED.source_year,
          updated_at = now();
        `,
        values,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS terminalops.idx_toll_plazas_lat_lng;
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS terminalops.toll_plazas;
    `);
  }
}
