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

/**
 * Recarga el catálogo con nombres resueltos (N/D→San Marcos/Sayula) y dedupe 150m.
 */
export class ReloadTollPlazasNamedDeduped1753350000000
  implements MigrationInterface
{
  name = 'ReloadTollPlazasNamedDeduped1753350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`TRUNCATE TABLE terminalops.toll_plazas`);

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
        `,
        values,
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Irreversible: el seed previo con sentidos duplicados ya no se conserva.
  }
}
