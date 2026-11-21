import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Catálogo INEGI N/D en ruta cuota (orden 2 / 3 con tarifas 523 / 223 MXN).
 * Claves generadas con hash de `punto_caseta` + tarifa + orden (vía Sakbé).
 */
const ALIASES: ReadonlyArray<{ plazaKey: string; displayName: string }> = [
  {
    plazaKey: 'inegi:hce1ccab165c1fa04b338:mxn523:o2',
    displayName: 'San Marcos',
  },
  {
    plazaKey: 'inegi:hce1ccab165c1fa04b338:mxn223:o3',
    displayName: 'Sayula',
  },
];

export class SeedTollPlazaAliasesSanMarcosSayula1753020000000
  implements MigrationInterface
{
  name = 'SeedTollPlazaAliasesSanMarcosSayula1753020000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const row of ALIASES) {
      await queryRunner.query(
        `
        INSERT INTO terminalops.toll_plaza_aliases (company_id, plaza_key, display_name)
        SELECT c.id, $1, $2
        FROM terminalops.companies c
        ON CONFLICT (company_id, plaza_key)
        DO UPDATE SET
          display_name = EXCLUDED.display_name,
          updated_at = now();
        `,
        [row.plazaKey, row.displayName],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const row of ALIASES) {
      await queryRunner.query(
        `
        DELETE FROM terminalops.toll_plaza_aliases
        WHERE plaza_key = $1;
        `,
        [row.plazaKey],
      );
    }
  }
}