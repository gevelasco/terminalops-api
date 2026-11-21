import { MigrationInterface, QueryRunner } from 'typeorm';

/** Ubicación INEGI estable (no cambia al variar ejes / tarifa). */
const GLOBAL_ALIASES: ReadonlyArray<{ plazaKey: string; displayName: string }> =
  [
    { plazaKey: 'point:19.40913,-103.52776', displayName: 'San Marcos' },
    { plazaKey: 'point:19.93323,-103.52976', displayName: 'Sayula' },
    {
      plazaKey: 'inegi:19.40913,-103.52776:mxn695:o2',
      displayName: 'San Marcos',
    },
    {
      plazaKey: 'inegi:19.93323,-103.52976:mxn301:o3',
      displayName: 'Sayula',
    },
  ];

export class SeedTollPlazaAliasesByInegiPoint1753040000000
  implements MigrationInterface
{
  name = 'SeedTollPlazaAliasesByInegiPoint1753040000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const row of GLOBAL_ALIASES) {
      await queryRunner.query(
        `
        INSERT INTO terminalops.toll_plaza_global_aliases (plaza_key, display_name)
        VALUES ($1, $2)
        ON CONFLICT (plaza_key)
        DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now();
        `,
        [row.plazaKey, row.displayName],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const row of GLOBAL_ALIASES) {
      await queryRunner.query(
        `
        DELETE FROM terminalops.toll_plaza_global_aliases
        WHERE plaza_key = $1;
        `,
        [row.plazaKey],
      );
    }
  }
}